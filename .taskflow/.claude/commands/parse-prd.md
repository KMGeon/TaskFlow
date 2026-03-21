# PRD → 태스크 분해

PRD를 분석하여 개별 태스크 파일을 자동 생성합니다.

## 사용 가능한 MCP 도구
- `mcp__taskflow__read_prd` — .taskflow/prd.md 읽기
- `mcp__taskflow__list_tasks` — 기존 태스크 확인 (중복 방지)
- `mcp__taskflow__create_task` — 태스크 생성

## 워크플로우

1. `mcp__taskflow__read_prd`로 PRD를 읽습니다.
2. `mcp__taskflow__list_tasks`로 기존 태스크를 확인합니다.
3. PRD의 기능 요구사항을 분석하여 태스크 목록을 도출합니다:
   - 각 태스크의 제목, 설명, 우선순위
   - 태스크 간 의존성
   - 예상 복잡도
4. 도출된 태스크 목록을 사용자에게 보여주고 확인을 받습니다.
5. 승인 후 `mcp__taskflow__create_task`로 하나씩 생성합니다.
6. 생성 결과를 요약하여 보여줍니다.

## 태스크 분해 기준
- Must-Have 기능 → 높은 우선순위 태스크
- Nice-to-Have 기능 → 낮은 우선순위 태스크
- 하나의 기능이 크면 여러 태스크로 분할
- 의존성이 있으면 dependencies에 명시
- 기존 태스크와 중복되면 스킵

## 규칙
- 한국어로 작성합니다.
- 태스크 하나는 1~2일 이내에 완료할 수 있는 크기로 분할합니다.
- 분해 결과를 보여주고 반드시 사용자 승인을 받은 후 생성합니다.
