---
name: anti-hallucination
description: >-
  Enforces strict evidence-based verification, factual grounding, zero unverified assumptions,
  and prevention of hallucinated dependencies, APIs, or agronomic claims in the Agri-Extension platform.
  Use whenever modifying code, reviewing audits, analyzing agricultural logic, or validating test results.
---

# Anti-Hallucination Protocol (AG-SKILL-AH-01)

This protocol enforces strict epistemic discipline, absolute code-level verification, and zero hallucination across all engineering, architectural, and agricultural tasks within the **Agri-Extension Decision Support Platform**.

In agricultural decision support, inaccurate information or false assumptions do not just break software—they can destroy farmer livelihoods, damage crops through incorrect chemical dosages, violate environmental pesticide regulations, or compromise financial credits. Never state, assume, or infer anything that has not been directly verified against filesystem reality, database schemas, or live test output.

---

## 1. The Core Law of Ground Truth

### 1. Verify Before Asserting
- **Never claim a file exists, defines an export, or has a specific structure** without actively inspecting it using `view_file`, `grep_search`, or `find_by_name`.
- **Never claim a test passed or coverage increased** without executing the test command (`npm run test:backend`, `vitest`, `pytest`) and inspecting the output and exit code.
- **Never claim an API endpoint or Docker service is live** without verifying container status (`docker ps`) and probing the endpoint with `fetch`/`curl`.
- **Always provide exact, clickable file paths** with line numbers (`file:///path/to/file#L10-L20`) when referencing code or configurations.

### 2. Source Code is the Only Reality
- Documentation (`.md`), specifications, pitch decks (`Ag_Extension_Investor_Deck.pptx`), and comments reflect *intent*.
- TypeScript source (`src/**/*.ts`, `src/**/*.tsx`), Prisma schema (`schema.prisma`), and Python agent code define *reality*.
- If documentation conflicts with active code, report the divergence transparently; never alter code to conform to outdated documentation without verifying requirement validity.

---

## 2. Zero-Hallucinated Dependencies

1. **Verify Package Manifests First**:
   - Before importing any npm package in `backend`, `frontend`, or `browser-ext`, verify it exists in the respective `package.json`.
   - Before importing any Python library in `src/agents`, verify it is declared in `ag-extension-dashboard/src/agents/requirements.txt`.
   - Never introduce new third-party dependencies without explicit architectural justification and security review (`npm run security:audit`).

2. **Respect Architectural Boundaries**:
   - **Backend**: Node.js/TypeScript, Express, Prisma ORM, BullMQ, Redis, Winston, Zod. Do not import browser APIs (`window`, `localStorage`, `navigator`) or DOM libraries in backend code.
   - **Frontend / PWA**: React, Vite, Tailwind, Vitest. Do not import Node.js server-side modules (`fs`, `child_process`, `crypto` direct bindings) in frontend components.
   - **Browser Extension**: Manifest V3 WXT structure. Adhere to browser extension sandbox limitations and background service worker constraints.
   - **Agents**: Python 3.10+ with CrewAI, Agent-Zero, and FastAPI. Keep isolated in its virtual environment.

---

## 3. Strict Agronomic & Scientific Ground Truth

Never fabricate, guess, or extrapolate agricultural knowledge:

1. **Pesticides, Fertilizers & Chemical Dosages**:
   - NEVER invent pesticide active ingredients, application rates, spray intervals, or Maximum Residue Limits (MRLs).
   - All agrochemical recommendations must be strictly sourced from verified agricultural registries, manufacturer label datasets, or certified extension databases.

2. **Crop Disease & Diagnostic Grounding**:
   - Diagnostic recommendations (e.g. Fall Armyworm, Maize Lethal Necrosis, Cassava Mosaic Disease) must cite specific visual markers or diagnostic criteria.
   - If an on-device computer vision model or LLM cannot determine a diagnosis with high confidence, state the uncertainty explicitly and route to a human agricultural extension officer. Never produce a high-confidence hallucinated diagnosis.

3. **Agronomic ROI & Carbon Credit Models**:
   - Carbon sequestration equations must adhere to established IPCC Tier 2 Soil Organic Carbon (SOC) guidelines and project specifications in `ARCHITECTURE_PILLARS.md`.
   - Benefit-Cost Ratio (BCR) models must calculate yield gain differentials against verified input cost tables; never use arbitrary hardcoded multipliers without grounding.

4. **Weather & Geo-Hazard Alerts**:
   - Alert thresholds (frost, extreme precipitation, drought index) must be grounded in verified meteorological data from integrated weather providers (Open-Meteo, NOAA) and verified against coordinate bounds.

---

## 4. Database Schema & Contract Reality

1. **Prisma Schema is Sovereign**:
   - Database tables, columns, relations, and enums must match `ag-extension-dashboard/src/backend/prisma/schema.prisma`.
   - Never write Prisma queries referencing non-existent models or fields.
   - Verify schema state using:
     ```bash
     npm run check:drift
     ```

2. **Shared Contract Parity**:
   - All DTOs and WebSocket messages shared between backend and frontend/extension must be defined in `ag-extension-shared`.
   - Ensure contract synchronization using:
     ```bash
     npm run shared:check
     ```

---

## 5. Verification Checklist Before Answering or Shipping

Before stating any implementation is complete or asserting system status:
- [ ] Have I viewed the actual modified lines using `view_file`?
- [ ] Have I verified that all imported modules exist in `package.json` / `requirements.txt`?
- [ ] Did I run `npm run lint` and verify 0 errors?
- [ ] Did I run `npm run test:backend` and `npm run test:frontend` and confirm passing test suites?
- [ ] Did I run `npm run security:test`?
- [ ] Did I run `npm run fallow:check` to confirm no new dead code was introduced?
- [ ] Did I verify Prisma schema alignment via `npm run check:drift`?
- [ ] Are all referenced file paths clickable with markdown file URI links (`file:///...`)?
