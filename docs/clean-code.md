# Clean Code Guidelines

## Principles
- **Single Responsibility**: One function/module = one job
- **DRY**: Extract only when duplicated 3+ times. Premature abstraction is worse than duplication
- **KISS**: Simplest solution that works. No over-engineering
- **YAGNI**: Don't build what you don't need yet

## Functions
- Max 20 lines per function (guideline, not hard rule)
- Max 3 parameters. Use an options object for more
- Name functions with verbs: `createTask`, `parseMarkdown`, `validateInput`
- Early return over nested conditionals

## Error Handling
- Use custom error classes per domain (`TaskNotFoundError`, `ValidationError`)
- Let errors bubble up — catch only at boundaries (API routes, CLI commands)
- Never swallow errors silently

## Types
- Prefer `type` over `interface` for consistency (unless extending)
- Use Zod schemas as single source of truth; derive types with `z.infer<>`
- Avoid `any` — use `unknown` and narrow

## Code Smells to Avoid
- God files (>300 lines) — split by responsibility
- Boolean parameters — use named options or separate functions
- Magic strings/numbers — use constants or enums
- Commented-out code — delete it, git has history
