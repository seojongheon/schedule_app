# TDD Development Rules and AI Coding Guidelines

This document defines the rules for building reliable, low-defect software through Test-Driven Development. It also serves as guidance for AI coding agents. Follow this process strictly when implementing features and writing tests.

## 1. Core TDD Lifecycle

Every feature must be developed in the order of `write a failing test -> implement the minimum code -> refactor`. Do not move to the next phase before the previous phase is complete.

### Phase 1: Write a Failing Test

- Before writing any production code, first write a test that verifies the expected behavior of the feature.
- Because the target code does not exist or is not implemented yet, the test must fail first.
- Design unit, integration, and, when needed, E2E test cases during this phase.
- Do not treat a test as a valid implementation guide unless its initial failure has been confirmed.

### Phase 2: Implement the Minimum Code to Pass

- The only goal is to make the failing test pass.
- Write the fastest and simplest production code that satisfies the test.
- In this phase, passing the test takes priority over perfect design, deduplication, or abstraction.
- Simple hardcoding or temporary implementation is allowed when appropriate.
- Any temporary implementation must be cleaned up during the refactoring phase.

### Phase 3: Refactor and Improve the Code

- Improve code quality while keeping all tests green.
- Remove duplication and improve readability.
- Apply design patterns when they provide clear value.
- Restructure code to follow the project's architecture rules and responsibility boundaries.
- Run tests repeatedly during refactoring to verify that behavior has not been broken.

## 2. Test Types and Scope

For major business features, write unit, integration, and E2E tests according to the risk and scope of the change. Core user-facing flows should have all three levels whenever practical.

### Unit Tests

- Target domain entities, use cases, helper functions, and pure utility functions.
- Block direct integration with external databases, networks, and external SDKs such as Supabase.
- Use mocks, fakes, or stubs to verify pure code logic quickly.
- Prioritize domain rules and use-case branching logic.

### Integration Tests

- Target data-layer repository implementations, presentation-layer custom hooks, API route handlers, and similar boundaries.
- Verify the flow of data across multiple connected modules.
- Check database client interaction, mapper behavior, and DTO-to-entity mapping.
- When external systems are difficult to use directly, use test clients or mock servers.

### E2E Tests

- Target actual page rendering and user scenario flows.
- Examples include signing in, creating a product, creating an order, and checking dashboard data.
- Use tools such as Playwright or Cypress to verify browser interactions and end-to-end system behavior.
- Treat E2E tests as the final safety net that validates core behavior from the user's perspective.

## 3. Test Execution and Quality Assurance

### Run the Full Test Suite

- After feature implementation and refactoring are complete, run the test runner.
- Confirm that the full test suite passes before considering the work complete.
- If tests cannot be run, clearly record the reason and the remaining risk.

### Handle Failing Tests

When a test fails, resolve it in this order:

1. Analyze the failure log and stack trace carefully.
2. Determine whether the failure comes from a production bug or an incorrect test assertion.
3. Summarize the root cause and the fix direction.
4. Modify the code.
5. Run the tests again.
6. Repeat until all tests pass.

### Coverage Threshold

- Keep overall project test coverage at 80% or higher.
- In particular, keep line coverage and function coverage at 80% or higher.
- Check the coverage report when adding new features.
- If coverage drops below 80%, add more test cases before moving on.

## 4. AI Coding Agent Instructions

- When asked to implement a feature, identify the testable units first.
- Inspect existing test files and patterns, then write a failing test in the same style.
- Confirm the test failure before implementing the minimum code.
- After implementation, run tests. If they pass, proceed to refactoring.
- Run tests again after refactoring.
- Write unit tests first for domain logic.
- Write integration tests for code that crosses boundaries, such as repositories, hooks, and route handlers.
- Consider E2E tests for core user flows.
- Do not write production code without tests.
- Include test results and any remaining test gaps in the completion report.

## 5. Implementation Checklist

- Was the test written before the production code?
- Did the new test fail first?
- Was the initial implementation limited to the minimum needed to pass the failing test?
- Was refactoring performed only while all tests were passing?
- Were tests run again after refactoring?
- Were unit, integration, and E2E test scopes separated appropriately?
- Were external dependencies isolated with mocks or fakes?
- Is overall test coverage still at least 80%?
- If tests could not be run, was the reason and risk clearly recorded?
