# Ag-Extension Platform: Master Cybersecurity & Threat Response Playbook

## 🏛️ Executive Summary & Security Posture

The **Ag-Extension Decision Support Platform** operates an enterprise-grade defense-in-depth security architecture protecting agricultural data, farmer PII, telemetry streams, and AI-assisted decision making across multiple operational domains (Web SPA, Mobile PWA, Edge Browser Extension, Backend APIs, and Python Multi-Agent Systems).

This **Cybersecurity Playbook** documents the platform's threat assessment, operational attack surface, residual vulnerability mitigations, and standard incident response runbooks.

---

## 🎯 Threat Landscape & Vulnerability Assessment Matrix

| Threat Category | Baseline Vulnerability Risk | Residual Risk After Controls | Primary Defense Mechanism |
| :--- | :---: | :---: | :--- |
| **Volumetric & Compute DoS (Heavy Media / Whisper / AI)** | High | **Low** | Strict payload size ceilings (`16MB`), usage rate limiting (`checkUsageLimit`), and asynchronous processing. |
| **Indirect & Direct Prompt Injection** | High | **Low** | Perimeter [`securityGate`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/middleware/securityGate.ts), [`aegisShield`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/security/aegisShield.ts) AST regex filters, and tool result sanitization in [`mcpAdapter.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/mcpAdapter.ts). |
| **Distributed Session Desync (Multi-Node Cluster)** | Moderate | **Low** | Redis-backed distributed sliding window in [`sharedState.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/sharedState.ts) + DB-backed session invalidation in [`sessionService.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/sessionService.ts). |
| **Webhook Spoofing & Replay Attacks** | Moderate | **Low** | Timing-safe HMAC verification via [`webhookSignature.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/middleware/webhookSignature.ts) (Meta SHA-256 / Twilio SHA-1). |
| **Stolen Mobile Devices & Edge Data Theft** | High | **Low** | AES-256-GCM client encryption via [`encryptedStorageService.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/frontend/src/services/encryptedStorageService.ts) and automated [`remoteWipeService.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/frontend/src/services/remoteWipeService.ts). |
| **Agronomic Hallucinations / Chemical Overdosing** | High | **Very Low** | Deterministic boundary guard in [`agronomicSafetyGuard.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/security/agronomicSafetyGuard.ts) enforcing FAO limits. |

---

## 🛡️ Technical Mitigations & Controls Implemented

### 1. Compute & Media Denial of Service (DoS) Hardening
- **Threat**: Attackers or runaway clients transmitting oversized base64 audio/video payloads that choke memory buffers or lock CPU threads during Whisper transcription, or supplying zero-byte/malformed payloads that fall through to stub advice.
- **Controls Implemented**:
  - `MAX_AUDIO_BASE64_LENGTH` ($16 \text{ MB} \approx 12 \text{ MB binary}$) ceiling enforced in [`routes/pillars/voice.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/routes/pillars/voice.ts) and [`routes/ai/speech.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/routes/ai/speech.ts).
  - Payloads exceeding bounds return HTTP `413 (Payload Too Large)` immediately before allocating buffers.
  - Zero-byte, empty, or unparseable base64 inputs are rejected with HTTP `400 (Bad Request)` before hitting transcription services, preventing fallthrough to offline test stubs.
  - Per-user and per-IP adaptive rate limiting (`checkUsageLimit('speech')`) prevents continuous looping.

### 2. Indirect Prompt Injection via Tool Outputs & External Sources
- **Threat**: External data sources (such as syndicated agronomic feeds, untrusted farmer WhatsApp memos, vector search RAG retrieval chunks, or external web tool results) containing hidden instructions (`<|im_start|>`, `ignore previous instructions`, `send env keys`).
- **Controls Implemented**:
  - **Tool Execution Sanitization**: In [`mcpAdapter.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/mcpAdapter.ts#L115-L125), all tool results are passed through `aegisShield.sanitizeToolResult()` before returning to LLMs.
  - **RAG Knowledge Sanitization**: In [`askPipeline.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/knowledge/askPipeline.ts#L43-L46), retrieved context chunks from vector search and web fallbacks are sanitized with `aegisShield.sanitizeToolResult()` prior to inclusion in the generation prompt.
  - **Perimeter Gate Media Neutralization & Recursion Bounds**: In [`securityGate.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/middleware/securityGate.ts), legitimate media payloads (`audio`, `audio_base64`, `imageData`, `photo`, `recording`, `voice_note`) are safely neutralized to `[SANITIZED_MEDIA_PAYLOAD]` for threat scanning. This recognizes quoted MIME codec parameters (`codecs="opus"`) and RFC 4648 URL-safe base64 strings (`-`, `_`), while recursion depth is capped at 20 levels with `try/catch` wrappers to prevent cyclic structure DoS crashes.
  - **Cross-Platform Audio Handling**: In [`AlphaAI.tsx`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/frontend/src/components/Cyber/AlphaAI.tsx) and [`voiceAudioService.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/voiceAudioService.ts), dynamic codec negotiation probes `MediaRecorder.isTypeSupported` across WebM, MP4, OGG, and WAV with proper container file extension mappings (`.webm`, `.m4a`) to support iOS Safari and Android without client-side recording crashes or OpenAI API rejects.
  - **Protected System Directives**: System prompts are prefixed with immutable security anchors (`buildProtectedSystemPrompt`) that instruct the model never to reveal secrets or alter roles.

### 3. Distributed State Synchronization & Token Invalidation
- **Threat**: In horizontally scaled multi-replica deployments, revoking a JWT token on one node might not immediately invalidate it on another if using process-local state.
- **Controls Implemented**:
  - Distributed sliding windows and rate limits in [`sharedState.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/sharedState.ts) prioritize Redis with `pTTL` and atomic `pExpire`.
  - Authorize middleware [`authorize.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/middleware/authorize.ts#L38-L46) performs database/cache-backed session validation (`isSessionValid(token)`) on sensitive routes.
  - When Redis is unreachable, fallback warnings are recorded in logs (`logger.warn`) to alert operators to reconcile cluster cache configuration.

### 4. Webhook Integrity, Replay Mitigation & SSRF Protection
- **Threat**: Forging incoming WhatsApp webhook reports, replaying captured requests, or abusing media URLs to probe internal network infrastructure (Server-Side Request Forgery).
- **Controls Implemented**:
  - [`webhookSignature.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/middleware/webhookSignature.ts) computes HMAC-SHA256 (Meta) and HMAC-SHA1 (Twilio) using `crypto.timingSafeEqual` against the raw unparsed request buffer.
  - In [`routes/whatsapp.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/routes/whatsapp.ts), `isSafeWebhookMediaUrl` rejects cloud metadata (`169.254.169.254`), loopback (`127.0.0.1`), and RFC 1918 private IP ranges (`10.*`, `172.16-31.*`, `192.168.*`), accompanied by a 12MB download size ceiling.
  - In production (`NODE_ENV === 'production'`), requests missing cryptographic signature headers or missing provider secrets are immediately rejected with HTTP 503 / 403.

---

## 🚨 Incident Response Runbooks (Standard Operating Procedures)

### Runbook IR-01: Compromised Account or Stolen Field Device

**Trigger**: An extension worker reports a lost phone or tablet, or anomalous login activity is detected.

```mermaid
flowchart TD
    A["Alert: Lost Device / Compromised User"] --> B["1. Revoke Session in Database"]
    B --> C["2. Stamp ACCOUNT_REVOKED_WIPE_DEVICE Flag"]
    C --> D["3. RemoteWipeService Detects Signal via 403"]
    D --> E["4. Purge IndexedDB, Cache & LocalStorage"]
    E --> F["5. Reset Credentials & Invalidate API Keys"]
```

1. **Immediate Revocation**:
   Execute session revocation in the database:
   ```sql
   UPDATE user_sessions SET is_revoked = true, revoked_at = NOW() WHERE user_id = '<COMPROMISED_USER_ID>';
   ```
2. **Trigger Edge Remote Wipe**:
   - The user's next API request receives HTTP `403` with `{ wipeSignal: true, error: 'ACCOUNT_REVOKED_WIPE_DEVICE' }`.
   - The client-side [`remoteWipeService.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/frontend/src/services/remoteWipeService.ts) automatically catches this response, deletes all IndexedDB offline records, clears encrypted storage keys, and redirects to `/login`.
3. **Password & Credential Reset**:
   - Issue forced password reset and rotate any external API keys in `credential_vault`.

---

### Runbook IR-02: Volumetric DoS / High CPU Consumption

**Trigger**: CPU spikes above 85% or high latency alerts on `/api/pillars/voice/*` or `/api/ai/*`.

1. **Identify Offender IP / Tenant**:
   Check reverse proxy (Traefik / Nginx) and Node logs:
   ```bash
   grep -E "(voice|transcribe|synthesize)" /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -nr | head -20
   ```
2. **Apply Dynamic Rate Limit Block**:
   Temporarily ban abusive IP or user at the firewall / Redis layer:
   ```bash
   # Block IP at iptables or edge load balancer
   sudo iptables -I INPUT -s <OFFENDING_IP> -j DROP
   ```
3. **Verify Worker Pool Isolation**:
   Confirm that CPU-intensive operations are throttled by `checkUsageLimit` and that payloads exceeding `MAX_AUDIO_BASE64_LENGTH` are rejected with HTTP 413.

---

### Runbook IR-03: Prompt Injection or Tool Tampering Attempt

**Trigger**: AegisShield logs a critical threat alert: `Security gate blocked request: system_prompt_override` or `tool_abuse`.

1. **Analyze Threat Log**:
   Inspect backend application logs:
   ```bash
   grep -E "AegisShield|Security gate blocked" /var/log/ag-extension/app.log | tail -n 50
   ```
2. **Investigate Offending User / Session**:
   - Determine whether the attempt was made by an authenticated user or an unauthenticated query parameter.
   - If authenticated, review user audit logs via `GET /api/v1/audit-logs?userId=<USER_ID>`.
3. **Update Adversarial Pattern Dictionary**:
   If a novel injection syntax bypass was attempted, add the signature to `AegisShield.INJECTION_PATTERNS` in [`aegisShield.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/security/aegisShield.ts) and add regression test coverage to [`security.aegisShield.test.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/__tests__/security.aegisShield.test.ts).

---

### Runbook IR-04: Suspected Cross-Tenant Data Access

**Trigger**: An extension officer or farmer reports visibility of records belonging to a different cooperative or county.

1. **Audit Database Query Scoping**:
   Verify the route handler queries use tenant scoping:
   ```sql
   -- Verify farmer ownership and organization scoping
   SELECT id, organization_id, name FROM farmers WHERE id = '<TARGET_FARMER_ID>';
   ```
2. **Review Multi-Tenant Middleware**:
   Confirm that routes enforcing tenant boundaries invoke `tenantMiddleware` or `getFarmerForPrincipal`.
3. **Check Cache Key Collision**:
   Inspect Redis cache keys to ensure tenant IDs are prefixed:
   `tenant:<TENANT_ID>:farmer:<FARMER_ID>`.

---

## 🛠️ Security Verification & Audit Commands

All engineers and automated CI/CD runners must execute the full security verification suite prior to production deployments:

```bash
# 1. Run Master Cybersecurity Audit (Secret scanning, dependency CVEs, and all tests)
npm run security:audit

# 2. Run Backend Security Test Suites (AegisShield, Vault, Vetter, RBAC, Idempotency)
npm run security:test:backend

# 3. Run Frontend Security & Offline Resilience Tests
npm run security:test:frontend

# 4. Run AI Agent Microservice Security Tests
npm run security:test:agents

# 5. Run Browser Extension Manifest V3 Scope Verification
npm run security:test:extension
```
