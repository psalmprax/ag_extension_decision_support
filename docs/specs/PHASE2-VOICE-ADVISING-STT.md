# Decision Memo: WhatsApp Voice-Note Advisories — STT Provider (Phase 2.2)

**Status:** Spike complete — recommendation ready for sign-off
**Decision needed from:** Product owner (provider + budget approval)

## Recommendation

**Primary: SALT/Sunbird "Whisper 51 African Languages"** (Whisper Large v3 fine-tune purpose-built for African languages) — **fallback chain: Groq Whisper large-v3-turbo ($0.000667/min) → gpt-4o-mini-transcribe ($0.003/min)** for English/Swahili.

## Why

1. **Chichewa is the deciding language** — and generic Whisper does not officially support it (no Chichewa language token in Whisper; Google Chirp 3's supported-language list includes Swahili but not Chichewa).
2. **SALT measured WER on Chichewa: 27.3%** (98 samples) — and it beats Gemini, GPT-4o-transcribe, and Meta omniASR on most of its 51 African languages. It also covers our other locales: Swahili 8.7%, Bemba 40.8%, Shona 19.6%, Yoruba 38.4%, Zulu 20.7%, plus African-accented English (4.1%) and French (3.2%).
3. **Cost comparison (2026 rates):**

| Provider | $/min | Chichewa | Notes |
|---|---|---|---|
| SALT Sunbird (self-host or API) | ~self-host GPU or partner pricing | **27.3% WER, purpose-built** | Also has African-language TTS for replies |
| Groq Whisper turbo | 0.000667 | generic large-v3 (weak) | 8–12s per hour of audio; cheapest |
| gpt-4o-mini-transcribe | 0.003 | generic | good English/accented English |
| Whisper API (whisper-1) | 0.006 | generic | safe default, batch-only |
| Google Chirp 3 | 0.016 (0.004 batch) | **not supported** | Swahili GA; strongest denoiser |

4. **Voice replies**: Sunbird's catalog includes African-language TTS — one vendor covers the full voice loop (voice note → STT → advisory → TTS audio back over WhatsApp).

## Pipeline (fits existing infra)

WhatsApp voice note (existing inbound webhook, `routes/whatsapp.ts`) → download OGG → STT (SALT primary, Groq fallback on failure/English) → existing chatbot/RAG pipeline → text advisory → TTS → WhatsApp audio reply. Officer-side dictation reuses the same STT service (replaces/augments current `chatbotSpeech` route).

## Acceptance gate before enabling

20-sample field test per language (Chichewa, Swahili, English) with real WhatsApp voice notes:
- Chichewa WER ≤ 35% on agricultural vocabulary (SALT's 27.3% benchmark suggests achievable)
- Advisory comprehension test: agronomist confirms the transcribed question preserves intent in ≥90% of samples
- Latency ≤ 30s end-to-end for a 30s voice note

## Budget sketch (illustrative)

10,000 voice notes/month × 30s avg = 5,000 min → Groq fallback-only ≈ $3.3/mo; SALT hosted (if ~$0.002/min partner rate) ≈ $10/mo; self-hosted SALT on one GPU ≈ $350–700/mo infra but unlimited volume + data stays in-house.

## Risks

- SALT availability/SLA as a research-derived service — mitigate with the Groq/gpt-4o-mini fallback chain and by caching transcripts
- Noisy field audio degrades all models (Google's Chirp 3 denoiser is best-in-class but lacks Chichewa) — accept: farmers can repeat; text fallback always shown
- Hallucination on very short/silent clips — enforce min-duration + empty-transcript guard
