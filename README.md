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

TaskPilot은 **PRD(Product Requirements Document)를 AI로 분석하고, 태스크를 자동 생성하며, CLI와 웹 대시보드에서 양방향 실시간 관리**하는 개발자용 태스크 매니저입니다.

모든 데이터는 **로컬 마크다운 파일**로 저장됩니다. 데이터베이스 없음. 클라우드 종속 없음. Git으로 버전 관리 가능.

```
PRD 작성 → AI 태스크 분해 → 의존성 분석 → 스마트 추천 → 칸반 보드
     ↑                                                    ↓
     └──────────── 요구사항 변경 영향도 분석 ←──────────────┘
```

---

## Highlights

|       | Feature | Description |
| :---: | :--- | :--- |
| :brain: | **AI PRD Brainstorm** | 멀티턴 대화로 요구사항을 정제하고 PRD를 자동 생성 |
| :zap: | **Smart Task Decomposition** | PRD를 분석해 의존성 포함 태스크를 자동 분해 |
| :dart: | **Intelligent Next** | 의존성, 우선순위, 최근성을 종합 분석해 다음 태스크 추천 |
| :arrows_counterclockwise: | **Real-time Sync** | CLI에서 변경하면 웹 대시보드가 즉시 반영 (SSE) |
| :card_file_box: | **File-based Storage** | `.taskflow/` 디렉토리에 마크다운으로 저장, Git 친화적 |
| :robot: | **MCP Integration** | 17개 MCP 도구로 Claude Code에서 직접 태스크 관리 |
| :mag: | **Impact Analysis** | 요구사항 변경 시 영향받는 태스크를 자동 탐지 |
| :bar_chart: | **Kanban Dashboard** | 드래그 앤 드롭 칸반 보드로 시각적 태스크 관리 |

---

## Quick Start

### Installation

```bash
# Clone & Install
git clone https://github.com/mugeon/TaskPilot.git
cd TaskPilot
npm install

# Initialize a project
npm task init
```

### 3 Minutes to First Task

```bash
# 1. 프로젝트 초기화 (PRD 생성 포함)
npm task init

# 2. PRD를 태스크로 분해
npm task parse-prd

# 3. 다음 할 일 추천받기
npm task next

# 4. 웹 대시보드 열기
npm task board
```

That's it. PRD부터 칸반 보드까지 3분.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    TaskPilot                         │
├──────────────┬──────────────┬───────────────────────┤
│     CLI      │   Web UI     │    MCP Server         │
│  (Commander) │  (Next.js)   │  (Claude Code 연동)    │
├──────────────┴──────────────┴───────────────────────┤
│                  Core Engine                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐ │
│  │ TaskFlow │ │ AI Agent │ │ Dependency Graph     │ │
│  │ CRUD     │ │ Claude   │ │ Cycle Detection      │ │
│  │ Filter   │ │ SDK      │ │ Topological Sort     │ │
│  └──────────┘ └──────────┘ └──────────────────────┘ │
├─────────────────────────────────────────────────────┤
│              .taskflow/ (Markdown Files)             │
│  config.json │ TASKS.md │ task-001.md │ task-002.md │
└─────────────────────────────────────────────────────┘
```

---

## CLI Commands

| Command | Alias | Description |
| :--- | :--- | :--- |
| `task init` | - | 프로젝트 초기화 + Claude Code 연동 + PRD 생성 |
| `task fprd` | - | AI 브레인스토밍으로 PRD 생성 |
| `task parse-prd` | - | PRD를 개별 태스크 파일로 분해 |
| `task list` | `task ls` | 태스크 목록 (필터/정렬 지원) |
| `task show <id>` | - | 태스크 상세 보기 |
| `task set-status <id> <status>` | - | 태스크 상태 변경 |
| `task board` | - | 웹 대시보드 열기 (localhost:4000) |
| `task tree` | - | 태스크 의존성 트리 표시 |
| `task next` | - | AI 기반 다음 태스크 추천 |
| `task brainstorm` | - | 복잡한 태스크 멀티턴 AI 토론 |
| `task expand <id>` | - | 태스크를 서브태스크로 분해 |
| `task refine` | - | 요구사항 변경 영향도 분석 |

---

## MCP Integration

TaskPilot은 **Model Context Protocol** 서버를 내장하고 있어, Claude Code에서 자연어로 태스크를 관리할 수 있습니다.

```json
// .mcp.json (자동 생성)
{
  "mcpServers": {
    "taskflow": {
      "command": "node",
      "args": ["./bin/task-mcp.mjs"]
    }
  }
}
```

**17개 MCP 도구** — 프로젝트 관리, 태스크 CRUD, 상태 업데이트, PRD 생성, 브레인스토밍, 영향도 분석, PRD 파싱까지 Claude Code 안에서 전부 가능.

---

## Web Dashboard

실시간 칸반 보드로 태스크 상태를 시각적으로 관리합니다.

- **4개 컬럼**: Todo / In Progress / Blocked / Done
- **드래그 앤 드롭**: dnd-kit 기반 직관적 조작
- **실시간 동기화**: CLI 변경 → SSE → 웹 즉시 반영 (300ms 이내)
- **프로그레스 카드**: 전체 진행률 한눈에 확인

```bash
# 대시보드 실행
npm task board
# → http://localhost:4000/dashboard
```

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 15, React 19, TailwindCSS 4, shadcn/ui, dnd-kit, Framer Motion |
| **Backend** | Hono.js, Server-Sent Events, chokidar (file watcher) |
| **AI** | @anthropic-ai/claude-agent-sdk, @modelcontextprotocol/sdk |
| **CLI** | Commander.js, Chalk, Inquirer, Ora |
| **Data** | Markdown files, gray-matter, unified/remark |
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
│   ├── flows/            # Multi-step CLI flows
│   └── lib/              # CLI utilities
├── core/                 # Domain logic
│   ├── ai/               # Claude SDK integration
│   ├── prd/              # PRD generation & analysis
│   ├── project/          # Project initialization
│   └── task/             # Task abstraction
├── features/
│   ├── kanban/           # Web dashboard (board, SSE, hooks)
│   └── taskflow/         # Core task engine (CRUD, graph, filter)
├── mcp/                  # MCP server & 17 tools
└── components/           # Shared UI components
```

---

## How It Works

### 1. PRD to Tasks

```bash
$ npm task parse-prd

📄 PRD 분석 중...
🔍 요구사항 추출: 12개 기능 발견
🧩 태스크 분해: 28개 태스크 생성
🔗 의존성 매핑: 15개 관계 설정
✅ .taskflow/tasks/ 에 저장 완료
```

### 2. Smart Recommendations

```bash
$ npm task next

🎯 추천 태스크 (Score: 0.92)
┌─────────────────────────────────┐
│ task-003: API 인증 미들웨어 구현   │
│ Priority: High | Deps: 0 blocked │
│ 이유: 의존성 없음 + 높은 우선순위   │
└─────────────────────────────────┘
```

### 3. Impact Analysis

```bash
$ npm task refine

📋 변경된 요구사항 감지:
  - "OAuth 2.0 → SAML 인증으로 변경"

⚠️  영향받는 태스크: 4개
  - task-003: API 인증 미들웨어 (직접 영향)
  - task-007: 사용자 세션 관리 (간접 영향)
  - task-012: 로그인 UI (간접 영향)
  - task-015: 권한 관리 (간접 영향)
```

---

## Development

```bash
# Dev server (web dashboard)
npm dev

# Run tests
npm test

# E2E tests
npm test:e2e

# Type check
npm typecheck

# Lint
npm lint
```

---

## Roadmap

- [x] CLI core commands (init, parse-prd, list, show, set-status, tree)
- [x] AI-powered task decomposition & recommendations
- [x] Web Kanban dashboard with real-time sync
- [x] MCP server integration (17 tools)
- [x] Impact analysis for requirement changes
- [ ] Dependency graph visualization (D3.js)
- [ ] Timeline / Gantt chart view
- [ ] Task auto-execution loop
- [ ] Claude Code skill-based workflow

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## License

MIT

---

<div align="center">

**Stop managing tasks. Start shipping.**

Built with Claude Agent SDK + Next.js + Hono.js

</div>
