export const SKILL_TEMPLATES: Record<string, string> = {
  prd: `# PRD 생성

사용자와 대화하며 PRD(Product Requirements Document)를 작성합니다.

## 사용 가능한 MCP 도구
- \`mcp__taskflow__scan_codebase\` — 코드베이스 파일 목록/시그니처 스캔
- \`mcp__taskflow__save_prd\` — PRD를 .taskflow/prd.md에 저장

## 워크플로우

1. 먼저 \`mcp__taskflow__scan_codebase\`로 현재 프로젝트 상태를 파악합니다.
2. 사용자에게 **한 번에 하나씩** 질문하며 요구사항을 수집합니다:
   - 프로젝트명, 한 줄 요약
   - 타겟 사용자
   - 해결하려는 문제 (Pain Points)와 해결 방안
   - 목표 및 핵심 지표 (KPI)
   - 주요 사용 시나리오
   - 필수 기능 (Must-Have)과 선택 기능 (Nice-to-Have)
   - 비기능 요구사항 (성능, 보안 등)
   - 기술 스택
   - 범위 (포함/제외)
   - 마일스톤
   - 리스크 및 완화 전략
3. 충분한 정보가 모이면 PRD 마크다운을 작성합니다.
4. 사용자에게 최종 확인을 받은 후 \`mcp__taskflow__save_prd\`로 저장합니다.

## PRD 형식

다음 11개 섹션을 포함하는 마크다운으로 작성합니다:

1. 제품 개요
2. 타겟 사용자
3. 해결하려는 문제 및 솔루션 (표)
4. 목표 및 핵심 지표
5. 주요 사용 시나리오
6. 기능 요구사항 (표: #, 기능, 우선순위)
7. 비기능 요구사항
8. 기술 스택
9. 범위 (포함/제외)
10. 마일스톤
11. 리스크 및 완화 전략

## 규칙
- 한국어로 작성합니다.
- 한 번에 하나의 질문만 합니다.
- 가능하면 객관식으로 제시합니다.
- 사용자의 답변이 모호하면 구체적으로 되물어봅니다.
`,
  trd: `# TRD 생성 (Task Implementation Plan)

PRD를 기반으로 기술적 구현 계획(TRD)을 작성합니다.

## 사용 가능한 MCP 도구
- \`mcp__taskflow__read_prd\` — .taskflow/prd.md 읽기
- \`mcp__taskflow__list_tasks\` — 기존 태스크 목록 확인

## 워크플로우

1. \`mcp__taskflow__read_prd\`로 PRD를 읽습니다.
2. \`mcp__taskflow__list_tasks\`로 기존 태스크가 있는지 확인합니다.
3. PRD를 분석하여 구현 단계별 TRD를 작성합니다:
   - 각 단계의 목적과 산출물
   - 기술적 결정사항 (라이브러리, 패턴, 구조)
   - 단계 간 의존성
   - 리스크 및 대안
4. 사용자에게 섹션별로 확인을 받습니다.
5. 최종 확인 후 Write 도구로 \`.taskflow/trd.md\`에 저장합니다.

## TRD 형식

# {프로젝트명} — TRD (Task Implementation Plan)

## 아키텍처 개요
(시스템 구조, 주요 컴포넌트, 데이터 흐름)

## Phase 1: {단계명}
### 목적
### 산출물
### 기술 결정사항
### 태스크 목록
### 의존성
### 리스크

## Phase 2: ...

## 규칙
- 한국어로 작성합니다.
- PRD의 우선순위(Must-Have → Nice-to-Have)를 반영합니다.
- 각 Phase는 독립적으로 배포 가능한 단위로 나눕니다.
`,
  "parse-prd": `# PRD → 태스크 분해

PRD를 분석하여 개별 태스크 파일을 자동 생성합니다.

## 사용 가능한 MCP 도구
- \`mcp__taskflow__read_prd\` — .taskflow/prd.md 읽기
- \`mcp__taskflow__list_tasks\` — 기존 태스크 확인 (중복 방지)
- \`mcp__taskflow__create_task\` — 태스크 생성

## 워크플로우

1. \`mcp__taskflow__read_prd\`로 PRD를 읽습니다.
2. \`mcp__taskflow__list_tasks\`로 기존 태스크를 확인합니다.
3. PRD의 기능 요구사항을 분석하여 태스크 목록을 도출합니다:
   - 각 태스크의 제목, 설명, 우선순위
   - 태스크 간 의존성
   - 예상 복잡도
4. 도출된 태스크 목록을 사용자에게 보여주고 확인을 받습니다.
5. 승인 후 \`mcp__taskflow__create_task\`로 하나씩 생성합니다.
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
`,
  brainstorm: `# 태스크 브레인스토밍

특정 태스크를 서브태스크로 분해합니다.

## 사용 가능한 MCP 도구
- \`mcp__taskflow__list_tasks\` — 전체 태스크 목록 조회
- \`mcp__taskflow__read_task\` — 태스크 상세 읽기
- \`mcp__taskflow__expand_subtasks\` — 서브태스크 파일 생성

## 워크플로우

1. 사용자에게 분해할 태스크 ID를 확인합니다.
   - ID를 모르면 \`mcp__taskflow__list_tasks\`로 목록을 보여줍니다.
2. \`mcp__taskflow__read_task\`로 해당 태스크의 상세 정보를 읽습니다.
3. 사용자와 대화하며 분해 방향을 논의합니다:
   - 어떤 관점으로 나눌지 (기능별, 계층별, 단계별)
   - 어느 정도 깊이로 나눌지
4. 서브태스크 목록을 제안합니다 (제목, 설명, 우선순위, 의존성).
5. 사용자 확인 후 \`mcp__taskflow__expand_subtasks\`로 생성합니다.

## 규칙
- 한국어로 작성합니다.
- 서브태스크는 4시간 이내에 완료 가능한 크기로 나눕니다.
- 반드시 사용자 승인 후 생성합니다.
`,
  refine: `# 요구사항 변경 분석

요구사항 변경이 기존 태스크에 미치는 영향을 분석하고 업데이트합니다.

## 사용 가능한 MCP 도구
- \`mcp__taskflow__read_prd\` — 현재 PRD 읽기
- \`mcp__taskflow__list_tasks\` — 전체 태스크 조회
- \`mcp__taskflow__read_task\` — 개별 태스크 읽기
- \`mcp__taskflow__update_task\` — 태스크 수정
- \`mcp__taskflow__create_task\` — 새 태스크 생성
- \`mcp__taskflow__delete_task\` — 불필요한 태스크 삭제
- \`mcp__taskflow__save_prd\` — PRD 업데이트

## 워크플로우

1. 사용자에게 변경사항을 확인합니다:
   - 어떤 요구사항이 바뀌었는지 설명을 듣거나
   - 변경된 파일/diff를 확인합니다
2. \`mcp__taskflow__read_prd\`로 현재 PRD를 읽습니다.
3. \`mcp__taskflow__list_tasks\`로 전체 태스크를 조회합니다.
4. 변경사항이 영향을 미치는 태스크를 식별합니다:
   - 수정이 필요한 태스크
   - 새로 추가해야 할 태스크
   - 더 이상 필요 없는 태스크
5. 영향 분석 결과를 사용자에게 표로 보여줍니다.
6. 사용자 승인 후:
   - \`mcp__taskflow__update_task\`로 수정
   - \`mcp__taskflow__create_task\`로 추가
   - \`mcp__taskflow__delete_task\`로 삭제
7. 필요시 \`mcp__taskflow__save_prd\`로 PRD도 업데이트합니다.

## 규칙
- 한국어로 작성합니다.
- 변경 전/후를 명확히 대비하여 보여줍니다.
- 반드시 사용자 승인 후 수정합니다.
`,
  next: `# 다음 태스크 추천

의존성과 우선순위를 기반으로 다음 작업할 태스크를 추천합니다.

## 사용 가능한 MCP 도구
- \`mcp__taskflow__get_next_task\` — 추천 태스크 조회
- \`mcp__taskflow__read_task\` — 태스크 상세 읽기
- \`mcp__taskflow__set_task_status\` — 태스크 상태 변경

## 워크플로우

1. \`mcp__taskflow__get_next_task\`로 추천 태스크 목록을 조회합니다.
2. 각 추천 태스크에 대해:
   - \`mcp__taskflow__read_task\`로 상세 정보를 읽습니다.
   - 추천 이유를 설명합니다 (의존성 해소됨, 높은 우선순위 등).
3. 사용자가 태스크를 선택하면 \`mcp__taskflow__set_task_status\`로 상태를 \`in-progress\`로 변경합니다.

## 규칙
- 한국어로 응답합니다.
- 추천 목록은 최대 3개까지 보여줍니다.
- 각 추천에 이유를 명확히 설명합니다.
`,
  "task-status": `# 프로젝트 진행 상황

현재 프로젝트의 태스크 진행 상황을 요약합니다.

## 사용 가능한 MCP 도구
- \`mcp__taskflow__list_tasks\` — 전체 태스크 조회

## 워크플로우

1. \`mcp__taskflow__list_tasks\`로 전체 태스크를 조회합니다.
2. 다음을 요약하여 보여줍니다:
   - 상태별 태스크 수 (Todo / In-Progress / Blocked / Done)
   - 전체 완료율 (%)
   - 현재 진행 중인 태스크
   - 블로커가 있는 태스크
   - 의존성이 해소되어 시작 가능한 태스크
3. 주요 이슈나 지연된 태스크가 있으면 하이라이트합니다.

## 규칙
- 한국어로 응답합니다.
- 간결한 표 형식으로 요약합니다.
`,
};
