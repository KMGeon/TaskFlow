# task run — 요구사항 단위 자동 구현

## 개요
`task run` CLI 커맨드: 태스크를 `group`(요구사항/기능 단위)으로 묶어 보여주고, 사용자가 선택하면 서브 에이전트(Claude CLI)가 해당 그룹의 모든 태스크를 자동으로 구현한다.

## 데이터 모델
`Task` 타입에 `group?: string` 필드 추가.
- `task create`로 생성 시 `featureName`이 `group`으로 자동 세팅
- MCP `create_task`에 `group` 파라미터 추가
- MCP `get_next_task`에 `group` 필터 추가

## CLI 흐름
```
$ task run
📋 요구사항 그룹 목록:
  1. 인증 시스템          (3/5 완료)
  2. CLI 대화 UI 개선     (0/4 완료)
? 구현할 그룹을 선택하세요: 2
🚀 서브 에이전트가 작업을 시작합니다...
[Claude CLI가 stdio: inherit로 실행 — 완전 자동, 태스크 연속 구현]
✅ 완료!
```

## 서브 에이전트 실행 구조
- `spawnClaude(flags)` — `stdio: 'inherit'`
- `--system-prompt-file` — 그룹 태스크 구현 전용 프롬프트
- `--mcp-config` — TaskFlow MCP 서버 (임시 mcp.json)
- CLAUDE.md 간섭은 코딩 작업에 오히려 도움

## 서브 에이전트 프롬프트 (`task-run.md`)
- 그룹명과 태스크 목록을 주입
- MCP `get_next_task(group)` → `set_task_status(in-progress)` → 구현 → `set_task_status(done)` 루프
- 그룹 내 모든 태스크 완료 시 종료

## 변경 파일
| 파일 | 변경 |
|---|---|
| `src/features/taskflow/types.ts` | `group?: string` 추가 |
| `src/features/taskflow/lib/repository.ts` | createTask에서 group 처리 |
| `src/mcp/tools/task.ts` | create_task에 group, get_next_task에 group 필터 |
| `src/core/ai/claude-client.ts` | runTaskCreate에서 group 포함하여 createTask 호출 |
| `src/cli/commands/run.ts` | **새 파일** — 그룹 선택 UI + spawnClaude |
| `src/cli/prompts/task-run.md` | **새 파일** — 서브 에이전트 프롬프트 |
| `src/cli/index.ts` | registerRunCommand 추가 |
