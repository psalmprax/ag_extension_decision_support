# Agronomic review of AI advice

AI answers in a farmer's conversation are shown to the farmer straight away.
Some of them are also queued for a human check, so an officer or manager can
confirm, correct or escalate them.

## What gets queued

`reviewTriggerFor()` in `src/backend/src/services/knowledge/reviewQueue.ts`
decides. The most serious reason wins:

| Trigger | Meaning |
|---|---|
| `safety_boundary` | The agronomic safety guard flagged or rewrote the answer |
| `invalid_references` | The answer cited sources it was not given |
| `no_sources` | Retrieval found nothing, so the answer is the model's own guidance |
| `farmer_request` | The farmer asked for a human to check advice (`POST /api/ai/reviews`) |

Answers grounded in retrieved sources with valid citations are not queued, so
the queue stays small enough to work through. Only conversations linked to a
farmer are queued. Queueing never delays or blocks the farmer's answer. The
chat API reports `review: { queued, trigger }` with each answer.

## Who decides

- Officers, regional managers and admins list and decide reviews in the
  **Recommendations needing review** panel on the Reports page.
- Every decision (approve, escalate, dismiss) needs a written reason, which is
  stored as the review's `disposition`.
- **Four eyes:** whoever submitted an item, including the officer whose chat
  produced the advice, cannot decide it. The API refuses, and the refusal is
  enforced in the update statement itself.
- Farmers can request a review of advice about their own record, but cannot
  list or decide reviews.

## What this does not do yet

The queue records human judgement; it does not replace it. A golden set of
agronomic questions with expert-approved answers, which would let every model
or prompt change be scored automatically, has to be written by agronomists for
the crops and regions served. The approved and corrected items in this queue
are the natural source for it.
