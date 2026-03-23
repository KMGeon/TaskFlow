# Project Guideline

## Naming Conventions
- **Files**: kebab-case (`parse-prd-flow.ts`)
- **Components**: PascalCase (`TaskCard.tsx`)
- **Functions/Variables**: camelCase
- **Types/Interfaces**: PascalCase
- **Constants**: UPPER_SNAKE_CASE
- **Test files**: `*.test.ts` or `__tests__/*.test.ts` (co-located)

## Import Conventions
- Use path alias (`@/*` etc.) when available — avoid deep relative paths
- Group imports: external → internal → relative
- No circular imports between modules/features

## Module Structure
- Keep modules self-contained: co-locate related code (logic, types, tests)
- Separate concerns by layer (API, UI, business logic)
- Shared code belongs in `lib/` or `utils/` — not inside a feature module

## General Principles
- Prefer composition over inheritance
- Keep public API surface small — export only what's needed
- Avoid god files (>300 lines) — split by responsibility
- Configuration and constants belong in dedicated files, not scattered inline
