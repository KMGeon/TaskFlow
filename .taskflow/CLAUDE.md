# TaskFlow Development Guide

## Project Info
- Name: TaskFlow
- Description: N/A
- Tech Stack: N/A
- Created: 2026-03-21

## TaskFlow MCP Tools

This project uses TaskFlow for task management.
Use the MCP tools below to query and manage tasks.

### Task Management
- `list_tasks` — List tasks (filter: status, priority)
- `read_task` — Read task details
- `create_task` — Create a new task
- `update_task` — Update a task
- `delete_task` — Delete a task
- `set_task_status` — Change task status
- `get_next_task` — Recommend next task based on dependencies/priority
- `expand_subtasks` — Generate subtask files

### PRD & Codebase
- `scan_codebase` — Scan codebase file list/signatures
- `save_prd` — Save PRD markdown
- `read_prd` — Read PRD

### Project
- `initialize_project` — Initialize project
- `generate_claude_md` — Regenerate CLAUDE.md

## Claude Code Skills

Use the following skill commands to run workflows:
- `/prd` — Interactive PRD creation
- `/trd` — Generate TRD from PRD
- `/parse-prd` — Decompose PRD into tasks
- `/brainstorm` — Break down task into subtasks
- `/refine` — Analyze impact of requirement changes
- `/next` — Recommend next task to work on
- `/task-status` — Project progress summary

## Workflows

### Implementing a New Feature
1. Use `/next` to check the next task
2. `set_task_status` → in-progress
3. After implementation, `set_task_status` → done

### PRD → Task Creation
1. Create PRD interactively with `/prd`
2. Write implementation plan with `/trd`
3. Decompose into tasks with `/parse-prd`

### When Requirements Change
1. Analyze affected tasks with `/refine`
2. Review and update affected tasks

## File Structure
- `.taskflow/config.json` — Project settings
- `.taskflow/prd.md` — PRD document
- `.taskflow/trd.md` — TRD document
- `.taskflow/tasks/task-{NNN}.md` — Individual task files
