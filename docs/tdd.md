# Test-Driven Development

## Philosophy
- Write tests first for new features and bug fixes
- Tests document behavior — they are living specifications
- Fast feedback: unit tests should run in <1s per file

## Test Pyramid
1. **Unit tests** (Vitest) — core logic, utils, schemas
2. **Integration tests** (Vitest) — API routes, database queries
3. **E2E tests** (Playwright) — critical user flows only

## Conventions
- Co-locate tests: `*.test.ts` next to source or in `__tests__/`
- Use `describe` blocks to group by function/scenario
- Test names: `it('should {expected behavior} when {condition}')`
- One assertion concept per test

## Patterns
```typescript
// Arrange
const input = createMockTask({ status: 'todo' });

// Act
const result = updateTaskStatus(input, 'in-progress');

// Assert
expect(result.status).toBe('in-progress');
```

## What to Test
- Business logic and transformations
- Edge cases and error paths
- Schema validation (Zod)
- API response shapes

## What NOT to Test
- Framework internals (Next.js routing, React rendering)
- Third-party library behavior
- Implementation details (private functions, internal state)
- Trivial getters/setters
