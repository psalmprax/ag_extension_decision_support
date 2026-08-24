# Spec: Farmer Self-Service PWA (Phase 3.1)

**Status:** Stakeholder spec — requires product/business sign-off before build
**Prerequisite:** Phase 2.1 (on-device model) recommended; Phase 1 efficacy loop feeds farmer trust signals

## Problem

The product is officer-centric. Farmers interact only via WhatsApp/onboarding. A self-service surface multiplies officer capacity ~10× and captures the farmer-side data loop (self-diagnoses, outcomes) that competitors (Plantix: 100M+ downloads) built businesses on.

## Scope

A lightweight farmer-facing PWA (`farmers.gpexts.com`), installable, offline-capable, low-bandwidth (<500KB initial shell), available in the 23 existing locales.

### Core flows
1. **Auth**: phone-number OTP (SMS via existing smsService); farmer role already exists in RBAC (`authorize` middleware) — no new auth system, reuse JWT
2. **Self-diagnosis**: camera → on-device model (Phase 2.1) when offline / backend multimodal when online → results in farmer's language → "connect to my officer" escalation button (creates visit request)
3. **My farm**: profile, fields (existing Field model), visit history (read-only), assigned officer contact
4. **Advisory inbox**: proactive advisories (Phase 1.2) the farmer is opted into; voice-note playback when TTS lands (Phase 2.2)
5. **Market prices**: read-only view of existing market price data
6. **Language**: full i18n via existing locale system; voice-first UX patterns for low-literacy users (large touch targets, icon-led nav, TTS playback of advisories)

### Explicitly out of scope v1
Payments, chat with AI (officer-mediated only), social features

## Technical shape

- New minimal React app (share `ag-extension-shared` package: ErrorBoundary, api schemas) OR a route-subtree of the existing frontend behind role gating — **decision point**: separate app (cleaner bundle, ~150KB shell) vs same app (faster to ship). Recommendation: separate app reusing the shared package + design tokens.
- Backend: ~6 new endpoints under `/api/v1/farmer-mobile/*` (profile, fields, visits, advisories, diagnosis-submit, escalation) — all scoped by farmer role + own-data governance rules (`dataGovernanceService.getFarmerForPrincipal` pattern exists)
- Rate limiting: existing perUser tiers; farmer tier = 150/15min already default

## Success metrics

- 30% of active farmers self-serve one diagnosis within 60 days of launch
- Officer time-per-farmer-visit reduced 20%
- Escalation→visit conversion ≥ 40%

## Open questions for stakeholders

1. Data ownership/consent framing for farmer self-service data (DataConsent model exists — needs farmer-facing copy)
2. Which districts pilot first
3. SMS OTP budget (smsService exists; ~$0.01–0.03/OTP via Africa's Talking)
