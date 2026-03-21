# Requirement Change Analysis

Analyze the impact of requirement changes on existing tasks and update them.

## Available MCP Tools
- `mcp__taskflow__read_prd` — Read current PRD
- `mcp__taskflow__list_tasks` — List all tasks
- `mcp__taskflow__read_task` — Read individual task
- `mcp__taskflow__update_task` — Update a task
- `mcp__taskflow__create_task` — Create a new task
- `mcp__taskflow__delete_task` — Delete an unnecessary task
- `mcp__taskflow__save_prd` — Update PRD

## Workflow

1. Confirm the changes with the user:
   - Listen to an explanation of what requirements changed, or
   - Review changed files/diffs
2. Read the current PRD with `mcp__taskflow__read_prd`.
3. List all tasks with `mcp__taskflow__list_tasks`.
4. Identify tasks affected by the changes:
   - Tasks that need modification
   - Tasks that need to be added
   - Tasks that are no longer needed
5. Show the impact analysis results to the user in a table.
6. After user approval:
   - Update with `mcp__taskflow__update_task`
   - Add with `mcp__taskflow__create_task`
   - Delete with `mcp__taskflow__delete_task`
7. If needed, update the PRD with `mcp__taskflow__save_prd`.

## Rules
- Clearly show before/after comparison of changes.
- Always get user approval before making modifications.
- Always respond to the user in Korean.
