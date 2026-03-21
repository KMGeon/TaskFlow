# TRD Creation (Task Implementation Plan)

Create a technical implementation plan (TRD) based on the PRD.

## Available MCP Tools
- `mcp__taskflow__read_prd` — Read .taskflow/prd.md
- `mcp__taskflow__list_tasks` — Check existing task list

## Workflow

1. Read the PRD with `mcp__taskflow__read_prd`.
2. Check for existing tasks with `mcp__taskflow__list_tasks`.
3. Analyze the PRD and write a phase-by-phase TRD:
   - Purpose and deliverables for each phase
   - Technical decisions (libraries, patterns, architecture)
   - Dependencies between phases
   - Risks and alternatives
4. Get confirmation from the user section by section.
5. After final approval, save to `.taskflow/trd.md` using the Write tool.

## TRD Format

# {Project Name} — TRD (Task Implementation Plan)

## Architecture Overview
(System structure, main components, data flow)

## Phase 1: {Phase Name}
### Purpose
### Deliverables
### Technical Decisions
### Task List
### Dependencies
### Risks

## Phase 2: ...

## Rules
- Reflect PRD priorities (Must-Have → Nice-to-Have).
- Each Phase should be an independently deployable unit.
- Always respond to the user in Korean.
