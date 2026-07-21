# NRC IRAP Submission Plan — AG-Extension

> Repositioning note: IRAP is **not** an equity investor. It is a non-dilutive
> contribution funder delivered through Industrial Technology Advisors (ITAs). It
> backs **Canadian-controlled SMEs performing R&D in Canada** where there is
> *technological uncertainty* resolved by *systematic investigation* and *qualified
> labour*. The current `investor_pitch_deck.html` / `.pptx` (a VC equity ask) and
> the `M4D_Application_Final_Draft.md` (Sub-Saharan grant) are **not** IRAP
> artifacts and should not be sent to an ITA as-is. This document is the IRAP
> frame: **Canadian R&D, global deployment.**

---

## 0. Eligibility gate (the one blocker not in-repo)

IRAP will not advance without a Canadian base. Confirm before any ITA meeting:

- [ ] **Canadian-controlled SME** (incorporated in Canada; >50% Canadian-controlled).
      → None currently exists in this repo (prod domain `gpexts.com`, footprint
        anchored to Malawi/Kenya). This must be established **outside the codebase**.
- [ ] **R&D performed in Canada** with Canadians on eligible payroll.
- [ ] **Profit-oriented SME** (not a charity/NPO) — IRAP funds businesses.
- [ ] **ITAs assigned** — IRAP works through a named advisor; outreach is the first step.

If the entity is planned, everything below strengthens the case. If not, the
global narrative is premature — fix #1 first.

---

## 1. Positioning statement (the IRAP one-liner)

> "AG-Extension builds the **R&D for offline-first, privacy-preserving agricultural
> advisory** at our Canadian lab, then deploys it globally — from Northern and
> remote Canadian communities to smallholder co-ops in the Global South. Canadian
> R&D creates IP owned here; global deployment is the market that justifies the
> investment."

This satisfies IRAP's two tests at once: **domestic benefit** (Canadian jobs,
Canadian communities served, IP retained) **and exportable scale** (global TAM).

---

## 2. The R&D project (what IRAP actually funds)

Do **not** propose "finish the product." Propose the *uncertain* technical work:

| R&D workstream | Technological uncertainty | Why it's IRAP-eligible |
|---|---|---|
| **Edge / offline RAG inference** | Can a 768-dim RAG knowledge engine run on low-power rural devices with acceptable latency & accuracy? | Experimental; hypothesis-driven; failed approaches must be documented. |
| **Federated, privacy-preserving telemetry** | Can field-visit data be aggregated for insight without centralizing farmer PII? | Novel data-sovereignty architecture; systematic investigation. |
| **OCAP-compliant Indigenous data sovereignty** | Can advisory serve Indigenous/Northern communities under Ownership/Control/Access/ Possession without external surveillance? | Genuine Canadian social + technical innovation. |
| **Low-bandwidth multimodal UX** | Can leaf-disease CV + voice run over SMS/WhatsApp-class links reliably? | Pre-commercial; performance indices tracked. |

Map each to **SR&ED** (hypothesis → experiment → result → next). Keep eligible
salaries as the dominant cost line.

---

## 3. Dual-pilot impact (domestic + global)

- **Canadian pilot:** Northern / remote / Indigenous community advisory, OCAP-compliant.
  Real domestic benefit — the IRAP justification.
- **Global pilot:** existing Malawi/Kenya footprint (already built). Evidence the
  Canadian-developed IP exports.

This is the reconciliation of the two old assets: the VC deck's global TAM + the
M4D draft's field reality, anchored by a Canadian R&D base.

---

## 4. Budget shape (contribution, not equity)

IRAP contributions are project-scoped and labour-heavy. Illustrative eligible split:

- [ ] **~70% eligible salaries** — Canadian engineers/agronomists on the R&D above.
- [ ] **~15% subcontractors / RV** — compute, field validation partners.
- [ ] **~15% materials/travel** — device testing, pilot coordination.

Note the contrast with the VC deck's "50% Product, 30% Sales, 20% Ops" — IRAP
funds **R&D labour**, not sales. Keep the two budgets separate.

---

## 5. Support artifacts an ITA will ask for

- [ ] Company profile (Canadian incorporation, control, ownership).
- [ ] Innovation plan (Section 2 workstreams, milestones, TRL trajectory).
- [ ] SR&ED alignment / future T661 linkage.
- [ ] IP strategy (Canadian-owned; defensible via the R&D above).
- [ ] Partner letters: a Canadian co-op / First Nations community / ag-tech assoc;
      ideally an **NRC lab collaboration** (e.g., NRC-PBI Saskatoon — pending).
- [ ] Global validation: existing co-op/NGO relationships as commercial evidence.

---

## 6. What to stop doing

- ❌ Sending the equity "Ask $1.5M @ $8M" deck to IRAP.
- ❌ "Proven, hardened, 90% precision" language — IRAP funds uncertainty, not a
      shipped product.
- ❌ Africa-only impact framing (no Canadian benefit).
- ❌ The M4D draft's "Italian dialect for Malawi" error — technical reviewers
      notice boilerplate.

---

## 7. Next concrete steps

1. Confirm the Canadian entity status (Section 0) — gates everything.
2. Carve the R&D workstreams (Section 2) into a one-page innovation plan.
3. Book an IRAP ITA intro (find your regional advisor).
4. Repurpose, don't reuse: build an IRAP deck from this frame, retire the VC deck
   for this audience.

> Honest caveat: the technology is real and deployable (multi-agent engine, 21+
> MCP tools, RAG v2 + FAOSTAT, production deployment). The missing piece is the
> **Canadian R&D entity + IRAP artifact set** — both solvable. Fix the entity,
> and this becomes a strong, globally-scaled IRAP application.
