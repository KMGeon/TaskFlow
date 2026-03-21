<div align="center">

# TaskFlow

### AI-Powered Task Management for Developers Who Ship

**PRD to Done. In Minutes, Not Hours.**


</div>

---

> **2 hours writing a PRD, 1 hour decomposing tasks, 30 minutes prioritizing.**
>
> Spend that time coding. TaskFlow handles the rest.

---

## What is TaskFlow?

TaskFlow is an **AI task manager built on Claude Code skills**. From PRD creation to task decomposition, tracking, and change impact analysis — everything happens naturally inside Claude Code with skill commands like `/prd`, `/next`, and `/refine`.

All data is stored as **local markdown files**. No database. No cloud dependency. Version control with Git.

```
/prd → /trd → /parse-prd → /next → implement → /task-status
  ↑                                                ↓
  └──────── /refine (when requirements change) ←───┘
```

---

## Highlights

|       | Feature | Description |
| :---: | :--- | :--- |
| :brain: | **AI PRD Brainstorm** | Generate PRD interactively with `/prd` — just talk to Claude |
| :zap: | **Smart Task Decomposition** | `/parse-prd` auto-decomposes PRD into tasks with dependencies |
| :dart: | **Intelligent Next** | `/next` recommends the best next task based on dependencies & priority |
| :arrows_counterclockwise: | **Real-time Sync** | CLI changes instantly reflected in the web dashboard (SSE) |
| :card_file_box: | **File-based Storage** | Markdown files in `.taskflow/` — Git-friendly, no DB needed |
| :robot: | **Skill + MCP** | 7 skill commands + 14 MCP tools, fully integrated with Claude Code |
| :mag: | **Impact Analysis** | `/refine` auto-detects affected tasks when requirements change |
| :bar_chart: | **Kanban Dashboard** | Visual task management with drag-and-drop kanban board |

---

## Quick Start

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
# 1. Initialize project (includes interactive PRD generation)
pnpm task init

# 2. Use skills in Claude Code
/parse-prd        # PRD → task decomposition
/next             # Next task recommendation
/task-status      # Progress summary

# 3. Open web dashboard
pnpm task board
```

That's it. From PRD to kanban board in 3 minutes.

---

## Claude Code Skills

7 skills auto-installed on `task init`:

| Skill | Command | Description |
| :--- | :--- | :--- |
| PRD Creation | `/prd` | Interactive PRD writing with AI |
| TRD Creation | `/trd` | Technical implementation plan from PRD |
| PRD Parsing | `/parse-prd` | Decompose PRD into individual tasks |
| Brainstorm | `/brainstorm` | Break tasks into subtasks |
| Refine | `/refine` | Analyze impact of requirement changes |
| Next Task | `/next` | Dependency/priority-based recommendation |
| Status | `/task-status` | Project progress summary |
| Auto | `/auto` | Auto-implement tasks in a loop (`/ra /auto`) |

---

## CLI Commands

| Command | Description |
| :--- | :--- |
| `task init` | Initialize project + Claude Code setup + skill install + PRD generation |
| `task list` | List tasks (with filter/sort) |
| `task show <id>` | View task details |
| `task set-status <id> <status>` | Change task status |
| `task board` | Open web dashboard (localhost:4000) |
| `task tree` | Display task dependency tree |
| `task next` | Recommend next task |

---

## How It Works

### 1. Initialize & Generate PRD

```bash
$ pnpm task init

🚀 Initializing TaskFlow project...
✔ Project structure created
✔ Claude Code integration configured (.mcp.json)
✔ CLAUDE.md generated
✔ Claude Code skills installed

? Generate PRD now? (Y/n) Y

💬 Starting PRD brainstorm...
🤖 What's the project name?
> ...
```

### 2. Decompose PRD to Tasks (in Claude Code)

```
> /parse-prd

📄 Analyzing PRD...
🔍 Requirements extracted: 12 features found
🧩 Task decomposition: 28 tasks created
🔗 Dependency mapping: 15 relations set
✅ Saved to .taskflow/tasks/
```

### 3. Get Next Task

```
> /next

🎯 Recommended Task (Score: 0.92)
┌──────────────────────────────────┐
│ task-003: Implement Auth API      │
│ Priority: High | Deps: 0 blocked │
│ Reason: No blockers + high prio  │
└──────────────────────────────────┘
```

### 4. Refine on Changes

```
> /refine

📋 Changed requirements:
  - "OAuth 2.0 → SAML authentication"

⚠️  Affected tasks: 4
  - task-003: Auth API middleware (direct)
  - task-007: User session management (indirect)
```

---

## Usage Recipes

TaskFlow skills can be combined for powerful workflows. Here are the most effective patterns.

### Full Autopilot: PRD to Implementation

Go from zero to working code — fully autonomous.

```bash
# Step 1: Generate PRD interactively
/prd

# Step 2: Create implementation plan
/trd

# Step 3: Decompose into tasks
/parse-prd

# Step 4: Let Claude implement everything automatically
/ra /auto
```

Claude will pick up tasks one by one (by priority & dependency order), implement each one, mark it done, and move to the next — until all tasks are complete.

### Manual Control: One Task at a Time

For when you want to review each step.

```bash
# See what to work on next
/next

# Claude implements the selected task
# ... (review the changes)

# Check overall progress
/task-status
```

### Requirement Changes Mid-Project

Requirements changed? No need to start over.

```bash
# Analyze what's affected
/refine

# Then continue with updated tasks
/ra /auto
```

### Break Down a Complex Task

When a single task is too big:

```bash
# Decompose into smaller subtasks
/brainstorm

# Then auto-implement the subtasks
/ra /auto
```

### Combine with Ralph Loop

[Ralph Loop](https://github.com/anthropics/claude-code) (`/ra`) repeats any skill or prompt on a loop. Combine it with TaskFlow skills:

```bash
# Auto-implement all tasks
/ra /auto

# Auto-implement with a custom instruction
/ra "get the next task, implement it, run tests, and mark done"

# Run with max iterations
/ra /auto --max-iterations 20
```

### Recommended Workflow

```
┌─────────────┐    ┌─────────────┐    ┌──────────────┐
│   /prd      │───▶│   /trd      │───▶│  /parse-prd  │
│ (Define)    │    │ (Plan)      │    │ (Decompose)  │
└─────────────┘    └─────────────┘    └──────┬───────┘
                                             │
                   ┌─────────────┐    ┌──────▼───────┐
                   │  /refine    │◀───│  /ra /auto   │
                   │ (if needed) │───▶│ (Implement)  │
                   └─────────────┘    └──────┬───────┘
                                             │
                                      ┌──────▼───────┐
                                      │ /task-status  │
                                      │ (Review)      │
                                      └──────────────┘
```

---

## Roadmap

- [x] CLI core commands (init, list, show, set-status, tree)
- [x] AI-powered PRD brainstorm
- [x] Web Kanban dashboard with real-time sync
- [x] MCP server integration (14 pure data tools)
- [x] Claude Code skill-based workflow (7 skills)
- [x] Impact analysis for requirement changes
- [ ] Dependency graph visualization
- [ ] Timeline / Gantt chart view
- [ ] Task auto-execution loop

---

## Development

```bash
pnpm dev          # Dev server (web dashboard)
pnpm test         # Run tests
pnpm test:e2e     # E2E tests
pnpm typecheck    # Type check
pnpm lint         # Lint
```

