# PRD Creation

Create a PRD (Product Requirements Document) through interactive conversation with the user.

## Available MCP Tools
- `mcp__taskflow__scan_codebase` — Scan codebase file list/signatures
- `mcp__taskflow__save_prd` — Save PRD to .taskflow/prd.md

## Workflow

1. First, scan the current project state with `mcp__taskflow__scan_codebase`.
2. Collect requirements by asking the user **one question at a time**:
   - Project name, one-line summary
   - Target users
   - Problems to solve (Pain Points) and solutions
   - Goals and key metrics (KPIs)
   - Main usage scenarios
   - Must-Have features and Nice-to-Have features
   - Non-functional requirements (performance, security, etc.)
   - Tech stack
   - Scope (in/out)
   - Milestones
   - Risks and mitigation strategies
3. Once sufficient information is gathered, write the PRD in markdown format.
4. After final confirmation from the user, save it with `mcp__taskflow__save_prd`.

## PRD Format

Write in markdown including the following 11 sections:

1. Product Overview
2. Target Users
3. Problems & Solutions (table)
4. Goals & Key Metrics
5. Main Usage Scenarios
6. Functional Requirements (table: #, Feature, Priority)
7. Non-Functional Requirements
8. Tech Stack
9. Scope (In/Out)
10. Milestones
11. Risks & Mitigation Strategies

## Rules
- Ask only one question at a time.
- Present multiple-choice options when possible.
- If the user's answer is vague, ask for clarification.
- Always respond to the user in Korean.
