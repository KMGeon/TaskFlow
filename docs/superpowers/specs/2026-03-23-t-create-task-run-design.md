# /t-create + task run — 브레인스토밍 기반 TRD 생성 및 자동 구현

## 개요
`/t-create` Claude Code 스킬로 브레인스토밍 기반 TRD를 생성하고,
`task run` CLI로 TRD를 선택하여 태스크 분해 + Ralph Loop 자동 구현하는 시스템.

## 아키텍처

```
/t-create (Claude Code 스킬)
  ├─ 요구사항 수집 (한 번에 하나, 객관식)
  ├─ 접근법 2-3개 제안 + 트레이드오프
  ├─ TRD 섹션별 작성 + 사용자 승인
  └─ .taskflow/trd-{기능명}.md 저장

task run (CLI)
  ├─ .taskflow/trd-*.md 파일 목록 표시
  ├─ 사용자가 TRD 선택
  ├─ TRD 내용을 읽어서 프롬프트에 주입
  └─ Ralph Loop 셋업 (.claude/ralph-loop.local.md 생성)
     ├─ Phase 1: TRD → 태스크 분해 (MCP create_task)
     ├─ Phase 2: get_next_task → 구현 → set_task_status 루프
     └─ 모든 태스크 완료 시 종료
```

## 제거 항목
- `/create` 스킬 → `/t-create`로 대체
- `task create` CLI → 제거 (SDK 기반 대화 루프 불필요)
- `runTaskCreate()`, `TASK_CREATE_SYSTEM_PROMPT` → 제거

## 변경 파일
| 파일 | 변경 |
|---|---|
| `.taskflow/.claude/commands/t-create.md` | 새 파일 |
| `src/core/project/skill-templates.ts` | create → t-create 템플릿 교체 |
| `src/cli/commands/run.ts` | TRD 기반 선택 + Ralph Loop 셋업 |
| `src/cli/commands/create.ts` | 삭제 |
| `src/cli/prompts/task-create.md` | 삭제 |
| `src/cli/index.ts` | registerCreateCommand 제거 |
| `src/core/ai/claude-client.ts` | runTaskCreate 관련 제거 |
