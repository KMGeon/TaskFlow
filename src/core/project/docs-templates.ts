export const DOCS_TEMPLATES: Record<string, string> = {
  guideline: `# Project Guideline

## Naming Conventions
- **Files**: kebab-case (\`parse-prd-flow.ts\`)
- **Components**: PascalCase (\`TaskCard.tsx\`)
- **Functions/Variables**: camelCase
- **Types/Interfaces**: PascalCase
- **Constants**: UPPER_SNAKE_CASE
- **Test files**: \`*.test.ts\` or \`__tests__/*.test.ts\` (co-located)

## Import Conventions
- Use path alias (\`@/*\` etc.) when available — avoid deep relative paths
- Group imports: external → internal → relative
- No circular imports between modules/features

## Module Structure
- Keep modules self-contained: co-locate related code (logic, types, tests)
- Separate concerns by layer (API, UI, business logic)
- Shared code belongs in \`lib/\` or \`utils/\` — not inside a feature module

## General Principles
- Prefer composition over inheritance
- Keep public API surface small — export only what's needed
- Avoid god files (>300 lines) — split by responsibility
- Configuration and constants belong in dedicated files, not scattered inline
`,

  "clean-code": `# Clean Code Guidelines

## Principles
- **Single Responsibility**: One function/module = one job
- **DRY**: Extract only when duplicated 3+ times. Premature abstraction is worse than duplication
- **KISS**: Simplest solution that works. No over-engineering
- **YAGNI**: Don't build what you don't need yet

## Functions
- Max 20 lines per function (guideline, not hard rule)
- Max 3 parameters. Use an options object for more
- Name functions with verbs: \`createTask\`, \`parseMarkdown\`, \`validateInput\`
- Early return over nested conditionals

## Error Handling
- Use custom error classes per domain
- Let errors bubble up — catch only at boundaries (API routes, CLI commands)
- Never swallow errors silently

## Types
- Prefer \`type\` over \`interface\` for consistency (unless extending)
- Use schema-first approach (Zod, etc.); derive types from schemas
- Avoid \`any\` — use \`unknown\` and narrow

## Code Smells to Avoid
- God files (>300 lines) — split by responsibility
- Boolean parameters — use named options or separate functions
- Magic strings/numbers — use constants or enums
- Commented-out code — delete it, git has history
`,

  git: `# Git Conventions

## Branch Naming
\`\`\`
feat/{description}      # New feature
fix/{description}       # Bug fix
refactor/{description}  # Refactoring
docs/{description}      # Documentation
chore/{description}     # Maintenance
\`\`\`

## Commit Messages
Follow Conventional Commits:
\`\`\`
type(scope): description

feat(kanban): add drag-and-drop task reordering
fix(cli): handle missing config file gracefully
refactor(core): extract task validation logic
test(prd): add parser edge case coverage
\`\`\`

### Types
- \`feat\` — new feature
- \`fix\` — bug fix
- \`refactor\` — code restructuring (no behavior change)
- \`test\` — adding/updating tests
- \`docs\` — documentation only
- \`chore\` — build, deps, config changes
- \`style\` — formatting (no logic change)

## Rules
- Commit small, atomic changes
- Never commit secrets, \`.env\` files, or credentials
- Keep commits buildable — don't break the build mid-branch
- Squash WIP commits before PR
`,

  tdd: `# Test-Driven Development

## Philosophy
- Write tests first for new features and bug fixes
- Tests document behavior — they are living specifications
- Fast feedback: unit tests should run in <1s per file

## Test Pyramid
1. **Unit tests** — core logic, utils, schemas (most coverage)
2. **Integration tests** — API routes, database queries (moderate)
3. **E2E tests** — critical user flows only (fewest)

## Conventions
- Co-locate tests: \`*.test.ts\` next to source or in \`__tests__/\`
- Use \`describe\` blocks to group by function/scenario
- Test names: \`it('should {expected behavior} when {condition}')\`
- One assertion concept per test

## Patterns
\`\`\`typescript
// Arrange
const input = createMockTask({ status: 'todo' });

// Act
const result = updateTaskStatus(input, 'in-progress');

// Assert
expect(result.status).toBe('in-progress');
\`\`\`

## What to Test
- Business logic and transformations
- Edge cases and error paths
- Schema validation
- API response shapes

## What NOT to Test
- Framework internals (routing, rendering)
- Third-party library behavior
- Implementation details (private functions, internal state)
- Trivial getters/setters
`,

  "step-by-step": `# Step-by-Step Development Workflow

## Before Writing Code
1. **Understand the requirement** — Read the task/PRD thoroughly
2. **Check existing code** — Search for related implementations before creating new ones
3. **Plan the approach** — Identify which files to modify and what tests to write

## Implementation Flow
1. **Write the test** — Define expected behavior first
2. **Write minimal code** — Just enough to pass the test
3. **Refactor** — Clean up while tests stay green
4. **Verify** — Run full test suite
5. **Type check** — Run type checker
6. **Lint** — Run linter

## PR Checklist
- [ ] Tests pass
- [ ] Type check passes
- [ ] No lint errors
- [ ] New code has test coverage
- [ ] Commit messages follow conventions
- [ ] No secrets or .env files committed

## Debugging
1. Read the error message carefully
2. Reproduce the issue with a test
3. Identify root cause (don't just patch symptoms)
4. Fix and verify the test passes
5. Check for similar issues elsewhere
`,

  security: `# Security Guidelines

## Authentication & Authorization
- All API routes must verify authentication
- Validate user session on every request — never trust client-side auth state
- Use row-level or resource-level access control for data isolation

## Input Validation
- Validate ALL external input with schemas at the boundary
- Never trust query params, request bodies, or URL params directly
- Sanitize user-generated content before rendering (XSS prevention)

## Secrets Management
- Store secrets in environment variables only
- Never commit \`.env\`, API keys, or credentials
- Use \`.env.local\` for local development (ensure it's in \`.gitignore\`)

## API Security
- Use parameterized queries — never concatenate user input into queries
- Rate limit public endpoints
- Return generic error messages to clients — log details server-side

## Dependencies
- Keep dependencies up to date
- Review new dependencies before adding (check maintenance, size, security)
- Run security audits periodically

## What to Never Do
- Expose internal error stacks to clients
- Store passwords in plain text
- Use \`eval()\` or dynamic code execution with user input
- Disable strict type checks for convenience
`,
};
