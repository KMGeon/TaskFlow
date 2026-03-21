# CLI Advisor (프로젝트 비서) 설계 문서

## 개요

CLI 내장 AI 비서로, 작업 맥락을 유지하면서 "지금 어디쯤이야?", "다음 뭐 해?" 같은 질문에 답변한다.

### 해결하는 문제

- 태스크가 많아서 뭐가 남았는지 헷갈림
- 작업 중간에 끊겼을 때 어디서부터 이어야 할지 모름
- 태스크 간 관계(선후관계)를 깜빡함
- 전체 진행률 감이 안 옴

---

## 명령어 구조

### `task status` — 로컬 진행률 + AI 한 줄 인사이트

- 로컬 계산: 태스크 상태별 개수, 진행률, 그룹핑 (빠름)
- AI 보강: 한 줄 인사이트 덧붙임
- 상태 표시 매핑: 코드 내부 `Todo` → 표시 `Todo`, `InProgress` → `In Progress`

```
📊 프로젝트 진행률: 3/7 (43%)

✅ Done (3)
  1. CLI list 아키텍처 재설계
  2. 출력 옵션/플래그 체계화
  3. 태스크 출력 포맷 개선

🔵 In Progress (1)
  4. 상태별 그룹핑

⬜ Todo (3)
  5. 세부 정보 표시 옵션
  6. 코드 품질 및 테스트 보강
  7. 사용성 개선

💡 UI 쪽 기반 작업은 다 끝났어요. 그룹핑만 마무리하면 후반부로 넘어갑니다.
```

### `task next` — AI 종합 추천 (기존 명령어 개선)

기존 `next` 명령어는 로컬 그래프 스코어링(`graph.ts` `recommend()`)으로 동작한다.
이를 AI 기반으로 업그레이드하되, 기존 로직을 폴백으로 보존한다.

- **AI 사용 가능 시:** AI가 태스크 목록 + TRD/PRD + 결정 기록을 종합 판단
- **AI 사용 불가 시 (API 키 없음, 에러):** 기존 `recommend()` 로컬 스코어링으로 폴백
- **기존 플래그 유지:** `--limit`, `--all`, `--include-blocked`, `--json`

```
👉 추천: #5 세부 정보 표시 옵션 추가
   이유: 그룹핑(#4)이 끝나면 상세 출력이 자연스럽게 이어짐.
   의존: #4 완료 필요
```

### `task ask "자유 질문"` — AI 자연어 대화

- 짧은 질문엔 짧게, 현황 질문엔 브리핑 형태로 자동 조절
- 코드 관련 질문 시 git diff도 참고

---

## 내부 아키텍처

### 디렉토리 구조

```
src/features/taskflow/
├── lib/
│   ├── repository.ts            # (기존) 태스크 CRUD — 마크다운
│   ├── advisor/                 # 비서 모듈
│   │   ├── context-builder.ts   # 데이터 수집기
│   │   ├── ai-advisor.ts        # AI 호출 + 응답 생성
│   │   ├── local-summary.ts     # 로컬 계산 (진행률, 그룹핑)
│   │   └── db.ts                # SQLite 연결 + 스키마
│   └── ...

src/cli/commands/
├── status.ts        # task status (신규 — index.ts에 등록 필요)
├── next.ts          # task next (기존 개선)
├── ask.ts           # task ask "..." (신규 — index.ts에 등록 필요)
└── ...
```

**CLI 등록:** `src/cli/index.ts`에 `registerStatusCommand`, `registerAskCommand` 추가 필요.

### 저장소 분리

| 데이터 | 저장소 | 이유 |
|--------|--------|------|
| 태스크 | `.taskflow/tasks/*.md` | 사람이 읽고 편집, git 추적 |
| 설정 | `.taskflow/config.json` | 사람이 편집 |
| 대화 로그 | `.taskflow/advisor.db` | 양 많음, 검색 필요, 비서 전용 |
| 결정 기록 | `.taskflow/advisor.db` | 검색 필요, 비서 전용 |

**`.gitignore`:** `.taskflow/` 전체가 이미 `.gitignore`에 포함되어 있으므로 `advisor.db`는 별도 추가 불필요.

### SQLite 테이블 구조

```sql
-- 대화 로그 (원본)
CREATE TABLE conversation_logs (
  id INTEGER PRIMARY KEY,
  session_type TEXT,        -- 'prd', 'trd', 'brainstorm', 'ask'
  session_id TEXT,          -- 세션 식별자
  role TEXT,                -- 'user', 'assistant'
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 결정 기록 (요약)
CREATE TABLE decisions (
  id INTEGER PRIMARY KEY,
  session_id TEXT,          -- 어떤 대화에서 나왔는지
  decision TEXT,            -- "인증은 MVP에서 제외"
  reason TEXT,              -- "핵심 기능에 집중"
  related_tasks TEXT,       -- 관련 태스크 ID들 (JSON)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX idx_conv_session ON conversation_logs(session_type, session_id);
CREATE INDEX idx_conv_created ON conversation_logs(created_at);
CREATE INDEX idx_decisions_session ON decisions(session_id);
```

### 의존성

```
sql.js    # 순수 WASM SQLite (네이티브 컴파일 불필요, 모든 OS에서 동일하게 동작)
```

> `better-sqlite3` 대신 `sql.js` 사용. 이유: `better-sqlite3`는 네이티브 C++ 모듈이라 node-gyp, Python, C++ 컴파일러가 필요하고 Windows/CI에서 문제가 될 수 있음. `sql.js`는 순수 WASM이라 `npm install`만으로 모든 환경에서 동작. 데이터 규모가 작아 성능 차이 무시 가능.

**`sql.js` 동작 방식:**
- DB 전체를 메모리에 로드하여 동작 (인메모리)
- SQL 읽기/쓰기는 모두 메모리 내에서 동기 처리 (빠름)
- 디스크 저장은 `db.export()` → `fs.writeFile()`로 별도 수행
- 파일 기반 WAL 모드는 지원하지 않음 (단일 프로세스 CLI이므로 동시 접근 이슈 없음)

### AI SDK

기존 프로젝트의 `@anthropic-ai/claude-agent-sdk` 패턴을 그대로 사용한다. `ai-advisor.ts`는 기존 AI 호출 패턴(brainstorm-flow, refine-ai 등)과 동일한 방식으로 SDK를 호출.

---

## 데이터 흐름

### `task status`

```
tasks/*.md → local-summary (로컬 계산) → 진행률 출력
  + TRD/PRD + decisions 테이블 → ai-advisor → 한 줄 인사이트 덧붙임
```

### `task next`

```
tasks/*.md + TRD/PRD + decisions 테이블 → ai-advisor → 추천 출력
(AI 실패 시) tasks/*.md → graph.ts recommend() → 로컬 추천 출력
```

### `task ask "..."`

```
질문 → context-builder 분류 → 필요한 데이터 수집 → ai-advisor → 응답 출력
```

---

## Context Builder 상세 설계

`context-builder.ts`는 질문을 분류하고 필요한 데이터만 수집한다.

### 인터페이스

```typescript
interface AdvisorContext {
  tasks: TaskSummary[];          // 항상 포함
  decisions: Decision[];          // 항상 포함
  trdContent?: string;            // next, ask(프로젝트 관련 질문)
  prdContent?: string;            // next, ask(프로젝트 관련 질문)
  gitDiff?: string;               // ask(코드 관련 질문)
  conversationLogs?: ConvLog[];   // ask(이전 대화 참조)
}

function buildContext(
  command: 'status' | 'next' | 'ask',
  question?: string
): AdvisorContext
```

### 질문 분류 로직 (`task ask` 전용)

키워드 매칭으로 분류한다 (별도 AI 호출 없음):

| 키워드 | 추가 수집 데이터 |
|--------|-----------------|
| `코드`, `git`, `커밋`, `변경`, `diff` | git diff (최근 커밋) |
| `왜`, `이유`, `결정`, `배경` | conversation_logs (관련 세션) |
| `계획`, `전체`, `목표`, `방향` | TRD/PRD 전문 |
| 해당 없음 | 기본 (태스크 + 결정 기록만) |

### 토큰 카운팅

토큰 예산 초과 여부는 문자 수 기반 근사치로 판단한다 (`문자 수 / 4 ≈ 토큰 수`).
별도 토큰나이저 라이브러리는 도입하지 않음 — 정밀도보다 단순함 우선.

### 토큰 예산

| 명령어 | 최대 토큰 | 초과 시 |
|--------|----------|---------|
| status | 4,000 | 결정 기록 최근 10개만 |
| next | 8,000 | TRD/PRD 요약본 사용, 결정 기록 최근 20개만 |
| ask | 12,000 | 오래된 로그/결정 잘라냄, git diff는 변경 파일 목록만 |

---

## AI 프롬프트 전략

### 명령어별 프롬프트 구성

**`task status` — 한 줄 인사이트**

```
[시스템] 너는 프로젝트 비서야. 현황을 보고 한 줄 인사이트를 줘.
[컨텍스트]
- 진행률: 3/7 (43%)
- 완료: #1, #2, #3
- 진행중: #4
- 결정 기록: (decisions 테이블에서)
- TRD 목표: (TRD에서 요약)
[요청] 한 줄로 현재 상황에 대한 인사이트를 줘.
```

**`task next` — 추천**

```
[시스템] 너는 프로젝트 비서야. 다음에 할 태스크를 추천해.
[컨텍스트]
- 전체 태스크 목록 (상태, 의존성, 난이도, 긴급도)
- 결정 기록
- TRD/PRD 요약
[요청] 다음에 할 태스크 1개 추천 + 이유. 짧게.
```

**`task ask` — 자연어 대화**

```
[시스템] 너는 프로젝트 비서야. 질문에 맞게 답변해.
짧은 질문이면 짧게, 현황 질문이면 브리핑 형태로.
[컨텍스트]
- 태스크 목록 + TRD/PRD + 결정 기록
- (코드 관련 질문이면) 최근 git diff
- (이전 대화 참조하면) conversation_logs에서 관련 내용
[질문] 사용자 입력
```

---

## 대화 로그 & 결정 기록 수집

### 대화 로그 자동 저장

| CLI 명령어 | 저장 여부 | 이유 |
|-----------|----------|------|
| `task prd` | ✅ | AI 대화 있음 |
| `task parse-prd` | ✅ | 파싱 과정 |
| `task brainstorm` | ✅ | AI 대화 있음 |
| `task refine` | ✅ | 요구사항 변경 대화 |
| `task ask "..."` | ✅ | 질문과 응답 |
| `task list`, `task status` | ❌ | 단순 조회 |
| `task set-status` | ❌ | 단순 상태 변경 |

**규칙:** AI와 대화가 오가는 명령어만 저장.

### 기존 로그 시스템 마이그레이션

현재 `brainstorm-flow.ts`가 `.taskflow/logs/brainstorm-*.json`으로, `refine-logger.ts`가 별도 JSON 로그를 저장하고 있다.

**마이그레이션 전략:**
1. 신규 모듈(`ask`, `status`)은 처음부터 SQLite로 저장
2. 기존 모듈(`brainstorm`, `refine`)은 기존 JSON 로그 유지 + SQLite에도 이중 저장
3. 안정화 후 기존 JSON 로그 모듈을 SQLite 단일화로 리팩토링
4. 기존 JSON 로그 파일은 별도 임포트하지 않음 (7일 보관이라 자연 소멸)

### 결정 기록 자동 생성

**추출 시점:** AI 대화 세션이 정상 종료될 때 (사용자가 확인 응답을 한 후)
- `task brainstorm` → 사용자가 "좋아", "그걸로 하자" 등 확인 후 세션 종료 시
- `task refine` → 변경 사항 적용 완료 시
- `task prd` → PRD 작성 완료 시
- Ctrl+C 등 비정상 종료 시에는 결정 기록 생성하지 않음

**추출 프롬프트:**
```
[시스템] 아래 대화에서 사용자가 명시적으로 승인한 결정 사항만 추출해.
추측이나 논의 중인 내용은 제외.
[대화 내용] (conversation_logs에서)
[출력 형식] JSON: { decision, reason, related_tasks[] }
```

**검증:** `related_tasks`는 현재 태스크 목록의 ID와 매칭하여 존재하는 것만 포함.

```
사용자: task brainstorm #5
... (대화 진행) ...
사용자: 좋아 그걸로 하자

→ conversation_logs에 대화 전체 저장
→ AI가 확인된 결정만 추출 → decisions에 저장:
  decision: "세부 정보는 --detail 플래그로 토글"
  reason: "기본 출력은 깔끔하게 유지하기 위해"
  related_tasks: ["5"]
```

### 용량 관리

- 대화 로그: **7일 이후 자동 삭제** (설정 변경 가능)
- 결정 기록: **영구 보관** (가벼움)
- 수동 정리: `task advisor --cleanup` 명령어로 만료 로그 즉시 삭제

### `task advisor` 서브커맨드

```
src/cli/commands/
├── advisor.ts       # task advisor (신규 — index.ts에 등록 필요)
```

`task advisor`는 비서 관리용 유틸리티 명령어:
- `task advisor --cleanup` — 만료된 대화 로그 즉시 삭제
- `task advisor --stats` — DB 통계 (로그 수, 결정 수, DB 크기)
- 향후 확장 가능 (예: `--export`, `--reset`)

---

## DB 쓰기 전략

`sql.js`는 비동기 지원이 가능하나, DB 쓰기 자체가 매우 가볍다 (로그 한 줄 INSERT).

### 처리 규칙

| 작업 | 처리 방식 | 이유 |
|------|----------|------|
| 태스크 읽기 (마크다운) | 동기 | 출력에 필요 |
| DB 읽기 (decisions, logs) | 동기 | AI 컨텍스트에 필요 |
| **디스크 저장 (db.export → writeFile)** | **비동기 (fire-and-forget)** | SQL INSERT는 인메모리라 즉시 완료, 디스크 영속화만 비동기 |
| AI 호출 | 동기 | 응답 자체가 목적 |

디스크 저장 실패 시 콘솔에 경고만 남기고 무시. 태스크 데이터는 마크다운에 있으므로 치명적이지 않음. 다음 DB 쓰기 시 재시도됨 (인메모리 데이터는 유지).

---

## 에러 처리 & 엣지 케이스

### AI 호출 실패 시

| 상황 | 대응 |
|------|------|
| API 타임아웃/에러 | `task status` → 로컬 진행률만 출력 + "💡 인사이트 생성 실패" 표시 |
| | `task next` → 기존 `recommend()` 로컬 스코어링으로 폴백 |
| | `task ask` → "AI 연결 실패. 잠시 후 다시 시도해주세요" |
| API 키 없음 | `task status` → 로컬 진행률만 출력 (AI 없이 동작) |
| | `task next` → 기존 `recommend()` 로컬 스코어링으로 폴백 |
| | `task ask` → "AI 기능을 사용하려면 API 키를 설정하세요" |

### 데이터 없을 때

| 상황 | 대응 |
|------|------|
| 태스크 0개 | "태스크가 없습니다. `task parse-prd`로 시작하세요" |
| TRD/PRD 없음 | AI가 태스크 목록 + 결정 기록만으로 판단 |
| 결정 기록 0개 | 정상 동작 — 참고할 맥락이 적을 뿐 |
| advisor.db 없음 | 첫 AI 명령어 실행 시 자동 생성 |

### SQLite 관련

| 상황 | 대응 |
|------|------|
| DB 파일 손상 | 자동 재생성 + 경고 메시지 (태스크는 마크다운이라 무사) |
| 동시 접근 | 단일 프로세스 CLI이므로 해당 없음. sql.js는 인메모리 동작이라 프로세스 간 동시 접근 불가 |
