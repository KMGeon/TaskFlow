# 다음 태스크 추천

의존성과 우선순위를 기반으로 다음 작업할 태스크를 추천합니다.

## 사용 가능한 MCP 도구
- `mcp__taskflow__get_next_task` — 추천 태스크 조회
- `mcp__taskflow__read_task` — 태스크 상세 읽기
- `mcp__taskflow__set_task_status` — 태스크 상태 변경

## 워크플로우

1. `mcp__taskflow__get_next_task`로 추천 태스크 목록을 조회합니다.
2. 각 추천 태스크에 대해:
   - `mcp__taskflow__read_task`로 상세 정보를 읽습니다.
   - 추천 이유를 설명합니다 (의존성 해소됨, 높은 우선순위 등).
3. 사용자가 태스크를 선택하면 `mcp__taskflow__set_task_status`로 상태를 `in-progress`로 변경합니다.

## 규칙
- 한국어로 응답합니다.
- 추천 목록은 최대 3개까지 보여줍니다.
- 각 추천에 이유를 명확히 설명합니다.
