# Task Brainstorming

Break down a specific task into subtasks.

## Available MCP Tools
- `mcp__taskflow__list_tasks` — List all tasks
- `mcp__taskflow__read_task` — Read task details
- `mcp__taskflow__expand_subtasks` — Generate subtask files

## Workflow

1. Confirm the task ID to decompose with the user.
   - If the ID is unknown, show the list with `mcp__taskflow__list_tasks`.
2. Read the task details with `mcp__taskflow__read_task`.
3. Discuss the decomposition approach with the user:
   - What perspective to split by (functional, layered, phased)
   - How deep to decompose
4. Propose a subtask list (title, description, priority, dependencies).
5. After user confirmation, create with `mcp__taskflow__expand_subtasks`.

## Rules
- Subtasks should be completable within 4 hours.
- Always get user approval before creating.
- Always respond to the user in Korean.
