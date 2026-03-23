<div align="center">

<img src="https://img.shields.io/npm/v/@kmgeon/taskflow?style=flat-square&color=blue" alt="npm version" />
<img src="https://img.shields.io/npm/l/@kmgeon/taskflow?style=flat-square" alt="license" />

# TaskFlow

### Two commands. Idea to code.

**Document-driven vibe coding.**

<br />

```
/t-create    →    task run    →    done.
 (define)         (execute)
```

<br />

[Philosophy](#philosophy) · [Concepts](#concepts) · [Quick Start](#quick-start) · [How It Works](#how-it-works) · [CLI](#cli-reference) · [Architecture](#architecture)

</div>

<br />

## Philosophy

> **Write docs, not code.**

You describe what you want. AI brainstorms with you, writes the spec, and implements everything.
Your job is to **think and approve** — not to type boilerplate.

| Principle | What it means |
|:--|:--|
| **Document-first** | Every feature starts as a TRD. No code until the spec is approved. Decisions live in markdown, not in your head. |
| **Automated execution** | Once approved, AI decomposes the spec into tasks and implements them one by one. No ticket management. No priority juggling. |
| **File-based, Git-native** | No database. No cloud. Everything is markdown in `.taskflow/`, versioned with Git. |

```
idea → TRD (markdown) → tasks (markdown) → working code
         you write          AI generates       AI implements
```

---

## Concepts

Four building blocks. Understanding these makes everything click.

### PRD — Product Requirements Document

> **What** you're building, for **whom**, and **why**.

The big picture. Captures product vision, target users, feature list, success metrics.
Created with `/prd`, stored in `.taskflow/prd.md`.

### TRD — Task Requirements Document

> **How** to build a specific feature.

Zooms into one feature. Defines the technical approach — architecture, data models, APIs, risks.

**PRD says** "we need authentication."
**TRD says** "Supabase Auth, JWT, refresh tokens in httpOnly cookies, middleware on /api/*."

Created with `/t-create` (includes brainstorming). Stored as `.taskflow/trd-{feature}.md`.

**One TRD = one feature = one `task run` unit.**

### Task — Implementation Unit

A single piece of work completable in under 4 hours. Auto-generated when `task run` decomposes a TRD.

```yaml
---
id: '003'
title: Implement auth middleware
status: InProgress
priority: 9
group: auth system
dependencies: ['001', '002']
---
Create middleware that validates JWT tokens on /api/* routes...
```

### Decompose — TRD to Tasks

```
TRD: Auth System
 ├── task-001: Set up auth client           (priority: 9)
 ├── task-002: Create login/signup routes   (priority: 9, depends: 001)
 ├── task-003: Implement auth middleware    (priority: 9, depends: 001, 002)
 ├── task-004: Add refresh token rotation   (priority: 7, depends: 003)
 └── task-005: Write integration tests      (priority: 8, depends: 003)
```

Happens automatically. AI reads the TRD, creates tasks, implements them sequentially.

---

## Quick Start

```bash
npm install @kmgeon/taskflow
task init
```

That's it. Skills, plugins, MCP server — all auto-configured.

Then:

```bash
/t-create     # In Claude Code — define your feature
task run      # In terminal — AI implements everything
```

---

## How It Works

### `/t-create` — Define what to build

```
❯ /t-create

? What do you want to build?
> User authentication with JWT

? Who uses this feature?
  A. End users (login/logout)
  B. Admin users (user management)
  C. Both
> C

💡 Three approaches:

  A. (Recommended) Supabase Auth native
     + Zero custom code for core auth
     - Limited customization

  B. Custom JWT + Supabase as DB only
     + Full control
     - More code to maintain

? Which approach: A

📝 Writing TRD...
   ✔ Overview — approved
   ✔ User Scenarios — approved
   ✔ Technical Design — approved
   ✔ Success Criteria — approved

✅ TRD saved: .taskflow/trd-auth-system.md
```

AI asks questions one at a time. Proposes approaches with trade-offs. Writes the spec section by section. You approve each part.

### `task run` — Build it automatically

```
❯ task run

📋 TRD list:
  1) auth system       (trd-auth-system.md)
  2) notification      (trd-notification.md)

? Select: 1

🚀 Ralph Loop started. All tasks will be implemented automatically.
```

What happens next:
1. AI reads your TRD
2. Decomposes into implementation tasks
3. Implements each task — writes code, runs tests
4. Marks done, picks the next one
5. Repeats until complete

### Track progress

```
❯ task list

📋 Feature progress:

  ██████░░░░  auth system       60%  3/5 · 1 in progress
  ░░░░░░░░░░  notification       0%  0/3
  ██████████  onboarding       100%  done
```

---

## CLI Reference

**Core**

| Command | Description |
|:--|:--|
| `task init` | Initialize project — skills, plugins, MCP |
| `task run` | Select TRD → decompose → auto-implement |

**Monitor**

| Command | Description |
|:--|:--|
| `task list` | Feature progress by group |
| `task list --detail [name]` | Individual tasks (optionally filtered) |
| `task board` | Kanban board by group |
| `task tree` | Dependency tree by group |

**Manage**

| Command | Description |
|:--|:--|
| `task show <id>` | Task details |
| `task set-status <id> <status>` | Change task status |
| `task ask` | Ask AI about your project |

---

## Skills

Slash commands in Claude Code. Auto-installed by `task init`.

| Skill | What it does |
|:--|:--|
| `/t-create` | Brainstorm → TRD spec |
| `/prd` | Product requirements document |
| `/trd` | Technical implementation plan |

Customizable. Edit `.taskflow/.claude/commands/*.md` directly.

---

## Architecture

### What `task init` creates

```
.taskflow/
├── config.json                    # settings
├── trd-auth-system.md             # TRD specs (one per feature)
├── tasks/
│   ├── task-001.md                # tasks (auto-generated)
│   └── ...
└── .claude/commands/
    ├── t-create.md                # skill source files
    ├── prd.md
    └── trd.md

.claude/
├── commands/                      # symlinks → .taskflow/.claude/commands/
└── settings.local.json            # plugins: superpowers, ralph-loop

.mcp.json                          # MCP server config
CLAUDE.md                          # project instructions
docs/                              # dev guidelines
```

### Data flow

```
/t-create
    │ writes
    ▼
.taskflow/trd-*.md
    │ task run reads
    ▼
Ralph Loop
    │ creates tasks via MCP
    ▼
.taskflow/tasks/task-*.md
    │ implements code, updates status
    ▼
Working code ✅
```

### Plugins

TaskFlow auto-configures these Claude Code plugins (project-scoped):

- **superpowers** — brainstorming, debugging, TDD, code review
- **ralph-loop** — autonomous implementation loop

---

<div align="center">

**Define. Decompose. Deliver.**

`npm install @kmgeon/taskflow`

</div>
