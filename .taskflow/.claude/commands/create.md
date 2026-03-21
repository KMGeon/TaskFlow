# 기능 생성 (TRD + Task 분해)

대화를 통해 하나의 기능 요구사항을 정의하고, TRD(Task Implementation Plan)를 작성한 뒤, 디테일한 태스크로 분해합니다.

## 사용 가능한 MCP 도구
- `mcp__taskflow__scan_codebase` — 코드베이스 파일 목록/시그니처 스캔
- `mcp__taskflow__list_tasks` — 기존 태스크 확인 (중복 방지)
- `mcp__taskflow__create_task` — 태스크 생성
- `mcp__taskflow__read_prd` — PRD 읽기 (있으면 참고)

## 워크플로우

### Phase 1: 요구사항 수집
1. `mcp__taskflow__scan_codebase`로 현재 프로젝트 상태를 파악합니다.
2. 기존 PRD가 있으면 `mcp__taskflow__read_prd`로 읽어서 맥락을 파악합니다.
3. 사용자에게 **한 번에 하나씩** 질문하며 요구사항을 수집합니다:
   - 어떤 기능을 만들고 싶은지
   - 사용자 시나리오 (누가, 언제, 어떻게 사용하는지)
   - 기술적 제약사항
   - 성공 기준
   - 우선순위

### Phase 2: TRD 작성
충분한 정보가 모이면 다음 형식으로 TRD를 작성합니다:

```markdown
# {기능명} — Task Implementation Plan

## Goal
(한 문장으로 목표 요약)

## Task List

### 1. {태스크 제목}
- **Description:** (상세 설명)
- **Importance:** MUST / SHOULD / COULD
- **Expected Complexity:** (1-10)
- **Expected Urgency:** (1-10)

### 2. {태스크 제목}
- **Description:** ...
- **Importance:** ...
- **Expected Complexity:** ...
- **Expected Urgency:** ...

(반복)

## Implementation Order Suggestion
1. {태스크 제목}
2. {태스크 제목}
...

## Considerations
- (기술적/비즈니스 고려사항)
- (보안, 성능, 호환성 등)
```

TRD 작성 후 사용자에게 확인을 받습니다.

### Phase 3: 태스크 생성
1. `mcp__taskflow__list_tasks`로 기존 태스크를 확인합니다 (중복 방지).
2. 사용자 승인 후 `mcp__taskflow__create_task`로 각 태스크를 생성합니다:
   - title: 태스크 제목
   - description: 상세 설명 + Importance/Complexity/Urgency 포함
   - priority: Urgency 값 (1-10)
   - dependencies: Implementation Order 기반으로 의존성 설정
3. Write 도구로 `.taskflow/trd-{feature}.md`에 TRD를 저장합니다.

## 태스크 분해 기준
- 각 태스크는 4시간 이내에 완료 가능한 크기
- MUST 항목을 먼저, SHOULD/COULD 순서로 배치
- 태스크 간 의존성을 Implementation Order로 명시
- 기존 태스크와 중복되면 스킵
- 최소 3개, 최대 15개로 분해

## 규칙
- 한국어로 대화합니다.
- 한 번에 하나의 질문만 합니다.
- 가능하면 객관식으로 제시합니다.
- 모호한 답변이면 구체적으로 되물어봅니다.
- TRD와 태스크 목록은 반드시 사용자 승인 후 저장/생성합니다.
