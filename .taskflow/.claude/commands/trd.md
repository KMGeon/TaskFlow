# TRD 생성 (Task Implementation Plan)

PRD를 기반으로 기술적 구현 계획(TRD)을 작성합니다.

## 사용 가능한 MCP 도구
- `mcp__taskflow__read_prd` — .taskflow/prd.md 읽기
- `mcp__taskflow__list_tasks` — 기존 태스크 목록 확인

## 워크플로우

1. `mcp__taskflow__read_prd`로 PRD를 읽습니다.
2. `mcp__taskflow__list_tasks`로 기존 태스크가 있는지 확인합니다.
3. PRD를 분석하여 구현 단계별 TRD를 작성합니다:
   - 각 단계의 목적과 산출물
   - 기술적 결정사항 (라이브러리, 패턴, 구조)
   - 단계 간 의존성
   - 리스크 및 대안
4. 사용자에게 섹션별로 확인을 받습니다.
5. 최종 확인 후 Write 도구로 `.taskflow/trd.md`에 저장합니다.

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
