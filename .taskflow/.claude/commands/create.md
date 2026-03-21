# Feature Creation (TRD + Task Decomposition)

Define a single feature requirement through conversation, write a TRD (Task Implementation Plan), and decompose it into detailed tasks.

## Available MCP Tools
- `mcp__taskflow__scan_codebase` — Scan codebase file list/signatures
- `mcp__taskflow__list_tasks` — Check existing tasks (prevent duplicates)
- `mcp__taskflow__create_task` — Create a task
- `mcp__taskflow__read_prd` — Read PRD (for reference if available)

## Workflow

### Phase 1: Requirements Gathering
1. Scan the current project state with `mcp__taskflow__scan_codebase`.
2. If a PRD exists, read it with `mcp__taskflow__read_prd` for context.
3. Collect requirements by asking the user **one question at a time**:
   - What feature they want to build
   - User scenario (who, when, how it's used)
   - Technical constraints
   - Success criteria
   - Priority

### Phase 2: TRD Writing
Once sufficient information is gathered, write the TRD in the following format:

```markdown
# {Feature Name} — Task Implementation Plan

## Goal
(One-sentence goal summary)

## Task List

### 1. {Task Title}
- **Description:** (Detailed description)
- **Importance:** MUST / SHOULD / COULD
- **Expected Complexity:** (1-10)
- **Expected Urgency:** (1-10)

### 2. {Task Title}
- **Description:** ...
- **Importance:** ...
- **Expected Complexity:** ...
- **Expected Urgency:** ...

(repeat)

## Implementation Order Suggestion
1. {Task Title}
2. {Task Title}
...

## Considerations
- (Technical/business considerations)
- (Security, performance, compatibility, etc.)
```

Get user confirmation after writing the TRD.

### Phase 3: Task Creation
1. Check existing tasks with `mcp__taskflow__list_tasks` (prevent duplicates).
2. After user approval, create each task with `mcp__taskflow__create_task`:
   - title: Task title
   - description: Detailed description including Importance/Complexity/Urgency
   - priority: Urgency value (1-10)
   - dependencies: Based on Implementation Order
3. Save the TRD to `.taskflow/trd-{feature}.md` using the Write tool.

## Task Decomposition Criteria
- Each task should be completable within 4 hours
- Place MUST items first, then SHOULD/COULD
- Specify dependencies between tasks via Implementation Order
- Skip if duplicate with existing tasks
- Minimum 3, maximum 15 tasks

## Rules
- Ask only one question at a time.
- Present multiple-choice options when possible.
- If an answer is vague, ask for clarification.
- TRD and task list must only be saved/created after user approval.
- Always respond to the user in Korean.
