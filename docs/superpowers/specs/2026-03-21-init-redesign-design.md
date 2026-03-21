# TaskFlow Init 재설계 — MCP-First 아키텍처

## 1. 개요

`task init` 명령어를 확장하여 프로젝트 초기화, Claude Code 연동, PRD 생성을 하나의 플로우로 통합한다. 동시에 전체 CLI 기능을 MCP 서버로 노출하여 Claude Code에서 직접 TaskFlow를 사용할 수 있게 한다.

### 핵심 결정 사항

| 항목 | 결정 |
|------|------|
| 아키텍처 | MCP-First — core 레이어를 CLI, MCP, Hono가 공유 |
| MCP 역할 범위 | 전체 CLI 기능 노출 (17개 도구) |
| 실행 환경 | 터미널 CLI + Claude Code MCP 둘 다 지원 |
| 브레인스토밍 | CLI에서 AI 멀티턴 대화 + Claude Code에서 brainstorm 스킬 |
| PRD 재생성 | `task init` 재실행 시 .taskflow 존재 여부로 분기 |
| MCP 전송 | stdio 전용 (SSE는 chokidar 파일 감시로 자동 처리) |
| CLAUDE.md | PRD 결과를 반영한 동적 생성 |
| MCP 라이브러리 | `@modelcontextprotocol/sdk` (공식 SDK) |
| AI 제공자 | Claude Max 전용 — API 키 불필요, 다른 옵션 없음 |

---

## 2. Core 레이어 구조

비즈니스 로직을 `src/core/`로 통합한다. CLI(inquirer, ora, chalk) 의존성 없는 순수 로직만 포함.

```
src/core/
├── project/
│   ├── init.ts              # 프로젝트 초기화 (폴더 생성, config 생성)
│   ├── config.ts            # config.json 읽기/쓰기
│   └── claude-setup.ts      # CLAUDE.md, .mcp.json 생성
│
├── prd/
│   ├── generator.ts         # 프로젝트 PRD 마크다운 빌드
│   ├── feature-generator.ts # 기능별 PRD 마크다운 빌드
│   ├── auto-analyzer.ts     # 코드 스캔 → AI PRD 생성
│   └── parser.ts            # PRD → 태스크 파싱
│
├── task/
│   ├── repository.ts        # CRUD (features/taskflow/lib/에서 이동)
│   ├── serializer.ts        # 마크다운 ↔ Task 변환
│   ├── filter.ts            # 필터/정렬
│   ├── graph.ts             # 의존성 그래프
│   └── recommender.ts       # next 추천 로직
│
├── ai/
│   ├── client.ts            # Claude Agent SDK 래퍼 (query 호출, Claude Max 전용)
│   └── refine-engine.ts     # refine 분석 엔진
│
└── types.ts                 # 공유 타입 정의 (PrdResult 등 중복 타입 통합)
```

### 설계 원칙

- core 안의 모든 함수는 순수 로직 — CLI UI 의존성 없음
- 입출력은 인터페이스로 추상화
- 기존 `features/taskflow/lib/repository.ts`의 `projectRoot: string` 파라미터 패턴 유지 — `process.cwd()`를 내부에서 사용하지 않음
- 기존 `PrdResult`, `FeaturePrdResult` 타입 중복 (`auto.ts`, `interactive.ts`, `feature-prd-flow.ts`) → `core/types.ts`로 통합

---

## 3. MCP 서버

`@modelcontextprotocol/sdk` 기반 stdio MCP 서버.

### 구조

```
src/mcp/
├── index.ts                 # MCP 서버 진입점 (stdio transport)
├── server.ts                # Server 인스턴스 생성 + 도구 등록
└── tools/
    ├── project.ts           # initialize_project, generate_claude_md
    ├── prd.ts               # generate_prd, brainstorm_prd, auto_analyze_prd, generate_feature_prd (brainstorm_prd는 단일 도구로 시작/계속 분기)
    ├── task.ts              # list_tasks, read_task, create_task, update_task, delete_task
    ├── task-status.ts       # set_task_status, get_next_task
    ├── parse.ts             # parse_prd
    ├── brainstorm.ts        # brainstorm_task, expand_subtasks
    └── refine.ts            # refine_tasks
```

### MCP 도구 목록 (17개)

| 도구 | 설명 | core 함수 |
|------|------|-----------|
| `initialize_project` | 프로젝트 초기화 | `core/project/init.ts` |
| `generate_claude_md` | CLAUDE.md 동적 생성/갱신 | `core/project/claude-setup.ts` |
| `generate_prd` | PRD 생성 | `core/prd/generator.ts` |
| `brainstorm_prd` | AI 브레인스토밍 멀티턴 대화 | `core/prd/generator.ts` (brainstorm 함수) |
| `auto_analyze_prd` | 코드 스캔 → PRD 자동 생성 | `core/prd/auto-analyzer.ts` |
| `generate_feature_prd` | 기능별 PRD 생성 | `core/prd/feature-generator.ts` |
| `parse_prd` | PRD → 태스크 분해 | `core/prd/parser.ts` |
| `list_tasks` | 태스크 목록 (필터/정렬) | `core/task/repository.ts` |
| `read_task` | 태스크 상세 조회 | `core/task/repository.ts` |
| `create_task` | 태스크 생성 | `core/task/repository.ts` |
| `update_task` | 태스크 수정 | `core/task/repository.ts` |
| `delete_task` | 태스크 삭제 | `core/task/repository.ts` |
| `set_task_status` | 상태 변경 | `core/task/repository.ts` |
| `get_next_task` | 다음 태스크 추천 | `core/task/recommender.ts` |
| `brainstorm_task` | 태스크 서브태스크 분해 | `core/ai/client.ts` (brainstormTask 함수) |
| `expand_subtasks` | 분해 결과 → 파일 생성 | `core/task/repository.ts` |
| `refine_tasks` | 변경사항 영향도 분석 | `core/ai/refine-engine.ts` |

### MCP 도구 `projectRoot` 처리

모든 MCP 도구는 `projectRoot` 파라미터를 **선택적으로** 받는다. 생략 시 MCP 서버 프로세스의 `process.cwd()`를 기본값으로 사용한다. 이를 공통 유틸 `resolveProjectRoot(input?: string)`로 처리한다.

### 주요 MCP 도구 입력 스키마

**`brainstorm_prd`** — 단일 도구로 세션 시작과 계속을 모두 처리:
```typescript
{
  projectRoot?: string;           // 프로젝트 경로 (선택)
  session?: BrainstormSession;    // 기존 세션 (없으면 새 세션 시작)
  userMessage?: string;           // 사용자 응답 (세션 계속 시 필수)
  projectContext?: string;        // 프로젝트 컨텍스트 (새 세션 시작 시 선택)
}
// session 없음 → startBrainstorm() 호출
// session 있음 + userMessage → continueBrainstorm() 호출
```

**`initialize_project`:**
```typescript
{ projectRoot?: string; projectName?: string; }
```

**`list_tasks`:**
```typescript
{ projectRoot?: string; status?: string; priority?: string; sortBy?: string; }
```

**`set_task_status`:**
```typescript
{ projectRoot?: string; taskId: string; status: string; }
```

**`generate_feature_prd`:**
```typescript
{ projectRoot?: string; featureName: string; goal: string; parentPrd?: string; }
```

**`brainstorm_task`:**
```typescript
{ projectRoot?: string; taskId: string; depth?: number; }
```

**`refine_tasks`:**
```typescript
{ projectRoot?: string; changes: string; }
```

### 엔트리포인트

**`bin/task-mcp.mjs`:**

`spawn`을 사용한다 (기존 `bin/task.mjs`의 `execFileSync`와 다름 — MCP 서버는 장시간 실행되는 프로세스이므로 non-blocking이 필요).

```javascript
#!/usr/bin/env node
import { spawn } from "child_process";
spawn("node", ["--import", "tsx", new URL("../src/mcp/index.ts", import.meta.url).pathname], { stdio: "inherit" });
```

**`.mcp.json` (init 시 생성):**
```json
{
  "mcpServers": {
    "taskflow": {
      "type": "stdio",
      "command": "node",
      "args": ["./bin/task-mcp.mjs"],
      "env": {}
    }
  }
}
```

API 키 불필요 — Claude Max 인증 사용.

---

## 4. `task init` 플로우

### 신규 초기화 (.taskflow 없음)

```
1. .taskflow/ 디렉토리 생성
2. .taskflow/config.json 생성
3. .mcp.json 생성 (프로젝트 루트)
4. PRD 생성 모드 선택
   ├─ "대화형 브레인스토밍" → AI 멀티턴 대화 → PRD 생성
   └─ "AI 자동 분석" → 코드 스캔 → PRD 생성
5. PRD를 .taskflow/prd.md에 저장
6. .taskflow/CLAUDE.md 동적 생성 (프로젝트명, 스택, 도구 목록 반영)
7. 루트 CLAUDE.md에 @./.taskflow/CLAUDE.md import 추가
```

### PRD 재생성 (.taskflow 존재)

```
1. "PRD를 다시 생성하시겠습니까?"
2. YES → 모드 선택 → PRD 생성 → .taskflow/prd.md 덮어쓰기
3. .taskflow/CLAUDE.md도 PRD 내용 반영하여 재생성
4. NO → 종료
```

### PRD 저장 위치

- 변경 전: `{projectName}-docs/prd.md`
- 변경 후: `.taskflow/prd.md`

### 기존 form 기반 대화형 모드 (interactive.ts)

기존 `runInteractivePrd()`는 고정된 15개 질문을 순서대로 묻는 form 방식이다. 이 모드는 **AI 멀티턴 브레인스토밍으로 대체**된다. AI가 프로젝트 맥락에 맞는 질문을 동적으로 생성하고, 충분한 정보가 모이면 PRD를 자동 작성한다. 기존 form 방식은 유지하지 않는다.

---

## 5. CLAUDE.md 동적 생성

### `.taskflow/CLAUDE.md`

PRD에서 추출한 프로젝트 정보 + MCP 도구 가이드를 합쳐서 생성.

```markdown
# TaskFlow — {프로젝트명} 개발 가이드

## 프로젝트 정보
- 이름: {projectName}
- 설명: {summary}
- 기술 스택: {stack}
- 생성일: {date}

## TaskFlow MCP 도구
(17개 도구 목록 + 설명)

## 워크플로우
### 새 기능 구현 시
1. get_next_task → 다음 태스크 확인
2. set_task_status → in-progress
3. 구현 완료 후 set_task_status → done

### 요구사항 변경 시
1. refine_tasks → 영향 받는 태스크 분석
2. 영향 받는 태스크 확인 및 수정

## 파일 구조
- .taskflow/config.json — 프로젝트 설정
- .taskflow/prd.md — PRD 문서
- .taskflow/tasks/task-{NNN}.md — 개별 태스크 파일
```

`@./.taskflow/CLAUDE.md`는 Claude Code의 파일 import 문법이다. Claude Code 외의 도구에서는 일반 텍스트로 보인다.

### 루트 CLAUDE.md 처리

- CLAUDE.md 존재 → 파일 끝에 `@./.taskflow/CLAUDE.md` import 추가
- CLAUDE.md 없음 → 새 파일 생성 + import 포함
- 기존 사용자 내용은 절대 건드리지 않고 append만

---

## 6. AI 클라이언트 (Claude Max 전용)

### `core/ai/client.ts`

`@anthropic-ai/claude-agent-sdk`의 `query()` 사용. API 키 불필요. 다른 AI 제공자 옵션 없음.

```typescript
export interface AiRequest {
  prompt: string;
  systemPrompt: string;
  maxTurns?: number;
}

export interface AiResponse {
  text: string;
}

export async function askClaude(req: AiRequest): Promise<AiResponse>
```

### `core/prd/generator.ts` — PRD 브레인스토밍

PRD 생성을 위한 멀티턴 브레인스토밍 함수를 포함한다. **Stateless 설계** — 서버는 세션을 저장하지 않으며, 클라이언트(CLI 또는 MCP 호출자)가 매 호출마다 전체 `messages` 배열을 전달한다.

```typescript
export interface BrainstormSession {
  sessionId: string;  // 고유 식별자 (UUID)
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  isComplete: boolean;
}

export interface BrainstormTurn {
  session: BrainstormSession;  // 업데이트된 세션 (messages 포함)
  aiMessage: string;
  isComplete: boolean;
  prdMarkdown?: string;
}

// 새 세션 시작 — sessionId 자동 생성, 첫 AI 질문 반환
export function startBrainstorm(projectRoot: string, projectContext?: string): Promise<BrainstormTurn>

// 사용자 응답으로 다음 턴 진행 — 전체 session을 받아 다음 턴 반환
export function continueBrainstorm(session: BrainstormSession, userMessage: string): Promise<BrainstormTurn>

// PRD 마크다운 빌드 (브레인스토밍 완료 후 or 자동분석 결과로)
export function buildPrdMarkdown(answers: PrdData): string
```

- CLI: `startBrainstorm()` → inquirer 입력 → `continueBrainstorm()` → 반복
- MCP: `brainstorm_prd` 도구 호출 시 `session` 객체를 매번 전달. MCP 서버 재시작 시에도 클라이언트가 session을 보유하므로 대화 유실 없음.

### `core/ai/client.ts` — 태스크 브레인스토밍

태스크를 서브태스크로 분해하는 `brainstormTask()`도 이 파일에 위치한다. PRD 브레인스토밍(멀티턴 대화)과 달리, 태스크 브레인스토밍은 **싱글턴 호출** — 태스크 내용을 넘기면 AI가 서브태스크 목록을 반환한다.

```typescript
export interface TaskBrainstormResult {
  subtasks: Array<{ title: string; description: string; priority: string }>;
}

export function brainstormTask(projectRoot: string, taskId: string, depth?: number): Promise<TaskBrainstormResult>
```

---

## 7. CLI 명령어 정리

### 변경 사항

| 명령어 | 변경 |
|--------|------|
| `task init` | 확장 (전체 셋업 + PRD) |
| `task prd` | **제거** |
| `task fprd` | 유지 (core 이동) |
| `task parse-prd` | 유지 (core 이동) |
| `task list` | 유지 (core 이동) |
| `task show` | 유지 (core 이동) |
| `task set-status` | 유지 (core 이동) |
| `task next` | 유지 (core 이동) |
| `task brainstorm` | 유지 (core 이동) |
| `task expand` | 유지 (core 이동) |
| `task refine` | 유지 (core 이동) |

### CLI 레이어 역할

모든 CLI 명령어는 thin wrapper로 변경:
- core 함수 호출 → 결과를 터미널 포맷(chalk, ora)으로 출력

### index.ts 변경

```typescript
// 제거
- import { registerPrdCommand } from "./commands/prd.js";
- registerPrdCommand(program);
```

---

## 8. 파일 구조 요약

```
bin/
├── task.mjs              # CLI 엔트리
└── task-mcp.mjs          # MCP 서버 엔트리 (새로 추가)

src/
├── core/                 # 비즈니스 로직 (순수, UI 의존성 없음)
│   ├── project/          # 프로젝트 초기화 + Claude 셋업
│   ├── prd/              # PRD 생성/파싱
│   ├── task/             # 태스크 CRUD + 추천
│   ├── ai/               # Claude Max AI 클라이언트
│   └── types.ts
├── mcp/                  # MCP 서버 (@modelcontextprotocol/sdk)
│   ├── index.ts
│   ├── server.ts
│   └── tools/
├── cli/                  # CLI (commander, thin wrapper)
│   ├── index.ts
│   ├── commands/
│   ├── flows/            # CLI 전용 UI 로직 (inquirer 대화 루프 등)
│   └── lib/
├── backend/              # Hono 웹 서버
└── features/             # 웹 프론트엔드 features
```

---

## 9. 에러 처리 정책

### 원칙

- Fail fast — 명확한 에러 메시지와 함께 즉시 실패
- core 함수는 예외를 throw — CLI와 MCP가 각자 방식으로 처리
- 복구 가능한 에러는 재시도, 복구 불가능한 에러는 명확한 안내

### 주요 실패 시나리오

| 시나리오 | 처리 방식 |
|---------|----------|
| AI 호출 실패 (네트워크, 타임아웃) | 지수 백오프 재시도 (최대 3회), 실패 시 에러 메시지 |
| 디스크 쓰기 실패 (권한, 용량) | 즉시 실패 + 권한/경로 확인 안내 |
| PRD 생성 결과가 비어있음 | 에러 throw + 재시도 안내 |
| `.mcp.json` 이미 존재 | 기존 내용에 taskflow 서버 설정을 merge (다른 MCP 서버 설정 보존) |
| 루트 CLAUDE.md 형식이 예상과 다름 | 파일 끝에 안전하게 append만 수행 (파싱 불필요) |
| 브레인스토밍 중 AI 호출 실패 | 현재까지 대화 내용 보존, 재시도 가능 안내 |

### CLI vs MCP 에러 처리

- CLI: `withCliErrorBoundary`로 감싸서 사용자 친화적 메시지 출력 (기존 패턴 유지)
- MCP: MCP 프로토콜의 에러 응답 형식으로 반환 (`isError: true` + 메시지)

---

## 10. 마이그레이션 전략

기존 코드를 한 번에 옮기지 않고, init 플로우에 필요한 것부터 점진적으로 core에 추출한다.

1. `core/project/` — init에 필요한 새 코드 작성
2. `core/prd/` — 기존 `flows/auto.ts`, `flows/interactive.ts`에서 순수 로직 추출
3. `core/ai/` — 기존 `auto.ts`의 `generateWithAI`를 `client.ts`로 이동
4. `core/task/` — 기존 `features/taskflow/lib/`를 이동
5. `src/mcp/` — core를 MCP로 래핑
6. CLI 명령어들을 core 호출로 전환
7. `task prd` 명령어 제거 — init의 AI 브레인스토밍 플로우가 완전히 동작한 후에만 제거
8. 기존 `PrdResult`, `FeaturePrdResult` 등 중복 타입을 `core/types.ts`로 통합

기존 CLI 명령어들은 core 이동 전까지 현재 코드로 계속 동작한다.
