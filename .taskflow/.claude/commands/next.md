# Next Task Recommendation

Recommend the next task to work on based on dependencies and priority.

## Available MCP Tools
- `mcp__taskflow__get_next_task` — Get recommended tasks
- `mcp__taskflow__read_task` — Read task details
- `mcp__taskflow__set_task_status` — Change task status

## Workflow

1. Get recommended tasks with `mcp__taskflow__get_next_task`.
2. For each recommended task:
   - Read details with `mcp__taskflow__read_task`.
   - Explain the recommendation reason (dependencies resolved, high priority, etc.).
3. When the user selects a task, change its status to `in-progress` with `mcp__taskflow__set_task_status`.

## Rules
- Show a maximum of 3 recommendations.
- Clearly explain the reason for each recommendation.
- Always respond to the user in Korean.
