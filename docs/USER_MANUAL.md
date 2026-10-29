# About this manual

This manual is the working guide for everyone who uses the Agricultural Extension Decision Support platform: field extension officers, farmers, regional managers and administrators. It explains what each screen is for, the steps to complete the common tasks, and what the system does when data or connectivity is missing.

It is written against the application as shipped in this repository. Where a capability depends on configuration (an AI provider key, an SMS gateway, a satellite source), the manual says so instead of assuming it is switched on.

## Who this manual is for

| Reader | Start with |
|---|---|
| Field extension officer | Chapters 2 to 10 |
| Farmer | Chapters 2, 3, 7 and 9 |
| Regional manager | Chapters 3, 12 and 13 |
| Administrator | Chapters 2, 14, 15 and 16 |
| Support and onboarding staff | Chapters 2, 17 and 18 |

## Conventions used

- Menu names appear in title case exactly as they appear in the sidebar: **Farmers**, **Visits**, **Disease Diagnosis**.
- Buttons and fields are written in **bold**.
- Text you type is shown as `example input`.
- Notes beginning with "Offline" describe behaviour when the device has no connection.
- A "provenance" note explains where a number or recommendation came from. The platform labels data status rather than hiding it, so read those labels before quoting figures.

## What the platform is, in one page

The platform gives a small extension team the reach of a much larger one. It does four jobs:

1. **Records the field relationship.** Farmers, their fields, their visits and their history live in one place, tied to the officer who owns them.
2. **Answers agronomic questions with evidence.** A disease diagnosis, advisory workflow or AI answer carries a data source and a confidence statement, so you know what to trust.
3. **Reaches farmers on the channel they have.** SMS, WhatsApp and in-app messages are all fed from the same record, with per-plan quotas.
4. **Makes the work auditable.** Visit verification, regulatory rule provenance and traceability passports give funders, buyers and ministries something stronger than a paper log.

> If a module cannot produce a real answer, it says so explicitly. Never replace the label "unavailable" with an estimate when reporting to a funder or a buyer.

---

# Getting started

## System requirements

| Platform | Requirement |
|---|---|
| Desktop browser | Current Chrome, Edge, Firefox or Safari. Chrome 111 or later is recommended. |
| Android | Chrome 111 or later; the app can be installed to the home screen as a PWA. A camera is required for photo diagnosis. |
| iOS | Safari 16.4 or later; add to Home Screen for full-screen use. |
| Network | Any connection for normal use. Field workflows are designed to work offline and sync later. |
| Location | Optional but required for parcel mapping, visit verification and outbreak plotting. |

A dedicated Android and iOS build of the dashboard also exists in this repository (Capacitor wrappers under `src/frontend/android` and `src/frontend/ios`). Where the manual says "install the app", either the PWA install prompt or the packaged build applies.

## Create an account

1. Open the platform URL and select **Create account** (or go to `/register`).
2. Enter your first name, last name, email address, phone number and a password.
3. Choose your role. Self-registration offers the field roles; administrative roles are assigned by an administrator afterwards.
4. Submit the form. The account is created but not yet usable for protected actions.
5. Open the verification email and follow the link, which lands on `/verify-email`. If the message does not arrive within a few minutes, check the spam folder, then ask an administrator to resend it.

**Password rules.** Use at least eight characters with a mix of letters and numbers. A password that fails the server policy is rejected with a message describing the failing rule; nothing is saved.

## Sign in

1. Go to `/login`.
2. Enter email and password, then **Sign in**.
3. If multi-factor authentication is enabled on your account, enter the six-digit code from your authenticator app on the next screen.

**Account lockout.** Repeated failed sign-ins lock the account temporarily. Wait for the lockout window to expire, or ask an administrator to reset it. Do not keep retrying: each attempt extends the lockout.

**Forgot your password.** Select **Forgot password** on the login screen, enter your email, and follow the emailed link to `/reset-password`. Reset links are single-use and expire. A reset does not unlock a locked account by itself; sign in again after resetting.

## Roles and what they can do

The platform enforces permissions on the server, not just in the menu. A menu item that is hidden for your role is also refused by the API.

| Capability | Farmer | Extension officer | Regional manager | Administrator |
|---|---|---|---|---|
| Own dashboard | Yes | Yes | Yes | Yes |
| Register and edit farmers | No | Own portfolio | Portfolio oversight | All |
| Record visits | Own visits | Yes | Yes | Yes |
| Disease diagnosis | No | Yes | Yes | Yes |
| AI Assistant | Yes (plan limits) | Yes | Yes | Yes |
| Reports | No | Own data | Region | All |
| SMS campaigns | No | Yes (plan limits) | Yes | Yes |
| Analytics | No | Yes | Yes | Yes |
| Billing and plans | Own | Own | Own | Organisation |
| User management, telemetry, agents | No | No | No | Yes |

## Navigation tour

The sidebar groups the application into four sections. On a phone the same destinations appear in the bottom navigation bar.

| Section | Items |
|---|---|
| Field work | Dashboard, AI Assistant, Farmer Chat, Knowledge Base, Farmers, Visits, Fields, Disease Diagnosis, Advisory Studio |
| Insights | Reports, Analytics, WorldMonitor |
| Operations | SMS, Billing, Email Workflows |
| Administration | Telemetry, Agents, System Health, Memory, MCP Tools, User Management |

Additional tools are always available:

- **Global search** in the header finds farmers, visits and reports by name or identifier.
- **Notifications** lists alerts and system messages.
- **Help** opens the in-app help centre, which repeats the short task recipes in this manual.
- **Profile menu** holds your profile, security settings, language and theme.

## Language, theme and accessibility

The interface is translated into more than fifteen languages, including English, Swahili, French, Portuguese, Spanish, Arabic (right-to-left), Chinese, Hindi and Russian. Choose the language from the sidebar switcher or the profile menu; the choice persists on the device.

Light, dark and high-contrast themes are available. All interactive controls are reachable by keyboard, and the main regions expose landmarks for screen readers. If a translation is missing for a label, the English string is shown rather than a blank.

## Install for field use

1. Open the platform in the mobile browser.
2. Accept the install prompt, or use the browser menu and choose **Install app** / **Add to Home Screen**.
3. Launch from the home screen once while online so the application shell and language files are cached.
4. Open **Settings** in the installed app and confirm the offline indicator appears when you enable airplane mode.

Once installed, previously loaded screens, draft visits, field registrations and diagnosis captures remain usable without a connection. Chapter 6 explains how those drafts synchronise.

---

# Dashboard

The dashboard is the first screen after sign-in and answers one question: what needs attention today?

## Officer dashboard

| Area | What it shows | How to use it |
|---|---|---|
| Metric cards | Number of farmers, visits this period, open follow-ups, resolution rate | Select a card to jump to the filtered list behind the number |
| Performance chart | Visit volume and completion trend over the selected period | Change the period with the date selector |
| Map | Registered farmers plotted by location | Select a marker to open the farmer summary; expand the map for a larger view |
| Recent activity | Latest visits, diagnoses and advisories | Select an entry to open its record |
| Alerts | Weather, pest and follow-up reminders | Dismiss or open the linked record |

Numbers are computed from records you can open. If a card shows zero, check the period selector and your portfolio filter before assuming data is missing.

## Farmer dashboard

Farmers see a smaller dashboard: their fields, upcoming and past visits, advisories addressed to them, and their subscription status. Sections that are unavailable on the current plan show an upgrade prompt instead of a disabled control with no explanation.

## Offline behaviour

The last successfully loaded dashboard remains visible offline and is marked with the time it was fetched. Figures are not silently refreshed from stale data; the banner states the age of the data.

---

# Farmers

**Farmers** is the portfolio of the people you serve. Everything else in the platform references a farmer record, so keep this list clean.

## Find a farmer

1. Open **Farmers**.
2. Type a name, phone number, national ID or farmer code into the search box. Results filter as you type.
3. Use the location and status filters to narrow a long list.
4. Select a row to open the farmer detail panel.

The list is paginated. Sorting by last visit answers "who have I not seen in a while"; sorting by registration date answers "who is new this month".

## Register a farmer

1. Select **Add farmer**.
2. Complete the required fields: first and last name, phone number, county or district, and the primary crop.
3. Optional but valuable: national ID, gender, year of birth, household size, land size, irrigation access and group membership. These feed reporting and eligibility checks; blanks are recorded as unknown, never guessed.
4. Set the location. You can use **Use my location**, drop a pin on the map, or enter coordinates. Coordinates are stored as WGS-84.
5. Select **Save**.

Offline: the record is queued and shown with a "pending sync" badge. It receives its permanent identifier when the queue drains. Do not register the same farmer again while the first record is pending, or you will create a duplicate that an administrator must merge.

## Farmer profile

The detail panel is organised into tabs:

- **Overview** - contact details, location, assigned officer, registration date, verification state.
- **Fields** - parcels with area, crop and last NDVI observation.
- **Visits** - chronological timeline with outcomes and follow-ups.
- **Advisories** - messages sent to this farmer and their delivery status.
- **Yield** - recorded harvests and the yield trend chart.
- **Documents** - uploaded files such as soil tests or cooperative membership letters.

Use **Edit** to correct details. Every edit is attributed to your account in the audit trail; there is no anonymous editing.

## Assign farmers to officers

Administrators and regional managers can reassign a farmer or a batch of farmers from the selection toolbar. The previous officer keeps read access to historical visits but loses the farmer from their active portfolio. Reassignment history is retained so reporting can be reconstructed.

## Bulk actions

Select the checkboxes in the list to act on several farmers at once:

| Action | Effect | Caution |
|---|---|---|
| Send SMS | Opens the bulk composer with the selected recipients | Counts against your SMS quota |
| Export | Downloads the selected records as a spreadsheet | Contains personal data; handle per your data policy |
| Delete | Removes the records | Restricted to administrators or owners; asks for confirmation |

Bulk operations report how many records succeeded and how many failed, with the reason for each failure. Read that summary: a partial success is not the same as a clean run.

---

# Fields and crops

Fields hold the spatial record that makes satellite monitoring, pesticide rules and traceability possible.

## Register a field

1. Open **Fields** and select **Add field**.
2. Choose the farmer the parcel belongs to.
3. Enter the crop, variety, planting date and, if known, the expected harvest date.
4. Draw the boundary: select **Draw on map** and tap each corner of the parcel, closing the polygon on the first point. At least three vertices are required for area and satellite calculations.
5. Confirm the computed area, then **Save**.

The area is calculated from the polygon on the device, in hectares, and stored with the polygon as GeoJSON. A parcel without a polygon can still be recorded, but it cannot receive satellite indices or deforestation checks.

## Field detail

The field view combines:

- **Crop and phenology** - what is planted, at what stage.
- **Area and boundary** - polygon, vertex count and computed area.
- **Satellite indices** - vegetation and moisture indices with the observation date.
- **Hazards** - weather and pest warnings that intersect the parcel.
- **Visits** - visits recorded against this field.

> Satellite and soil modules state their own data status. A modelled estimate is labelled as modelled; a proxy measurement is labelled as a proxy. Never present an estimate as a field sensor reading in a report.

## Editing boundaries

Redraw a boundary when a farmer expands or splits a parcel. Historic visits keep the boundary that was current at the time, so changing a polygon does not rewrite past records.

---

# Visits

Visits are the unit of accountable field work. A visit has a schedule, a check-in, evidence, an outcome and a follow-up.

## Schedule a visit

1. Open **Visits** and select **Schedule visit**.
2. Pick the farmer, the field and the planned date.
3. Choose the visit type and add the purpose.
4. Save. The visit appears in the calendar and in the officer's task list.

Offline: scheduling works from the cached farmer list. Conflicts are resolved on sync; if two officers scheduled the same slot, both records are kept and flagged for review rather than one being silently dropped.

## Check in on arrival

1. Open the visit and select **Check in**.
2. Allow location access when prompted. The application records the position and the time.
3. If the position is outside the field boundary or the device has moved implausibly fast, the visit is flagged. Complete the form anyway and explain the discrepancy in the notes.

> Verification is deliberately strict. A visit completed without physical presence, or with a dwell time below the configured minimum, is rejected as stationary fraud and must be re-recorded honestly. Do not attempt to work around it.

## Complete a visit

1. Record what you observed. The synthesis form prompts for symptoms, agronomic observations, recommendations and follow-up needs.
2. Attach photographs, laboratory slips or other evidence where relevant.
3. Record the recommendation given, including product, dose and pre-harvest interval when a pesticide is involved.
4. Set the follow-up date if the case is not closed.
5. Select **Complete visit**.

The platform then:

- stores the record against the farmer and field,
- updates the officer's dashboard and analytics,
- queues any advisory to the farmer's channel if you selected one,
- records a provenance entry for the recommendation, including which regulatory dataset and rule version was applied.

## Visit statuses

| Status | Meaning |
|---|---|
| Scheduled | Planned, not started |
| In progress | Checked in, not completed |
| Completed | Recorded and verified |
| Flagged | Recorded but verification found an anomaly; needs review |
| Cancelled | Did not take place; a reason is required |

Officers can reopen their own visits in the current period. Older visits are read-only to preserve the audit trail.

---

# Disease diagnosis

The diagnosis tools turn a photograph or a symptom description into a ranked, evidence-labelled assessment.

## Photo diagnosis

1. Open **Disease Diagnosis** (sidebar) or select **AI Scan** in the mobile navigation.
2. Select the crop, then choose **Take photo** or **Upload**.
3. Frame a single affected leaf or plant part in even light. Avoid shadows and blur; one symptom per photo gives better results.
4. Start the analysis.

Two paths are possible, and the result tells you which one ran:

| Path | When it runs | What you get |
|---|---|---|
| On-device scan | No connection, or when you choose the offline scanner | Colour and lesion-based classification computed on the phone. No image leaves the device. |
| Server analysis | Connection available and the vision service is configured | Model-based diagnosis with ranked candidates and a confidence score |

Both paths return a confidence value. Treat anything below the displayed threshold as "possible, needs confirmation" and escalate rather than treating on the spot.

## Reading a diagnosis result

- **Candidates** - likely causes, each with a confidence score. The top candidate is not a certainty.
- **Evidence** - the symptoms the assessment relied on.
- **Provenance** - which engine produced the result and whether it was on-device, model-based, or unavailable.
- **Recommended action** - treatment or cultural guidance, including dose and legal constraints where a pesticide is suggested.

If the service is unavailable, the screen says so and offers the on-device scanner and a symptom questionnaire. It does not fabricate a diagnosis.

## Follow-up actions

| Action | Result |
|---|---|
| Save to farmer record | Attaches the diagnosis to the farmer and field history |
| Create advisory | Opens the advisory composer prefilled with the treatment |
| Plot on WorldMonitor | Adds the finding to the outbreak map so neighbouring officers see the signal |
| Escalate | Assigns the case for review with the evidence attached |

## Symptom-only diagnosis

When a photo is not possible, describe the symptoms in the questionnaire. The result is explicitly labelled as an internal heuristic, not a laboratory confirmation, and carries a confidence statement. Use it to decide whether to visit, not as a final determination.

---

# Advisory Studio

Advisory Studio builds repeatable field protocols: a sequence of steps an officer follows in the same order every time, so results are comparable across farms and seasons.

## Use a template

1. Open **Advisory Studio**.
2. Pick a template from the library, for example a maize and fall armyworm scouting protocol.
3. Review the step list: crop and phenology, scouting, photo capture, dosage guidance and notes.
4. Select **Run** to walk through the steps with the farmer, or **Customise** to adapt it.

## Build a protocol

1. Select **New workflow**.
2. Name the protocol and choose a category and target crop.
3. Add steps with **Add step**. Each step has a type (crop selection, soil test, pest scouting, leaf photo, dosage advisory, free text), a title and optional conditions that decide when the step appears.
4. Reorder steps with the up and down controls.
5. Select **Save draft**, then **Publish** when it is ready for the team.

Draft protocols are private to their author. Published protocols are available to every officer in the organisation and are versioned: editing a published protocol creates a new version, and completed runs keep the version they used.

## Share and export

Published protocols can be exported as a document for training and can be attached to SMS or in-app advisories so farmers receive the same instructions the officer used.

---

# AI Assistant and Farmer Chat

The assistant answers agronomic questions using the knowledge base, the farmer's record and, where configured, live data sources. It is a decision support tool, not a replacement for an agronomist.

## Ask a question

1. Open **AI Assistant**.
2. Type the question, or use the microphone to dictate it.
3. For a farmer-specific answer, attach the farmer record first so the answer can use their crops, location and history.
4. Read the answer and its sources before acting on it.

## What the answer includes

- **Answer** - the guidance, in your selected language.
- **Sources** - knowledge base articles or regulatory documents used. Select a source to open it.
- **Confidence and status** - whether the answer is grounded in retrieved documents, generated without retrieval, or unavailable.
- **Suggested follow-ups** - next questions or the matching workflow.

If no provider is reachable, the assistant states that it cannot answer and points to the knowledge base. It does not produce an unsourced guess.

## Farmer Chat

**Farmer Chat** is the conversation inbox. Each farmer has a thread combining their messages from the app, SMS and WhatsApp, so an officer can answer in context.

1. Select a farmer conversation from the list.
2. Read the thread. Inbound messages are labelled with the channel they arrived on.
3. Reply. The reply is delivered on the channel the farmer last used, unless you choose otherwise.
4. Use **Summarise** to condense a long thread into a case summary before a visit.

## Plan limits

AI features are metered separately from messaging. When a quota is exhausted the interface explains which limit was hit and when it resets. The counters are visible under **Billing**, then **Quota & Telemetry**.

---

# Knowledge Base

The knowledge base holds the agronomic library the platform answers from: crop guides, pest and disease references, regulatory documents and locally added material.

## Search

1. Open **Knowledge Base**.
2. Enter a question or keywords.
3. Filter by crop, pest, region or source.
4. Open a result. Each article shows its source, publication date and, where applicable, the version of the document it was ingested from.

Search combines keyword matching with semantic retrieval, so a natural-language question can find an article that does not contain the exact words. Results show why they matched and which document they came from.

## Ask the library

Select **Ask AI** inside the knowledge base to get a synthesised answer with citations restricted to the library. This is the preferred mode when you need a quotable answer: every claim links to a document you can open.

## Add material

Administrators can upload documents or point the platform at a source. Ingested files are chunked, embedded and indexed; the ingestion status is shown per document.

> A document that is still processing will not appear in answers. Check the ingestion status before concluding that a source is missing.

## Offline

Recently opened articles are cached on the device. Offline search covers the cached set only, and the interface states that the index is partial so you do not mistake a limited result for an empty library.

---

# Reports

Reports convert the records into something a cooperative, funder or ministry can read.

## Generate a report

1. Open **Reports** and select **Generate report**.
2. Choose the report type (activity summary, portfolio performance, visit verification, advisory outcomes, custom).
3. Set the period and, if you are a manager, the officer or region.
4. Add a title and any framing notes.
5. Select **Generate**.

Generation runs in the background. The report appears in the list with a status: queued, generating, ready or failed. A failed report states the reason; retry after fixing the cause (usually a missing period or an empty portfolio).

## Read and share

The report viewer shows the narrative, the tables behind it and the period covered. Use **Download** for the available formats (PDF, spreadsheet, document) and **Share** to send a link to an authorised user.

Every report records the period, the filters and the account that generated it. Two reports with the same title but different filters are different documents.

## Data honesty in reports

The platform refuses to fill gaps with invented values. If a metric could not be computed, the report says which input was missing. When you forward a report, keep those notes: they are the difference between an auditable document and a claim.

---

# SMS and messaging channels

Messaging reaches farmers who do not use the app. Everything sent is recorded against the farmer and counted against the plan quota.

## Send a bulk SMS

1. Open **SMS**.
2. Select recipients by portfolio filter or by picking farmers individually.
3. Write the message, or choose a template.
4. Check the character count and the estimated number of message parts. Long messages are split and billed per part.
5. Send now, or schedule for a date and time.

The delivery report shows sent, delivered, failed and pending counts per recipient. Failures include the gateway reason; a wrong number is a data-quality issue to fix in the farmer record, not something to retry blindly.

## Templates

Templates keep recurring messages consistent: planting reminders, weather warnings, follow-up prompts. Templates support placeholders such as the farmer's name, crop and next visit date. Preview a template against a real record before sending to a group.

## Scheduled and triggered messages

- **Scheduled** campaigns send at a chosen time in the farmer's local time zone.
- **Triggered** messages send when an event occurs, for example a weather warning intersecting a field, or an advisory created during a visit.

Review the trigger list before enabling a campaign; a misconfigured trigger can send the same message repeatedly.

## Quotas

Each plan defines a monthly allowance for SMS, WhatsApp, AI chat, reports, vision analyses and speech transcription. The current allowances are shown in **Billing**, then **Plans & Pricing**, and the consumed amounts in **Quota & Telemetry**. When a limit is reached, sending is blocked with an explanation rather than silently dropped.

---

# Analytics and WorldMonitor

## Analytics

**Analytics** summarises performance over a chosen period:

| Metric | Meaning |
|---|---|
| Resolution rate | Share of raised cases closed with an outcome |
| Average response time | Time from farmer message or visit request to first substantive reply |
| Satisfaction score | Farmer feedback score where collected; blank when not collected |
| Follow-up rate | Share of visits with a scheduled follow-up |
| First contact resolution | Cases closed at the first interaction |

Use the filters to compare officers, regions and periods. A metric with no underlying data is shown as unavailable, not as zero.

## WorldMonitor

WorldMonitor is the geographic view of risk: observed pest and disease signals, weather hazards, and the trajectory of active outbreaks.

1. Open **WorldMonitor**.
2. Choose the layers to display: sightings, hazard warnings, forecast corridors.
3. Select a cluster to see its sighting count, the counties observed, and the projected movement.
4. Use **Report sighting** to add a field observation; it becomes available to neighbouring officers after sync.

> Outbreak trajectories are deterministic estimates from wind speed and direction, not boundary-intersection models. The panel lists its assumptions; quote them when you forward an alert.

---

# Billing and plans

## Plans

Every account has a plan. The Free plan is deliberately limited for evaluation; paid plans raise or remove the meter limits. The authoritative allowances are always the ones displayed in **Plans & Pricing**, because they are the same values the server enforces at request time.

Free plan allowances as shipped:

| Capability | Free allowance |
|---|---|
| SMS | Not included |
| AI chat and Farmer Chat | Not included |
| Automated reports | Not included |
| Disease and soil photo diagnosis | Not included |
| Speech transcription | 100 per cycle |
| WhatsApp and Telegram broadcasting | Not included |
| Knowledge Base searches | 3 per day |

## Upgrade

1. Open **Billing**, then **Plans & Pricing**.
2. Compare allowances and select **Choose plan**.
3. Complete checkout on the payment provider's page.
4. Return to the platform. The plan updates after the provider confirms payment; if it does not appear within a minute, refresh, then check **Invoices & Receipts** before contacting support.

## Change or cancel

- **Switch plan** from the billing dashboard. The change takes effect immediately when the payment provider accepts it; the platform records the change so revenue reporting can separate expansion from contraction.
- **Cancel** ends the subscription at the end of the paid period. Access continues until then.
- When cancelling, you may choose a reason and add a comment. This is optional, but it feeds the churn report and is the only way the organisation learns why customers leave.

## Invoices and payment methods

**Invoices & Receipts** lists past charges with download links. **Payment Rails** shows the card or wallet on file and lets you update it. Payment details are handled by the provider; the platform stores only the reference needed to reconcile the charge.

---

# Administration

These screens are visible to administrators only.

## User management

Create users, assign roles, reassign officers between regions, deactivate leavers and reset credentials. Deactivation immediately blocks sign-in and revokes sessions; data created by the user remains, attributed to them.

## Telemetry

Live operational counters: request rates, agent activity, queue depth and error classes. Use it to answer "is anything failing right now" before escalating to engineering.

## Agents

The agent console shows background workers and their recent runs: ingestion, advisory scheduling, weather polling and the orchestration queue. A worker that is disabled by configuration says so explicitly instead of appearing healthy.

## System Health

Dependency status for the database, cache, AI providers and external services, with the reason for any failure. This is the first screen to check when users report that "nothing works".

## Memory and MCP Tools

**Memory** holds the long-running context the assistant uses for an account, with the option to clear it. **MCP Tools** lists the agronomic tool endpoints exposed to agents, their inputs and their last invocation status.

## Email workflows

Templates and automations for transactional and campaign email. Preview every template change against sample data before enabling it.

---

# Account and security

## Profile

Update your name, phone number and language from the profile menu. Email changes require verification of the new address.

## Multi-factor authentication

1. Open the profile menu and choose **Security**.
2. Select **Enable MFA** and scan the QR code with an authenticator app.
3. Enter the six-digit code to confirm.
4. Store the backup codes offline. They are shown once.

If you lose the authenticator and the backup codes, an administrator must reset MFA for you.

## Sessions

The security panel lists active sessions with device and last-seen time. **Revoke** ends a session immediately. Changing your password revokes other sessions.

## Your data

The platform supports data export and deletion requests from the account settings. Exports are delivered as a download; deletion removes personal records subject to legal retention obligations, and the response states what was retained and why.

---

# Offline use and synchronisation

Offline capability is a core feature, not a fallback.

## What works offline

| Works offline | Needs a connection |
|---|---|
| Viewing cached farmers, fields and visits | Registering a brand-new account |
| Registering farmers and fields (queued) | Payment and plan changes |
| Recording visits and capturing photos | Server-side AI diagnosis |
| On-device photo scan | Bulk SMS sending |
| Reading cached knowledge articles | Report generation |
| Drafting advisories | Syncing queued records |

## How the queue behaves

1. Actions taken offline are written to local storage with a unique identifier and marked pending.
2. When a connection returns, the queue drains in order, retrying failed items with increasing delays.
3. Items that cannot be applied, for example because the farmer was deleted elsewhere, are surfaced for review rather than discarded.
4. Duplicate submissions are detected by identifier, so a retry after a timeout does not create a second record.

## Good field practice

- Sync before leaving for the field, so the day's farmers and fields are cached.
- Keep the app open long enough after returning to coverage for the queue to drain; the badge shows pending items.
- Photograph evidence even when you will diagnose later: images stay with the queued visit.
- Never clear browser data or uninstall the app while items are pending.

---

# Troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| "No active subscription found" on cancel | No paid subscription on the account | Check **Billing**, **Plans & Pricing** |
| A plan is chosen but features stay locked | Payment not yet confirmed | Refresh; check **Invoices & Receipts**; wait for provider confirmation |
| Diagnosis returns "unavailable" | Vision provider not configured or unreachable | Use the on-device scanner or the symptom questionnaire; report the outage |
| AI Assistant refuses to answer | Provider unreachable or quota exhausted | Check **Billing**, **Quota & Telemetry**; use the Knowledge Base |
| Visit rejected as stationary fraud | Device did not move, or dwell time below minimum | Re-record honestly; explain the situation in the notes |
| Records stuck as pending | Queue has not drained | Keep the app open on a connection; check storage space |
| SMS shows failed for many recipients | Invalid numbers or quota exhausted | Fix numbers in farmer records; check quota |
| Maps or satellite layers blank | No location permission, or source unavailable | Grant location; read the layer's status message |
| Cannot sign in after several attempts | Account locked | Wait for the lockout window or ask an administrator |
| Report has blanks instead of numbers | Missing inputs for that metric | Read the report's data notes; fill the gap and regenerate |

## When to escalate

Escalate to an administrator, with the farmer code or visit identifier and the time of the problem, when:

- data you recorded is missing after a successful sync,
- a verification decision looks wrong and the evidence supports you,
- a payment succeeded but the plan did not change,
- the same error repeats after a refresh and a re-login.

---

# Glossary

| Term | Meaning |
|---|---|
| Advisory | Guidance issued to a farmer, in app, by SMS or by WhatsApp |
| Confidence | How strongly the evidence supports a diagnosis or answer; not a guarantee |
| Coverage | The share of a population a figure actually accounts for, for example recorded cancellation reasons |
| Dwell time | Time spent at a location, used to verify that a visit physically happened |
| EUDR | European Union Deforestation Regulation; requires proof a commodity was not grown on land deforested after 2020 |
| Field / parcel | A mapped piece of land with a crop and, usually, a boundary polygon |
| GS1 Digital Link | A standard web-resolvable identifier used on traceability passports |
| NDVI | Normalised Difference Vegetation Index; a satellite-derived measure of vegetation vigour |
| Portfolio | The set of farmers assigned to an officer |
| Provenance | The recorded origin and status of a value: measured, computed, modelled, demo or unavailable |
| PWA | Progressive Web App; the installable web build of the dashboard |
| Quota | The metered allowance of a capability on a plan |
| Traceability passport | A signed record of a batch's origin, harvest and compliance status |
| Verification | Evidence that a recorded visit or recommendation actually happened as described |
