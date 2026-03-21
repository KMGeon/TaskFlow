# PRD → Task Decomposition

Analyze the PRD and automatically generate individual task files.

## Available MCP Tools
- `mcp__taskflow__read_prd` — Read .taskflow/prd.md
- `mcp__taskflow__list_tasks` — Check existing tasks (prevent duplicates)
- `mcp__taskflow__create_task` — Create a task

## Workflow

1. Read the PRD with `mcp__taskflow__read_prd`.
2. Check existing tasks with `mcp__taskflow__list_tasks`.
3. Analyze PRD functional requirements and derive task list:
   - Title, description, and priority for each task
   - Dependencies between tasks
   - Expected complexity
4. Show the derived task list to the user and get confirmation.
5. After approval, create tasks one by one with `mcp__taskflow__create_task`.
6. Show a summary of the creation results.

## Task Decomposition Criteria
- Must-Have features → high priority tasks
- Nice-to-Have features → low priority tasks
- Split large features into multiple tasks
- Specify dependencies in the dependencies field
- Skip if duplicate with existing tasks

## Rules
- Each task should be completable within 1-2 days.
- Always show decomposition results and get user approval before creating.
- Always respond to the user in Korean.
