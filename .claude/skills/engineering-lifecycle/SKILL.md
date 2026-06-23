---
name: engineering-lifecycle
description: Use when initiating any feature, bugfix, or code modification task. Enforces strict engineering lifecycle phases, phase gates, anti-rationalization tables, and quality checklists.
metadata:
  category: discipline
  triggers: new feature, bugfix, refactor, code change
---

# Engineering Lifecycle & Discipline Guidelines

This skill enforces strict software engineering discipline for all coding tasks, preventing agent rationalization and ensuring code quality, security, and test coverage standards.

---

## 🚦 Phase Gates

You MUST complete each phase and satisfy its gate before starting the next. No exceptions.

### Phase 1: Define (`/spec`)
- **Gate**: Complete clarity on requirements.
- **Action**: Identify all affected files, schemas, configs, and dependencies. If requirements are underspecified, list open issues.

### Phase 2: Plan (`/plan`)
- **Gate**: Approved `implementation_plan.md` artifact.
- **Action**: Detail exact files to modify/create, unit/integration test strategies, and potential regressions. **Stop and wait for the user to approve this plan before executing.**

### Phase 3: Build (`/build`)
- **Gate**: Functional implementation with unit tests written alongside code.
- **Action**: Implement changes cleanly. Write modular components (<300 lines). Avoid placeholders, dummy values, or stub functions.

### Phase 4: Verify (`/test`)
- **Gate**: Green test runner output (`agent-helper.sh test-all`) and zero new lint warnings.
- **Action**: Fix all lints and typescript compilation issues. Run E2E suites if UI changes are made.

### Phase 5: Review (`/review`)
- **Gate**: Complete self-review of changes.
- **Action**: Check for security leaks, empty catch blocks, input sanitization (`DOMPurify`), and clean logger instrumentation.

### Phase 6: Ship (`/ship`)
- **Gate**: Comprehensive `walkthrough.md` generated with validation proof.
- **Action**: Provide the user with a concise summary of changes and validation checks.

---

## 🚫 Anti-Rationalization Table

AI agents tend to rationalize shortcuts under time or token constraints. Below is a list of forbidden excuses and their corresponding realities.

| Agent Excuse | Engineering Reality |
| :--- | :--- |
| *"This change is too simple to need a plan/tests."* | Simple code is where silent regressions happen. All logic edits require an update to the corresponding test suite. |
| *"I'll write the tests after the code is working."* | Tests written after code tend to be weak assertion stubs. Write tests alongside or before the implementation to define requirements. |
| *"This dashboard component needs to manage a lot of state, so keeping it in a single large file (500+ lines) makes sense."* | Large files are unmaintainable. Extract custom hooks for state management and split the UI into focused sub-components. |
| *"I will write direct SQL scripts to update the database."* | All schema and data changes MUST use Prisma migrations (`prisma migrate dev`) to maintain schema consistency and integrity. |
| *"This is a styling/CSS tweak, so we don't need tests."* | Even visual edits can break layouts. Run Playwright E2E smoke tests or verify page rendering locally. |
| *"I will print to console.log temporarily to debug."* | Global `console` outputs are forbidden in production. Use Winston logger (`logger.info` or `logger.error`) on the backend. |
| *"We can use `dangerouslySetInnerHTML` directly since the data is trusted."* | Trusted data sources can be compromised. Always wrap inputs in `DOMPurify.sanitize()` before rendering. |

---

## 🚩 Red Flags — STOP and Start Over

If you find yourself doing any of the following, delete the draft change, correct your course, and start the phase over:

- [ ] Creating components with file sizes exceeding 400 lines.
- [ ] Writing `try {} catch (e) {}` with empty catch blocks or without logging/rethrowing.
- [ ] Using typescript `any` or casting types (`as unknown as ...`) to bypass compiler checks.
- [ ] Hardcoding URLs, credentials, tokens, or default keys instead of using env variables.
- [ ] Committing or leaving unused imports or disabled linter comments (`// eslint-disable-line`).
- [ ] Commenting out failing tests to make the suite pass.
- [ ] Writing dummy/mock responses in services instead of integrating with target endpoints.

---

## 🚪 Escape Hatches (Legitimate Exceptions)

You may bypass strict planning/test gates ONLY in the following scenarios:
1.  **Spike Code / Exploratory Work**: Throwaway scripts placed inside `.gemini/antigravity/brain/<conversation-id>/scratch/` that will never be committed or deployed.
2.  **Formatting & Comments**: Correcting syntax formatting, adding docstrings, or modifying markdown documentation.
3.  **Trivial Configurations**: Adding a file to `.gitignore` or registering a standard environment variable key in `.env.example`.
