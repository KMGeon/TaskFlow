# TDD (Test-Driven Development) Guide

## TDD Cycle: Red → Green → Refactor

### 1. Red (Write a Failing Test)
- Express the **expected behavior** of the feature as a test first
- Confirm the test fails (compile errors count as failures)
- Write only one test at a time
- Test names should clearly describe the scenario

```
// Example: "should return user when valid id is provided"
test('should return user when valid id is provided', () => {
  const user = getUserById('user-123');
  expect(user).toEqual({ id: 'user-123', name: 'Alice' });
});
```

### 2. Green (Pass with Minimal Code)
- Write the **simplest possible** code to pass the test
- Don't try to write perfect code
- Hardcoding is fine (the next test will force generalization)
- Ensure existing tests don't break

### 3. Refactor (Improve)
- Improve code while all tests pass
- Remove duplication, improve naming, organize structure
- Test code is also a refactoring target
- Always re-run tests after refactoring

---

## FIRST Principles (Characteristics of Good Tests)

| Principle | Description |
|-----------|-------------|
| **F**ast | Tests run quickly (unit tests: < 100ms) |
| **I**ndependent | No dependencies between tests, order doesn't matter |
| **R**epeatable | Same results in any environment |
| **S**elf-validating | Pass/fail is determined automatically (no manual verification) |
| **T**imely | Written before or immediately after production code |

---

## AAA Pattern (Arrange-Act-Assert)

Every test consists of 3 phases:

```
test('should calculate total with discount', () => {
  // Arrange: Prepare the data and state needed for the test
  const cart = createCart();
  cart.addItem({ name: 'Widget', price: 100, quantity: 2 });
  const discount = { type: 'percentage', value: 10 };

  // Act: Execute the behavior under test
  const total = cart.calculateTotal(discount);

  // Assert: Verify the result
  expect(total).toBe(180);
});
```

### AAA Rules
- Separate each section with a blank line
- **Arrange**: Extract into factory/helper functions when possible
- **Act**: Usually 1 line (call the function under test)
- **Assert**: Verify only one logical concept (multiple expect statements are fine)

---

## Test Pyramid

```
        /  E2E  \          Few (slow, high cost)
       /----------\
      / Integration \      Moderate
     /----------------\
    /    Unit Tests     \  Many (fast, low cost)
   /____________________\
```

### Unit Tests (70-80%)
- Function, class, module level
- Isolate external dependencies with mocks/stubs
- Execution speed: < 100ms
- Scope: business logic, utilities, pure functions

### Integration Tests (15-20%)
- Verify interactions between modules
- Use real DB, API connections (test environment)
- Execution speed: < 5s
- Scope: API endpoints, DB queries, service-to-service integration

### E2E Tests (5-10%)
- Full user scenario flows
- Run in real browser/environment
- Execution speed: < 30s
- Scope: critical user journeys (login, checkout, etc.)

---

## Test Writing Guide

### Test Naming
```
// Pattern: should [expected behavior] when [condition]
'should return empty array when no items match filter'
'should throw ValidationError when email format is invalid'
'should update user name when valid input provided'
```

### Mock / Stub Principles
- Only mock external services (API, DB, filesystem)
- Never mock the code under test itself
- Keep mocks minimal — excessive mocking reduces test value
- Mock return values should match the structure of real data

### Test Isolation
- Each test sets up its own data
- No shared state (global variables, DB state, etc.)
- Reset state with `beforeEach`/`afterEach`
- Never depend on test execution order

### Boundary Value Testing
Always include the following cases:
- Normal input (happy path)
- Empty values (null, undefined, empty string, empty array)
- Boundary values (0, -1, MAX_INT, empty string)
- Invalid types/formats
- Unauthorized access

---

## TDD Workflow Example

```
1. Analyze Requirements
   └→ "Users can log in with email"

2. Write Test List (TODO list)
   ├→ Login succeeds with valid email + password
   ├→ Login fails with non-existent email
   ├→ Login fails with wrong password
   ├→ Login fails with locked account
   └→ Account locks after 5 consecutive failures

3. Repeat Red-Green-Refactor from the first test
   ├→ Red:    test('should return token when valid credentials')
   ├→ Green:  Minimal implementation
   ├→ Refactor: Clean up code
   └→ Move to next test

4. Commit after all tests pass
```

## Checklist

- [ ] Did you write the test before the production code?
- [ ] Did you confirm the test fails first?
- [ ] Does each test verify only one behavior?
- [ ] Does it follow the AAA pattern?
- [ ] Does it include boundary values and error cases?
- [ ] Are mocks used minimally?
- [ ] Can each test run independently?
- [ ] Does the test name clearly describe the scenario?
