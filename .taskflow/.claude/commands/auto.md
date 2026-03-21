# Auto Implementation Loop

Automatically pick up and implement tasks one by one until all tasks are done.

## Available MCP Tools
- `mcp__taskflow__get_next_task` — Get the next recommended task (by dependency/priority)
- `mcp__taskflow__read_task` — Read task details
- `mcp__taskflow__set_task_status` — Change task status
- `mcp__taskflow__list_tasks` — List all tasks

## Workflow

Repeat the following cycle until no tasks remain:

### 1. Pick Next Task
- Call `mcp__taskflow__get_next_task` to get the highest-priority task with resolved dependencies.
- If no task is returned, all tasks are complete — output `<promise>ALL_DONE</promise>` and stop.

### 2. Read & Understand
- Call `mcp__taskflow__read_task` to get the full description.
- Analyze the task requirements, expected deliverables, and any constraints.
- If the task references other tasks or files, read them for context.

### 3. Implement
- Set the task status to `in-progress` with `mcp__taskflow__set_task_status`.
- Implement the task:
  - Write or modify the necessary code.
  - Follow existing code patterns and conventions in the codebase.
  - Run relevant tests if they exist.
- Keep changes focused — only do what the task describes.

### 4. Verify & Complete
- Verify the implementation works (run tests, type check, etc.).
- If verification passes, set the task status to `done`.
- If verification fails, fix the issues before marking as done.

### 5. Loop
- Go back to step 1 and pick the next task.

## Rules
- Implement one task at a time. Do not skip ahead.
- If a task is blocked or unclear, set status to `blocked` and move to the next one.
- Do not modify tasks that are already `done`.
- After completing each task, briefly report what was done before moving on.
- When all tasks are complete, output `<promise>ALL_DONE</promise>`.
- Always respond to the user in Korean.
