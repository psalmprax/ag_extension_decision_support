# Coding Principles

1. **Think before coding** — Understand the full context before making changes. Read existing files, understand the architecture, trace the data flow.

2. **Simplicity first** — Choose the simplest solution that works. Don't over-engineer. Don't add abstractions unless they're clearly needed. Prefer flat over nested, concrete over abstract.

3. **Surgical changes only** — Make the minimal change needed. Don't refactor unrelated code. Don't "improve" things that aren't part of the task. Every line changed should serve the goal.

4. **Goal-driven execution** — Stay focused on the user's actual goal. Don't get sidetracked by interesting but irrelevant improvements. Ship what was asked for.

## Project-Specific Rules

- Follow existing patterns in the codebase (service singletons, Zod-based MCP tools, Express Router patterns)
- Use path aliases (`@/`) for imports in backend code
- Use TypeScript strict mode conventions
- Preserve all existing comments and documentation
- Run `npm run lint` before considering work complete
- Agricultural domain: respect real-world data constraints (no fake data, prefer real APIs)
