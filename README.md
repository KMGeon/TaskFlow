<div align="center">

# TaskPilot

### AI-Powered Task Management for Developers Who Ship

**PRD to Done. In Minutes, Not Hours.**

[![GitHub Release](https://img.shields.io/github/v/release/mugeon/TaskPilot?color=369eff&labelColor=black&logo=github&style=flat-square)](https://github.com/mugeon/TaskPilot/releases)
[![License](https://img.shields.io/badge/license-MIT-white?labelColor=black&style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?labelColor=black&style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?labelColor=black&style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Claude](https://img.shields.io/badge/Claude_Agent_SDK-Powered-D97706?labelColor=black&style=flat-square)](https://docs.anthropic.com/)

</div>

---

> **PRD 작성에 2시간, 태스크 분해에 1시간, 우선순위 정하는 데 30분.**
>
> 그 시간에 코드를 치세요. TaskPilot이 나머지를 합니다.

---

## What is TaskPilot?

TaskPilot은 **Claude Code 스킬 기반의 AI 태스크 매니저**입니다. PRD 생성부터 태스크 분해, 추적, 변경 분석까지 — Claude Code 안에서 `/prd`, `/next` 같은 스킬 커맨드로 자연스럽게 진행합니다.

모든 데이터는 **로컬 마크다운 파일**로 저장됩니다. 데이터베이스 없음. 클라우드 종속 없음. Git으로 버전 관리 가능.

```
task init → /prd → /trd → /parse-prd → /next → 구현 → /task-status
              ↑                                         ↓
              └──────── /refine (요구사항 변경 시) ←──────┘
```

---

## Highlights

|       | Feature | Description |
| :---: | :--- | :--- |
| :brain: | **AI PRD Brainstorm** | `task init` 또는 `/prd`로 대화형 PRD 생성 (Claude Max, API 키 불필요) |
| :zap: | **Smart Task Decomposition** | `/parse-prd`로 PRD를 의존성 포함 태스크로 자동 분해 |
| :dart: | **Intelligent Next** | `/next`로 의존성, 우선순위 기반 다음 태스크 추천 |
| :arrows_counterclockwise: | **Real-time Sync** | CLI에서 변경하면 웹 대시보드가 즉시 반영 (SSE) |
| :card_file_box: | **File-based Storage** | `.taskflow/` 디렉토리에 마크다운으로 저장, Git 친화적 |
| :robot: | **Skill + MCP** | 7개 스킬 커맨드 + 14개 MCP 도구로 Claude Code 완전 통합 |
| :mag: | **Impact Analysis** | `/refine`으로 요구사항 변경 시 영향받는 태스크 자동 탐지 |
| :bar_chart: | **Kanban Dashboard** | 드래그 앤 드롭 칸반 보드로 시각적 태스크 관리 |

---

## Quick Start

### Installation

```bash
# Clone & Install
git clone https://github.com/KMGeon/TaskFlow.git
cd TaskFlow
pnpm install

# Initialize a project
pnpm task init
```

### 3 Minutes to First Task

```bash
# 1. 프로젝트 초기화 (대화형 PRD 생성 포함)
pnpm task init

# 2. Claude Code에서 스킬 사용
/parse-prd        # PRD → 태스크 분해
/next             # 다음 태스크 추천
/task-status      # 진행 상황 요약

# 3. 웹 대시보드 열기
pnpm task board
```

That's it. PRD부터 칸반 보드까지 3분.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                       TaskPilot                           │
├────────────┬────────────┬────────────────────────────────┤
│    CLI     │   Web UI   │    Claude Code 스킬             │
│ (Commander)│  (Next.js) │  (.taskflow/.claude/commands/)  │
├────────────┴────────────┴────────────────────────────────┤
│                                                           │
│   사용자 → Claude Code ← 스킬 프롬프트 (워크플로우 안내)    │
│                │                                          │
│                ▼                                          │
│   MCP Server (stdio, 14개 순수 데이터 도구)                │
│                │                                          │
│                ▼                                          │
│   src/core/ (비즈니스 로직, AI 호출 없음)                   │
│                │                                          │
│                ▼                                          │
│   .taskflow/ (마크다운 파일 저장소)                         │
│   config.json │ prd.md │ trd.md │ tasks/task-{NNN}.md     │
└──────────────────────────────────────────────────────────┘
```

**핵심 설계:** Claude Code 자체가 AI이므로, MCP 도구는 순수 데이터 접근만 담당하고, 스킬 프롬프트가 워크플로우를 오케스트레이션합니다.

---

## Claude Code Skills

`task init` 시 자동 설치되는 7개 스킬:

| Skill | Command | Description |
| :--- | :--- | :--- |
| PRD 생성 | `/prd` | 사용자와 대화하며 PRD 작성 |
| TRD 생성 | `/trd` | PRD 기반 기술 구현 계획 작성 |
| PRD 파싱 | `/parse-prd` | PRD를 개별 태스크로 분해 |
| 브레인스토밍 | `/brainstorm` | 태스크를 서브태스크로 분해 |
| 리파인 | `/refine` | 요구사항 변경 영향도 분석 |
| 다음 태스크 | `/next` | 의존성/우선순위 기반 추천 |
| 진행 상황 | `/task-status` | 프로젝트 진행률 요약 |

스킬 원본은 `.taskflow/.claude/commands/`에서 관리되고, `.claude/commands/`에 심볼릭 링크로 연결됩니다.

---

## CLI Commands

| Command | Description |
| :--- | :--- |
| `task init` | 프로젝트 초기화 + Claude Code 연동 + 스킬 설치 + PRD 생성 |
| `task list` | 태스크 목록 (필터/정렬 지원) |
| `task show <id>` | 태스크 상세 보기 |
| `task set-status <id> <status>` | 태스크 상태 변경 |
| `task board` | 웹 대시보드 열기 (localhost:4000) |
| `task tree` | 태스크 의존성 트리 표시 |
| `task next` | 다음 태스크 추천 |

---

## MCP Integration

TaskPilot은 **Model Context Protocol** 서버를 내장하고 있어, Claude Code에서 자연어로 태스크를 관리할 수 있습니다.

```json
// .mcp.json (task init 시 자동 생성)
{
  "mcpServers": {
    "taskflow": {
      "command": "node",
      "args": ["./bin/task-mcp.mjs"]
    }
  }
}
```

**14개 MCP 도구:**

| 카테고리 | 도구 |
| :--- | :--- |
| 태스크 관리 | `list_tasks`, `read_task`, `create_task`, `update_task`, `delete_task`, `set_task_status`, `get_next_task`, `expand_subtasks` |
| PRD & 코드베이스 | `scan_codebase`, `save_prd`, `read_prd` |
| 프로젝트 | `initialize_project`, `generate_claude_md` |

---

## Web Dashboard

실시간 칸반 보드로 태스크 상태를 시각적으로 관리합니다.

- **4개 컬럼**: Todo / In Progress / Blocked / Done
- **드래그 앤 드롭**: dnd-kit 기반 직관적 조작
- **실시간 동기화**: CLI 변경 → SSE → 웹 즉시 반영 (300ms 이내)
- **프로그레스 카드**: 전체 진행률 한눈에 확인

```bash
pnpm task board
# → http://localhost:4000
```

---

## How It Works

### 1. Initialize & Generate PRD

```bash
$ pnpm task init

🚀 TaskFlow 프로젝트를 초기화합니다.
✔ 프로젝트 구조 생성 완료
✔ Claude Code 연동 설정 완료 (.mcp.json)
✔ CLAUDE.md 생성 완료
✔ Claude Code 스킬 설치 완료

? PRD를 지금 생성하시겠습니까? (Y/n) Y

💬 PRD 브레인스토밍을 시작합니다...
🤖 프로젝트명이 뭔가요?
> ...
```

### 2. Decompose PRD to Tasks (in Claude Code)

```
> /parse-prd

📄 PRD 분석 중...
🔍 요구사항 추출: 12개 기능 발견
🧩 태스크 분해: 28개 태스크 생성
🔗 의존성 매핑: 15개 관계 설정
✅ .taskflow/tasks/ 에 저장 완료
```

### 3. Get Next Task

```
> /next

🎯 추천 태스크 (Score: 0.92)
┌─────────────────────────────────┐
│ task-003: API 인증 미들웨어 구현   │
│ Priority: High | Deps: 0 blocked │
│ 이유: 의존성 없음 + 높은 우선순위   │
└─────────────────────────────────┘
```

### 4. Refine on Changes

```
> /refine

📋 변경된 요구사항:
  - "OAuth 2.0 → SAML 인증으로 변경"

⚠️  영향받는 태스크: 4개
  - task-003: API 인증 미들웨어 (직접 영향)
  - task-007: 사용자 세션 관리 (간접 영향)
```

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 15, React 19, TailwindCSS 4, shadcn/ui, dnd-kit, Framer Motion |
| **Backend** | Hono.js, Server-Sent Events |
| **AI** | @anthropic-ai/claude-agent-sdk (Claude Max), @modelcontextprotocol/sdk |
| **CLI** | Commander.js, Chalk, Inquirer, Ora |
| **Data** | Markdown files, gray-matter |
| **Testing** | Vitest, Playwright, Testing Library |
| **Language** | TypeScript 5 (strict mode) |

---

## Project Structure

```
src/
├── app/                  # Next.js App Router
├── backend/              # Hono.js API + Middleware
├── cli/                  # CLI Commands
│   ├── commands/         # Individual command implementations
│   └── lib/              # CLI utilities
├── core/                 # Domain logic (AI 호출 없음)
│   ├── ai/               # Claude Agent SDK wrapper (task init용)
│   ├── prd/              # PRD save + codebase scanner
│   ├── project/          # Project init, config, skill setup
│   └── task/             # Task abstraction
├── features/
│   ├── kanban/           # Web dashboard (board, SSE, hooks)
│   └── taskflow/         # Core task engine (CRUD, graph, filter)
├── mcp/                  # MCP server & 14 pure data tools
└── components/           # Shared UI components

.taskflow/
├── .claude/commands/     # Skill prompts (원본)
├── config.json           # Project config
├── prd.md                # Generated PRD
├── trd.md                # Generated TRD
└── tasks/                # Task markdown files
```

---

## Roadmap

- [x] CLI core commands (init, list, show, set-status, tree)
- [x] AI-powered PRD brainstorm (Claude Agent SDK)
- [x] Web Kanban dashboard with real-time sync
- [x] MCP server integration (14 pure data tools)
- [x] Claude Code skill-based workflow (7 skills)
- [x] Impact analysis for requirement changes
- [ ] Dependency graph visualization (D3.js)
- [ ] Timeline / Gantt chart view
- [ ] Task auto-execution loop

---

## Development

```bash
# Dev server (web dashboard)
pnpm dev

# Run tests
pnpm test

# E2E tests
pnpm test:e2e

# Type check
pnpm typecheck

# Lint
pnpm lint
```

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## License

MIT

---

<div align="center">

**Stop managing tasks. Start shipping.**

Built with Claude Agent SDK + Claude Code Skills + Next.js + Hono.js

</div>
