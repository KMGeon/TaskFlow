# Step-by-Step Development Workflow

## Before Writing Code
1. **Understand the requirement** — Read the task/PRD thoroughly
2. **Check existing code** — Search for related implementations before creating new ones
3. **Plan the approach** — Identify which files to modify and what tests to write

## Implementation Flow
1. **Write the test** — Define expected behavior first
2. **Write minimal code** — Just enough to pass the test
3. **Refactor** — Clean up while tests stay green
4. **Verify** — Run full test suite (`npm run test`)
5. **Type check** — Run `npm run typecheck`
6. **Lint** — Run `npm run lint`

## PR Checklist
- [ ] Tests pass (`npm run test`)
- [ ] Type check passes (`npm run typecheck`)
- [ ] No lint errors (`npm run lint`)
- [ ] New code has test coverage
- [ ] Commit messages follow conventions
- [ ] No secrets or .env files committed

## Debugging
1. Read the error message carefully
2. Reproduce the issue with a test
3. Identify root cause (don't just patch symptoms)
4. Fix and verify the test passes
5. Check for similar issues elsewhere
