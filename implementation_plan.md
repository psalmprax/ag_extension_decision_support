# Implementation Plan: Conversational Voice AI (Phase 2.3.3 & 2.3.4) + In-App Advisory & Form Studio (Pillar 2)

**Status:** Plan Proposed — Awaiting User Approval  
**Classification:** Frontend Voice AI / Backend Public Demo / In-App Visual Builder Studio  

---

## 1. Executive Summary & Goals

This plan executes on all three dimensions requested:
1. **Phase 2.3.3**: Server-side fallback speech-to-text (Whisper) for browsers lacking native Web Speech API + real-time Web Audio API soundwave/frequency equalizer in [`TalkingAssistant.tsx`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/frontend/src/pages/landing/sections/TalkingAssistant.tsx).
2. **Phase 2.3.4**: Seamless cryptographic conversation handoff from landing page into [`FarmerChatPage.tsx`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/frontend/src/pages/FarmerChatPage.tsx) upon user registration, importing active entity slots and advisory history into PostgreSQL.
3. **Pillar 2 (In-App Visual Builder)**: Full production React implementation of the **Advisory & Field Form Studio** in the dashboard (`/advisory-studio`), backed by Prisma schema persistence and offline field PWA sync readiness.

---

## 2. Proposed Changes & Affected Files

### Phase 2.3.3: Voice Audio Enhancements & Server Fallback STT
- **Frontend: `ag-extension-dashboard/src/frontend/src/pages/landing/sections/TalkingAssistant.tsx`**:
  - Add Web Audio API `AudioContext` + `AnalyserNode` connected to a canvas to draw real-time frequency soundwave bars when voice recording is active.
  - Implement `MediaRecorder` audio capture fallback when `window.webkitSpeechRecognition` / `window.SpeechRecognition` is unavailable (e.g. Firefox on Linux, mobile webviews).
  - Stream/POST base64 audio to `/api/v1/chatbot/public-demo/stt`.
- **Backend: `ag-extension-dashboard/src/backend/src/routes/chatbot/publicDemo.ts`**:
  - Add `POST /api/v1/chatbot/public-demo/stt` route guarded by `publicDemoRateLimiter` (10 queries/hr per IP).
  - Decode audio buffer (max 2MB / 30s) and call `AIProviderFactory.getProvider().speechToText(buffer, { language })`.
- **Backend Tests: `ag-extension-dashboard/src/backend/src/__tests__/publicDemo.test.ts`**:
  - Add test case verifying STT endpoint with mocked audio payload, language selection, and rate-limiting.

### Phase 2.3.4: Registration Session Handoff
- **Frontend: `ag-extension-dashboard/src/frontend/src/pages/Register.tsx`**:
  - Check for `ag_ext_talking_session` in `sessionStorage` upon successful sign-up.
  - Call `POST /api/v1/chatbot/import-session` with the newly generated JWT token.
  - Redirect to `/farmer-chat?imported=1` and show toast acknowledging imported advisory history.
- **Backend: `ag-extension-dashboard/src/backend/src/routes/chatbot/importSession.ts` (new)**:
  - Add authenticated route `POST /api/v1/chatbot/import-session`.
  - Validate schema via Zod (`messages`, `entitySlots`).
  - Persist conversation thread and agronomic slot context into database.
- **Backend Route Mount: `ag-extension-dashboard/src/backend/src/routes/chatbot/index.ts`**:
  - Mount `/import-session` route with authentication middleware.

### Pillar 2: In-App Advisory & Field Form Studio (Visual Builder)
- **Database: `ag-extension-dashboard/src/backend/prisma/schema.prisma`**:
  - Add `AdvisoryWorkflow` model (id, title, description, version, stepsJson, status, authorId, createdAt, updatedAt).
- **Backend API: `ag-extension-dashboard/src/backend/src/routes/workflows.ts` (new)**:
  - CRUD endpoints (`GET /api/v1/workflows`, `POST /api/v1/workflows`, `PUT /api/v1/workflows/:id`, `POST /api/v1/workflows/:id/publish`).
- **Frontend: `ag-extension-dashboard/src/frontend/src/pages/AdvisoryStudioPage.tsx` (new)**:
  - Full-featured React component:
    - Component Palette: Crop & Phenology, Soil pH & Acidity Gate, Pest Severity Slider, Camera Diagnostic, Precision Bio-Dosage Calculator.
    - Drag-and-drop / click-to-add step canvas with conditional logic badges (`IF: Crop == "Maize"`).
    - Real-time Mobile PWA simulator preview.
    - Save Draft, Publish, and Export JSON actions.
- **Frontend Navigation & Routing: `App.tsx`, `TabContent.tsx`, `navItems.ts`**:
  - Register `/advisory-studio` route and lazy-load `AdvisoryStudioPage`.
  - Add navigation item with icon to dashboard sidebar under Agricultural Management.

---

## 3. Verification & Quality Gates

1. **Linting**:
   - `npm run lint:frontend` & `npm run lint:backend` (0 errors, 0 warnings, cognitive complexity $\le 15$).
2. **Unit & Integration Tests**:
   - `npm run test:frontend -- src/__tests__/TalkingAssistant.test.tsx`
   - `npm run test:backend -- src/__tests__/publicDemo.test.ts`
   - Add frontend unit test for `AdvisoryStudioPage.test.tsx`.
   - Add backend test for `workflows.test.ts`.
3. **Regression & Safety**:
   - `npm run fallow:check` (verify delta $\le 0$ against baseline 255).
   - `npm run verify:anti` (verify anti-flop and anti-hallucination suites).
   - `npm run build:frontend` & `npm run build:backend` (clean production compilation).

---

## 4. User Review & Decision Point

Please review the plan above. Once approved, I will begin execution sequentially starting with **Phase 2.3.3 (Voice STT Fallback & Web Audio Waveform)**, followed by **Phase 2.3.4 (Session Handoff)**, and finally **Pillar 2 (In-App Advisory Studio)**.
