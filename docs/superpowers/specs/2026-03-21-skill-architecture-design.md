# TaskFlow 스킬 아키텍처 설계

## 1. 배경 및 목적

### 현재 문제
- CLI 명령어가 과도하게 많고 옵션이 복잡함 (특히 `refine`은 옵션 10개)
- `brainstorm_prd`, `brainstorm_task` 등 MCP 도구가 내부에서 Claude API를 이중 호출
- Claude Code 자체가 AI인데, MCP 안에서 또 AI를 호출하는 건 토큰 낭비 + 응답 지연

### 새 방향
Claude Code 스킬 프롬프트가 워크플로우를 안내하고, MCP는 순수 데이터 접근만 담당한다.

```
사용자 → Claude Code (스킬이 워크플로우 안내)
              │
              ├→ MCP 데이터 도구 (읽기/쓰기)
              └→ Claude Code 자체가 AI (대화/분석/생성)
```

## 2. 아키텍처

### 계층 분리

| 계층 | 역할 | AI 호출 |
|---|---|---|
| **스킬 프롬프트** (`.taskflow/.claude/commands/`) | 워크플로우 오케스트레이션 | Claude Code 자체 |
| **MCP 도구** (`src/mcp/`) | 순수 데이터 접근 (CRUD, 파일 저장, 코드 스캔) | 없음 |
| **Core** (`src/core/`) | 비즈니스 로직 | 없음 (AI 클라이언트 제거) |

### 파일 위치 및 심볼릭 링크

```
.taskflow/.claude/commands/       ← 원본 (TaskFlow가 관리)
    ├── prd.md
    ├── trd.md
    ├── parse-prd.md
    ├── brainstorm.md
    ├── refine.md
    ├── next.md
    └── task-status.md

.claude/commands/                 ← task init이 심볼릭 링크 생성
    ├── prd.md → ../../.taskflow/.claude/commands/prd.md
    ├── trd.md → ../../.taskflow/.claude/commands/trd.md
    ├── parse-prd.md → ../../.taskflow/.claude/commands/parse-prd.md
    ├── brainstorm.md → ../../.taskflow/.claude/commands/brainstorm.md
    ├── refine.md → ../../.taskflow/.claude/commands/refine.md
    ├── next.md → ../../.taskflow/.claude/commands/next.md
    └── task-status.md → ../../.taskflow/.claude/commands/task-status.md
```

> **네이밍 충돌 주의:** 사용자가 `.claude/commands/`에 같은 이름의 파일을 가지고 있을 경우 `task init`은 해당 링크를 스킵한다. 필요시 `tf-` 접두사(예: `tf-prd.md`)로 변경 가능하지만, 일단 짧은 이름으로 시작한다.

- 수정/삭제는 `.taskflow/.claude/commands/`에서만 수행
- `.claude/commands/`의 심볼릭 링크가 자동으로 반영
- `task init`이 링크 생성을 담당

## 3. MCP 도구 변경

### 전체 도구 대조표

현재 17개 도구 → 정리 후 14개 도구 (제거 6, 신규 3)

| 현재 도구 | 처리 | 비고 |
|---|---|---|
| `initialize_project` | **유지** | 순수 데이터 |
| `generate_claude_md` | **유지 + 수정** | 새 도구 목록/스킬 커맨드 반영 필요 |
| `generate_prd` | **제거** | `/prd` 스킬이 대체 |
| `brainstorm_prd` | **제거** | `/prd` 스킬이 대체 |
| `auto_analyze_prd` | **제거** | `scan_codebase`로 대체 (AI 호출 제거) |
| `generate_feature_prd` | **제거** | `/prd` 스킬에서 처리 |
| `parse_prd` | **제거** | `/parse-prd` 스킬이 대체 |
| `list_tasks` | **유지** | 순수 데이터 |
| `read_task` | **유지** | 순수 데이터 |
| `create_task` | **유지** | 순수 데이터 |
| `update_task` | **유지** | 순수 데이터 |
| `delete_task` | **유지** | 순수 데이터 |
| `set_task_status` | **유지** | 순수 데이터 |
| `get_next_task` | **유지** | 순수 데이터 |
| `brainstorm_task` | **제거** | `/brainstorm` 스킬이 대체 |
| `expand_subtasks` | **유지** | 파일 생성만 (AI 없음) |
| `refine_tasks` | **제거** | `/refine` 스킬이 대체 |

### 신규 도구

#### `scan_codebase`
코드베이스를 스캔하여 파일 목록과 시그니처를 반환한다. AI 분석 없음.
- 내부 구현: `auto-analyzer.ts`의 `scanFiles()` + `sampleFiles()` 호출 (순수 함수)
- 반환: `{ files: string[], samples: { path: string, content: string, truncated: boolean }[], projectName: string }`

#### `save_prd`
PRD 마크다운을 `.taskflow/prd.md`에 저장한다.
- 내부 구현: 기존 `savePrd()` 함수 재사용
- 입력: `{ markdown: string }`

#### `read_prd`
`.taskflow/prd.md`를 읽어서 반환한다.
- 반환: `{ content: string }` (파일이 없으면 에러)

### 유지 도구 (10개)
- `initialize_project` — 프로젝트 초기화
- `generate_claude_md` — CLAUDE.md 재생성 (새 도구/스킬 목록 반영하도록 수정 필요)
- `list_tasks` — 태스크 목록 조회
- `read_task` — 태스크 상세 조회
- `create_task` — 태스크 생성
- `update_task` — 태스크 수정
- `delete_task` — 태스크 삭제
- `set_task_status` — 상태 변경
- `get_next_task` — 다음 태스크 추천
- `expand_subtasks` — 서브태스크 파일 생성

### 제거 대상 코드
- `src/core/ai/client.ts` — `askClaude()`, `askClaudeWithRetry()`, `brainstormTask()` 전부 제거
- `@anthropic-ai/claude-agent-sdk` 의존성 제거
- `src/core/prd/generator.ts` — `startBrainstorm()`, `continueBrainstorm()`, `buildPrdMarkdown()` 제거. `savePrd()` 유지
- `src/mcp/tools/prd.ts` — `generate_prd`, `brainstorm_prd`, `auto_analyze_prd`, `generate_feature_prd` 제거
- `src/mcp/tools/brainstorm.ts` — `brainstorm_task` 제거, `expand_subtasks` 유지
- `src/mcp/tools/refine.ts` — `refine_tasks` 제거 (파일 자체 삭제)
- `src/mcp/tools/parse.ts` — `parse_prd` 제거 (파일 자체 삭제)

> **참고:** `buildPrdMarkdown()`도 제거 대상. 스킬이 Claude Code에게 직접 마크다운을 생성하게 하므로 구조화된 `PrdData` 객체를 마크다운으로 변환하는 함수는 불필요.

## 4. 스킬 설계

### 4.1 `/prd` — PRD 생성

```markdown
사용자와 대화하며 PRD를 작성합니다.

## MCP 도구
- `mcp__taskflow__scan_codebase` — 코드베이스 분석
- `mcp__taskflow__save_prd` — PRD 저장

## 워크플로우
1. `scan_codebase`로 현재 프로젝트 상태 파악
2. 사용자에게 한 번에 하나씩 질문 (한국어):
   - 프로젝트명, 요약, 타겟 사용자, 문제/솔루션
   - 목표/지표, 사용 시나리오, 필수/선택 기능
   - 비기능 요구사항, 기술 스택, 범위, 마일스톤, 리스크
3. 충분히 수집되면 PRD 마크다운 작성
4. 사용자 확인 후 `save_prd`로 저장

## PRD 형식
11개 섹션: 제품 개요, 타겟 사용자, 문제/솔루션, 목표/지표,
시나리오, 기능 요구사항(표), 비기능 요구사항, 기술 스택,
범위, 마일스톤, 리스크
```

### 4.2 `/trd` — TRD(Task Implementation Plan) 생성

```markdown
PRD를 기반으로 TRD(구현 계획)를 작성합니다.

## MCP 도구
- `mcp__taskflow__read_prd` — PRD 읽기
- `mcp__taskflow__list_tasks` — 기존 태스크 확인

## 워크플로우
1. `read_prd`로 PRD 읽기
2. PRD를 분석하여 구현 단계별 TRD 작성
3. 각 단계의 기술적 결정사항, 의존성, 리스크 정리
4. 사용자 확인 후 Claude Code의 Write 도구로 `.taskflow/trd.md`에 저장

> TRD 저장은 MCP 도구 없이 Claude Code의 빌트인 Write 도구를 사용한다.
```

### 4.3 `/parse-prd` — PRD → 태스크 분해

```markdown
PRD를 분석하여 태스크를 자동 생성합니다.

## MCP 도구
- `mcp__taskflow__read_prd` — PRD 읽기
- `mcp__taskflow__list_tasks` — 기존 태스크 확인 (중복 방지)
- `mcp__taskflow__create_task` — 태스크 생성

## 워크플로우
1. `read_prd`로 PRD 읽기
2. `list_tasks`로 기존 태스크 확인 (중복 방지)
3. PRD를 분석하여 최상위 태스크 목록 도출
4. 각 태스크의 제목, 설명, 우선순위, 의존성 정리
5. 사용자에게 목록 확인
6. 승인 후 `create_task`로 하나씩 생성
```

### 4.4 `/brainstorm` — 태스크 브레인스토밍

```markdown
태스크를 서브태스크로 분해합니다.

## MCP 도구
- `mcp__taskflow__read_task` — 태스크 읽기
- `mcp__taskflow__list_tasks` — 전체 태스크 맥락 파악
- `mcp__taskflow__expand_subtasks` — 서브태스크 파일 생성

## 워크플로우
1. 사용자에게 분해할 태스크 ID 확인 (또는 `list_tasks`로 선택)
2. `read_task`로 태스크 상세 읽기
3. 사용자와 대화하며 분해 방향 논의
4. 서브태스크 목록 제안
5. 사용자 확인 후 `expand_subtasks`로 생성
```

### 4.5 `/refine` — 요구사항 변경 분석

```markdown
요구사항 변경이 기존 태스크에 미치는 영향을 분석합니다.

## MCP 도구
- `mcp__taskflow__read_prd` — 현재 PRD 읽기
- `mcp__taskflow__list_tasks` — 전체 태스크 조회
- `mcp__taskflow__read_task` — 개별 태스크 읽기
- `mcp__taskflow__update_task` — 태스크 수정
- `mcp__taskflow__save_prd` — PRD 업데이트

## 워크플로우
1. 사용자에게 변경사항 확인 (대화 또는 파일 diff)
2. `read_prd` + `list_tasks`로 현재 상태 파악
3. 영향 받는 태스크 식별 및 변경 방안 제안
4. 사용자 확인 후 `update_task`로 수정
5. 필요시 PRD도 업데이트
```

### 4.6 `/next` — 다음 태스크 추천

```markdown
다음으로 작업할 태스크를 추천합니다.

## MCP 도구
- `mcp__taskflow__get_next_task` — 추천 태스크 조회
- `mcp__taskflow__read_task` — 상세 정보 읽기
- `mcp__taskflow__set_task_status` — 상태 변경

## 워크플로우
1. `get_next_task`로 추천 목록 조회
2. 각 태스크의 이유(의존성 해소, 우선순위)를 설명
3. 사용자가 선택하면 `set_task_status`로 in-progress 변경
```

### 4.7 `/task-status` — 진행 상황 요약

```markdown
현재 프로젝트 태스크 진행 상황을 요약합니다.

## MCP 도구
- `mcp__taskflow__list_tasks` — 전체 태스크 조회

## 워크플로우
1. `list_tasks`로 전체 태스크 조회
2. 상태별 개수, 완료율, 블로커 등 요약
3. 주요 이슈나 지연된 태스크 하이라이트
```

## 5. task init 변경사항

기존 `task init` 플로우에 추가:

```
task init
  ├─ (기존) .taskflow/ 디렉토리 생성
  ├─ (기존) .mcp.json 생성
  ├─ (기존) PRD 생성
  ├─ (기존) .taskflow/CLAUDE.md 생성
  ├─ (기존) 루트 CLAUDE.md에 import 추가
  ├─ (신규) .taskflow/.claude/commands/ 에 스킬 파일 생성
  └─ (신규) .claude/commands/ 에 심볼릭 링크 생성
```

### 심볼릭 링크 생성 로직

```typescript
// src/core/project/skill-setup.ts
import fs from "node:fs/promises";
import path from "node:path";

const SKILLS = ["prd", "trd", "parse-prd", "brainstorm", "refine", "next", "task-status"];

export async function installSkills(projectRoot: string): Promise<void> {
  const srcDir = path.join(projectRoot, ".taskflow", ".claude", "commands");
  const destDir = path.join(projectRoot, ".claude", "commands");

  await fs.mkdir(srcDir, { recursive: true });
  await fs.mkdir(destDir, { recursive: true });

  for (const skill of SKILLS) {
    const srcFile = path.join(srcDir, `${skill}.md`);
    const destFile = path.join(destDir, `${skill}.md`);

    // 원본이 존재하는지 확인
    try { await fs.access(srcFile); } catch { continue; }

    // 기존 링크/파일이 있으면 스킵
    try { await fs.lstat(destFile); continue; } catch { /* 없으면 생성 */ }

    const relativePath = path.relative(destDir, srcFile);
    await fs.symlink(relativePath, destFile);
  }
}
```

## 6. 점진적 전환 계획

### Phase 1: 스킬 생성 + MCP 정리
1. `.taskflow/.claude/commands/`에 7개 스킬 프롬프트 작성
2. `task init`에 스킬 설치 + 심볼릭 링크 로직 추가
3. MCP에서 AI 호출 도구 제거, 순수 데이터 도구로 정리
4. `src/core/ai/client.ts` 제거, `@anthropic-ai/claude-agent-sdk` 의존성 제거

### Phase 2: 스킬 검증
5. 각 스킬을 Claude Code에서 실행하며 프롬프트 다듬기
6. MCP 데이터 도구가 스킬과 잘 연동되는지 확인

### Phase 3: CLI 정리
7. AI 워크플로우 CLI 커맨드 제거 (parse-prd, brainstorm, expand, refine)
8. CLI는 `task init`, `task list`, `task show`, `task status` 등 유틸리티만 남김

## 7. 최종 구조

```
.taskflow/
├── .claude/
│   └── commands/              ← 스킬 원본
│       ├── prd.md
│       ├── trd.md
│       ├── parse-prd.md
│       ├── brainstorm.md
│       ├── refine.md
│       ├── next.md
│       └── task-status.md
├── config.json
├── prd.md
├── trd.md
├── tasks/
│   └── task-{NNN}.md
├── index/
├── logs/
└── CLAUDE.md

.claude/
└── commands/                  ← 심볼릭 링크
    ├── prd.md → ../../.taskflow/.claude/commands/prd.md
    ├── trd.md → ...
    ├── parse-prd.md → ...
    ├── brainstorm.md → ...
    ├── refine.md → ...
    ├── next.md → ...
    └── task-status.md → ...

src/
├── core/                      ← 순수 비즈니스 로직 (AI 호출 없음)
│   ├── project/
│   ├── prd/                   ← buildPrdMarkdown(), savePrd()만 유지
│   └── task/
├── mcp/                       ← 순수 데이터 도구만
│   └── tools/
│       ├── project.ts
│       ├── task.ts
│       ├── task-status.ts
│       ├── prd.ts             ← save_prd, read_prd, scan_codebase
│       └── (brainstorm.ts → expand_subtasks만 유지)
└── cli/                       ← 유틸리티만 (init, list, show, status)
```
