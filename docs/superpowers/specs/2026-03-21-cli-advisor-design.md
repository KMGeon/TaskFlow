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

```
📊 프로젝트 진행률: 3/7 (43%)

✅ Done (3)
  1. CLI list 아키텍처 재설계
  2. 출력 옵션/플래그 체계화
  3. 태스크 출력 포맷 개선

🔵 In Progress (1)
  4. 상태별 그룹핑

⬜ Pending (3)
  5. 세부 정보 표시 옵션
  6. 코드 품질 및 테스트 보강
  7. 사용성 개선

💡 UI 쪽 기반 작업은 다 끝났어요. 그룹핑만 마무리하면 후반부로 넘어갑니다.
```

### `task next` — AI 종합 추천

- AI가 태스크 목록 + TRD/PRD + 결정 기록을 읽고 종합 추천
- 의존성 + 난이도 + 긴급도 + 진행률 + 컨텍스트 종합 판단

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
├── status.ts        # task status
├── next.ts          # task next (기존 개선)
├── ask.ts           # task ask "..."
└── ...
```

### 저장소 분리

| 데이터 | 저장소 | 이유 |
|--------|--------|------|
| 태스크 | `.taskflow/tasks/*.md` | 사람이 읽고 편집, git 추적 |
| 설정 | `.taskflow/config.json` | 사람이 편집 |
| 대화 로그 | `.taskflow/advisor.db` | 양 많음, 검색 필요, 비서 전용 |
| 결정 기록 | `.taskflow/advisor.db` | 검색 필요, 비서 전용 |

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
```

### 의존성

```
better-sqlite3    # SQLite 드라이버 (서버 불필요, 파일 하나로 동작)
```

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
```

### `task ask "..."`

```
질문 분석 → context-builder가 필요한 데이터만 수집
  (태스크 + TRD/PRD + decisions + 필요시 conversation_logs/git diff)
  → ai-advisor → 응답 출력
```

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

### 토큰 절약 전략

| 명령어 | 항상 포함 | 필요시 포함 |
|--------|----------|------------|
| status | 태스크 요약, 결정 기록 | - |
| next | 태스크 전체, TRD/PRD, 결정 기록 | - |
| ask | 태스크 요약, 결정 기록 | 대화 로그, git diff, TRD/PRD 전문 |

`ask`에서 context-builder가 질문을 먼저 분석해서 필요한 데이터만 가져옴.

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

### 결정 기록 자동 생성

AI 대화 세션이 끝날 때 자동으로 핵심 결정을 요약하여 decisions 테이블에 저장.

```
사용자: task brainstorm #5
... (대화 진행) ...
사용자: 좋아 그걸로 하자

→ conversation_logs에 대화 전체 저장
→ AI가 자동 요약 → decisions에 저장:
  decision: "세부 정보는 --detail 플래그로 토글"
  reason: "기본 출력은 깔끔하게 유지하기 위해"
  related_tasks: ["5"]
```

### 용량 관리

- 대화 로그: **7일 이후 자동 삭제** (설정 변경 가능)
- 결정 기록: **영구 보관** (가벼움)
- `task ask "로그 정리해줘"`로 수동 정리 가능

---

## 비동기 처리 전략

### 동기/비동기 규칙

| 작업 | 동기/비동기 | 이유 |
|------|-----------|------|
| 태스크 읽기 (마크다운) | 동기 | 출력에 필요 |
| DB 읽기 (decisions, logs) | 동기 | AI 컨텍스트에 필요 |
| **DB 쓰기 (로그 저장)** | **비동기** | 사용자 응답과 무관 |
| **DB 쓰기 (결정 요약)** | **비동기** | 사용자 응답과 무관 |
| AI 호출 | 동기 | 응답 자체가 목적 |

비동기 저장 실패 시 콘솔에 경고만 남기고 무시. 태스크 데이터는 마크다운에 있으므로 치명적이지 않음.

---

## 에러 처리 & 엣지 케이스

### AI 호출 실패 시

| 상황 | 대응 |
|------|------|
| API 타임아웃/에러 | `task status` → 로컬 진행률만 출력 + "💡 인사이트 생성 실패" 표시 |
| | `task next` → "추천을 생성할 수 없습니다. task status로 현황을 확인하세요" |
| | `task ask` → "AI 연결 실패. 잠시 후 다시 시도해주세요" |
| API 키 없음 | `task status` → 로컬 진행률만 출력 (AI 없이 동작) |
| | `task next`, `task ask` → "AI 기능을 사용하려면 API 키를 설정하세요" |

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
| 동시 접근 | SQLite WAL 모드로 읽기/쓰기 동시 가능 |
