# 요구사항 변경 분석

요구사항 변경이 기존 태스크에 미치는 영향을 분석하고 업데이트합니다.

## 사용 가능한 MCP 도구
- `mcp__taskflow__read_prd` — 현재 PRD 읽기
- `mcp__taskflow__list_tasks` — 전체 태스크 조회
- `mcp__taskflow__read_task` — 개별 태스크 읽기
- `mcp__taskflow__update_task` — 태스크 수정
- `mcp__taskflow__create_task` — 새 태스크 생성
- `mcp__taskflow__delete_task` — 불필요한 태스크 삭제
- `mcp__taskflow__save_prd` — PRD 업데이트

## 워크플로우

1. 사용자에게 변경사항을 확인합니다:
   - 어떤 요구사항이 바뀌었는지 설명을 듣거나
   - 변경된 파일/diff를 확인합니다
2. `mcp__taskflow__read_prd`로 현재 PRD를 읽습니다.
3. `mcp__taskflow__list_tasks`로 전체 태스크를 조회합니다.
4. 변경사항이 영향을 미치는 태스크를 식별합니다:
   - 수정이 필요한 태스크
   - 새로 추가해야 할 태스크
   - 더 이상 필요 없는 태스크
5. 영향 분석 결과를 사용자에게 표로 보여줍니다.
6. 사용자 승인 후:
   - `mcp__taskflow__update_task`로 수정
   - `mcp__taskflow__create_task`로 추가
   - `mcp__taskflow__delete_task`로 삭제
7. 필요시 `mcp__taskflow__save_prd`로 PRD도 업데이트합니다.

## 규칙
- 한국어로 작성합니다.
- 변경 전/후를 명확히 대비하여 보여줍니다.
- 반드시 사용자 승인 후 수정합니다.
