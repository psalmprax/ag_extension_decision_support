# About this manual

This manual is the working guide for everyone who uses GPExts, the Agricultural Extension Decision Support platform: field extension officers, farmers, regional managers and administrators. It explains what each screen is for, the steps to complete the common tasks, and what the system does when data, connectivity or access is missing.

It is written against the application as shipped in this repository (version 1.2, November 2026). Where a capability depends on configuration (an AI provider key, an SMS gateway, a satellite source) or on your account's access, the manual says so instead of assuming it is switched on.

## Who this manual is for

| Reader | Start with |
|---|---|
| Field extension officer | Chapters 2 to 11 |
| Farmer | Chapters 2, 3, 6, 7, 9 and 10 |
| Regional manager | Chapters 2, 3, 4, 11 and 13 |
| Administrator | Chapters 2, 14, 15 and 16 |
| Support and onboarding staff | Chapters 2, 14, 17 and 18 |

## Conventions used

- Menu names appear in sentence case exactly as they appear in the sidebar: **Farmers**, **Visits**, **Disease diagnosis**.
- Buttons and fields are written in **bold**.
- Text you type is shown as `example input`.
- Notes beginning with "Offline" describe behaviour when the device has no connection.
- A "provenance" note explains where a number or recommendation came from. The platform labels data status rather than hiding it, so read those labels before quoting figures.
- Figures with numbered pins: the number in the image matches the numbered list directly below it. Figures 1 and 2 are captured from the running application. Figure 3 is a schematic of a signed-in screen, because those screens require a seeded account; it is labelled as a map wherever it is used.

## What the platform is, in one page

The platform gives a small extension team the reach of a much larger one. It does four jobs:

1. **Records the field relationship.** Farmers, their fields, their visits and their history live in one place, tied to the officer who owns them.
2. **Answers agronomic questions with evidence.** A disease diagnosis, advisory workflow or AI answer carries its sources and a confidence statement, so you know what to trust.
3. **Reaches farmers on the channel they have.** SMS, WhatsApp, Telegram and in-app messages are all fed from the same record.
4. **Makes the work auditable.** Visit location checks, regulatory rule provenance and traceability passports give funders, buyers and ministries something stronger than a paper log.

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
| Location | Optional but required for field mapping, visit location checks and the farm map. |

A dedicated Android and iOS build of the dashboard also exists in this repository (Capacitor wrappers under `src/frontend/android` and `src/frontend/ios`). Where the manual says "install the app", either the PWA install prompt or the packaged build applies.

## The public website

The landing page at the platform address explains the service before anyone signs in.

- **Language.** The globe button in the top bar switches the whole page, including the voice advisor, into any of the 37 supported languages. Type in its search box to find a language quickly.
- **Menu.** On wide screens the top bar shows the main sections; the menu button holds the rest. On phones every section is in the menu.
- **Voice advisor.** The **Ask copilot** button opens a public assistant you can type or speak to. It answers in the page language when it speaks it (English, Swahili, French, Spanish or Portuguese) and is limited to 10 questions an hour per visitor. Its answers are AI-assisted guidance; check that they apply locally.
- **Sign in** and **Get started** lead to the sign-in and registration screens.

## Create an account

![Figure 1. The registration screen, with the numbered controls used in the steps below.](docs/manual/figures/register.png)

1. **First name** - enter the officer or farmer's given name (and the last name beside it).
2. **Email** - the address that receives verification and password-reset mail.
3. **Password** - at least eight characters, typed again in **Confirm password**; the eye icon reveals what you typed.
4. **Country** and **Region** - where you work. Your regional manager is assigned from the region.
5. **Role** - the role requested at registration; administrators can adjust it later.
6. **Create account** - submits the form. Nothing is usable until the email is verified.

To register:

1. Open the platform URL and select **Get started** (or go to `/register`).
2. Enter your first name, last name, email address and a password; add your phone number and organisation if you have them.
3. Choose your country, region and role. Self-registration offers the field roles; administrative roles are assigned by an administrator afterwards.
4. Submit the form. The account is created but not yet usable for protected actions.
5. Open the verification email and follow the link, which lands on `/verify-email`. If the message does not arrive within a few minutes, check the spam folder, then ask an administrator to resend it.

**Password rules.** Use at least eight characters with a mix of letters and numbers. A password that fails the server policy is rejected with a message describing the failing rule; nothing is saved.

New accounts start on the Free plan. Chapter 14 explains what that includes and how to get access to more.

## Sign in

![Figure 2. The sign-in screen: 1 email, 2 password, 3 sign in, 4 password recovery, 5 registration, 6 demo, 7 phone sign-in.](docs/manual/figures/login.png)

1. **Email address** - the verified address on the account.
2. **Password** - masked by default; the eye icon reveals it on a private device.
3. **Sign in** - authenticates and loads the dashboard for your role.
4. **Forgot password?** - starts the reset flow described below.
5. **Create account** - opens registration for a new user.
6. **Try the demo** - opens the shared demo account described below.
7. **Sign in with your phone number** - for accounts that sign in with a phone number instead of an email address.

The globe button at the top switches the language before you sign in.

To sign in:

1. Go to `/login`.
2. Enter email and password, then **Sign in**.
3. If two-factor authentication is enabled on your account, enter the six-digit code from your authenticator app on the next screen.

**Account lockout.** Repeated failed sign-ins lock the account temporarily. Wait for the lockout window to expire, or ask an administrator to reset it. Do not keep retrying: each attempt extends the lockout.

**Forgot your password.** Select **Forgot password?** on the sign-in screen, enter your email, and follow the emailed link to `/reset-password`. Reset links are single-use and expire. A reset does not unlock a locked account by itself; sign in again after resetting.

## Try the demo

**Try the demo** on the sign-in screen opens a shared extension-officer account filled with sample farmers, so you can explore without registering.

- Everything in the demo is sample data. Names, farms and figures are invented, and nothing you do is sent to real farmers.
- The demo can read but not change records, and it does not include paid services: Farmer chat, Visits, Crops & fields, Disease diagnosis, Reports and AI answers in Knowledge show what they offer and how to ask for access.
- When you open the demo, the platform records the time, your approximate country, region and city, your type of device and your IP address with its last part removed. These records are deleted after 90 days. The privacy policy on the landing page (section 6, "Demo visits") explains this in full.

## Roles and what they can do

The platform enforces permissions on the server, not just in the menu. A menu item that is hidden for your role is also refused by the API. Some items are also paid services: they need a paid plan or access granted by an administrator (Chapter 14). Those are marked "paid" below.

| Menu item | Farmer | Extension officer | Regional manager | Administrator |
|---|---|---|---|---|
| Dashboard | Own | Yes | Yes | Yes |
| AI agronomist (paid) | Yes | Yes | No | Yes |
| Farmer chat (paid) | As **My officer** | Yes | No | Yes |
| Knowledge (AI answers paid) | Yes | Yes | Yes | Yes |
| Farmers | No | Own portfolio | Region | All |
| Visits (paid) | Own | Yes | Yes | Yes |
| Crops & fields (paid) | Own | Yes | Yes | Yes |
| Disease diagnosis (paid) | Own crops | Yes | No | Yes |
| Advisory Studio | No | Yes | No | Yes |
| Reports (paid) | No | Own data | Region | All |
| Analytics (paid) | No | Yes | Yes | Yes |
| Farm map (paid) | No | Yes | Yes | Yes |
| SMS (paid) | No | Yes | Yes | Yes |
| Billing & subscription | Paid plans only | Paid plans only | No | Yes |
| Email automation, System, Staff & officers | No | No | No | Yes |

A paid item you cannot use stays in the menu with a lock symbol. Opening it explains what it does and how to get access, rather than showing a disabled screen with no explanation.

## Navigation tour

The sidebar groups the application into four sections. On a phone the main destinations appear in the bottom navigation bar and the rest in the menu drawer. For farmers the bottom bar holds **Home**, **My officer**, **AI scan** (Disease diagnosis) and **Knowledge**.

| Section | Items |
|---|---|
| Field work | Dashboard, AI agronomist, Farmer chat (farmers see **My officer**), Knowledge, Farmers, Visits, Crops & fields, Disease diagnosis, Advisory Studio |
| Insights | Reports, Analytics, Farm map |
| Operations | Outreach (SMS and Email automation), Billing & subscription |
| Administration | System (System health, Field conditions, Assistant tasks, Assistant memory, Connected tools), Staff & officers |

**Outreach** and **System** are each one menu entry that opens a page with tabs for the items inside it.

Every page opens with the same header: a field photograph, the page title (the same words as the menu item), one sentence on what the page is for, and the page's main buttons on the right. Tabs and filters for the page sit on a strip directly under the header.

Additional tools are always available:

- **Search** in the top bar finds farmers, visits and reports by name or identifier, or a place by name.
- **Location and weather** in the top bar shows the place the app is using and the current temperature there.
- **Notifications** lists alerts and system messages.
- **Settings** (gear icon) holds appearance, language, offline maps, messaging channels and local data.
- **Documentation & support** at the bottom of the sidebar opens the help centre, with answers to common questions and a way to report a problem.
- **Profile menu** (your name) holds your profile and security settings.
- Administrators also see three shortcuts in the top bar: **Scan a leaf**, **Field conditions** and **SMS preview**.

## Language, appearance and accessibility

The interface is available in 37 languages: English, Swahili, French, Portuguese, Spanish, Zulu, Italian, German, Dutch, Danish, Polish, Hungarian, Turkish, Arabic, Chinese, Hindi, Russian, Ukrainian, Romanian, Czech, Slovak, Bulgarian, Greek, Uyghur, Hausa, Yoruba, Igbo, Amharic, Afaan Oromoo, Chichewa, Luganda, Kinyarwanda, Somali, Bengali, Indonesian, Vietnamese and Urdu. Arabic and Urdu read right to left.

Choose the language with the globe button in the top bar (or under **Settings**); the choice is kept on the device. If a translation is missing for a label, the English text is shown rather than a blank. Translations of new text are reviewed over time; where wording matters, such as a dose, check the English original.

**Settings** also switches between light and dark mode and offers eight colour themes. All interactive controls are reachable by keyboard, and the main regions expose landmarks for screen readers.

## Install for field use

1. Open the platform in the mobile browser.
2. Accept the install prompt, or use the browser menu and choose **Install app** / **Add to Home Screen**.
3. Launch from the home screen once while online so the application shell and language files are cached.
4. Turn on airplane mode and confirm the dashboard shows **Offline** in its header.

Once installed, previously loaded screens, draft visits, field registrations and diagnosis captures remain usable without a connection. Chapter 17 explains how those drafts synchronise.

---

# Dashboard

The dashboard is the first screen after sign-in and answers one question: what needs attention today?

![Figure 3. Dashboard layout map (schematic): 1 sidebar, 2 top bar, 3 page header with connection status, 4 quick actions and zone filter, 5 metric cards, 6 farm locations map, 7 rain and temperature, 8 further cards.](docs/manual/figures/dashboard-layout-map.png)

1. **Sidebar** - the four navigation sections. The current item is highlighted; locked paid items carry a lock symbol.
2. **Top bar** - search, location and weather, language, light or dark mode, notifications, settings and your profile.
3. **Page header** - the title, a greeting, and the connection status: **Online** or **Offline**, and whether all changes are saved or how many wait to sync. **Sync now** appears when changes are waiting.
4. **Quick actions and zone** - **Diagnose a crop photo**, **Register farmer**, **Plan visits** and **Farmer messages**, depending on your role. **Zone** narrows the whole dashboard to one village or area.
5. **Metric cards** - total farmers, active conversations, visits this month and average farmer satisfaction, each with the change against last month.
6. **Farm locations** - registered farms on a map, coloured by crop. Switch between street, satellite and terrain views, or **Expand** the map.
7. **Rain and temperature** - the last two weeks in your area, measured by NASA POWER. It needs a location on your profile.
8. **Further cards** - support (questions resolved and how farmers rated the help), advisories sent to farmers, outreach delivery, recent activity, follow-ups on whether advice worked, crops grown, field tools that work offline, and soil and climate readings.

## Officer dashboard

| Area | What it shows | How to use it |
|---|---|---|
| Metric cards | Farmers, active conversations, visits this month, satisfaction | Compare against last month; open the menu item behind a number for details |
| Farm locations | Registered farmers plotted by location and crop | Select a marker to see the farmer, field size and estimated yield |
| Rain and temperature | Measured weather for your area | Add your location to your profile if the card asks for it |
| Alerts to review | Crop stress seen from space and possible outbreaks near your farmers, with the measurements | Check the farm, then write your own message and choose **Send to my farmers**, or **Dismiss** |
| Advisories | Planting, weather and pest alerts sent to farmers | Check what farmers have already received before sending more |
| Follow-ups | Whether advice worked | Record the outcome after a follow-up visit |

Numbers are computed from records you can open. If a card shows zero or a dash, check the zone filter before assuming data is missing; a dash means nothing has been recorded yet, not zero.

At 06:00 your time the app also leaves a short note ("Your day") with visits in the next 24 hours, overdue visits, follow-ups due and new alerts about your farmers.

### Alerts farmers receive

Some alerts reach farmers without an officer, because they only state a forecast: severe weather for their farm today or tomorrow, and moderate or heavier rain in the days before a harvest is due. Farmers get them on the channel they last used, in their language, at most twice a day, only between 06:00 and 20:00 their time, and never after they send STOP. Texting farmers costs money per message, so an administrator switches it on.

Crop stress and possible outbreaks never go to farmers as they stand. They wait in **Alerts to review** until an officer has checked and written to the farmers in their own words.

## Farmer dashboard

Farmers see a smaller dashboard titled **Dashboard**: a greeting, their crops, their next visit and recent messages, and advisories addressed to them. Paid sections that are not included in the account say so and explain how to get access.

## Offline behaviour

The last successfully loaded dashboard remains visible offline, and the header shows **Offline**. Figures are not silently refreshed from stale data, and changes made offline are counted as waiting to sync until the connection returns.

---

# Farmers

**Farmers** is the portfolio of the people you serve. Everything else in the platform references a farmer record, so keep this list clean.

## Find a farmer

1. Open **Farmers**.
2. Type a name, region or crop into **Search by name, region or crop**. Results filter as you type.
3. Select a farmer's card to open the farmer detail panel.

The header shows how many farmers are listed and their total land holding. Each card shows the farmer's location, land holding, crops, channel and status.

## Register a farmer

1. Select **Register farmer** (on the Farmers page or among the dashboard's quick actions).
2. Complete the required fields: name, phone number, location and the primary crop.
3. Optional but valuable: national ID, gender, year of birth, household size, land size, irrigation access and group membership. These feed reporting and eligibility checks; blanks are recorded as unknown, never guessed.
4. Set the location. You can use your current location, drop a pin on the map, or enter coordinates. Coordinates are stored as WGS-84.
5. Save.

Officers can register farmers only in their own region. The demo account cannot register farmers.

Offline: the record is queued and shown as pending. It receives its permanent identifier when the queue drains. Do not register the same farmer again while the first record is pending, or you will create a duplicate that an administrator must merge.

## Farmer detail

The detail panel has four tabs:

- **Dashboard** - contact details, location, assigned officer and the next scheduled visit.
- **Communication history** - messages exchanged with the farmer on every channel.
- **Progress** - what has been done for the farmer over time.
- **Analytics** - the farmer's trends, such as yields and visit outcomes.

Every edit is attributed to your account in the audit trail; there is no anonymous editing.

## Assign farmers to officers

Administrators and regional managers can reassign a farmer. The previous officer keeps read access to historical visits but loses the farmer from their active portfolio. Reassignment history is retained so reporting can be reconstructed.

## Bulk actions

**Select all**, or select farmers one by one, to act on several at once:

| Action | Effect | Caution |
|---|---|---|
| Broadcast alert | Sends one message to every selected farmer | Uses your messaging allowance |
| Export CSV | Downloads the selected records as a spreadsheet | Contains personal data; handle per your data policy |
| Delete | Removes the records | Restricted to administrators or owners; asks for confirmation |

Bulk operations report how many records succeeded and how many failed, with the reason for each failure. Read that summary: a partial success is not the same as a clean run.

---

# Crops and fields

**Crops & fields** holds the spatial record that makes satellite monitoring, pesticide rules and traceability possible. It is a paid service (Chapter 14).

## Register a field

1. Open **Crops & fields**, choose the farmer, and select **Add field**.
2. Enter the crop, variety, planting date and, if known, the expected harvest date.
3. Draw the boundary in one of two ways:
   - **Tap the corners** of the parcel on the map, closing the shape on the first point.
   - **Walk the edge** with GPS. Fixes that are too imprecise are skipped, so the outline is not distorted by a poor signal.
4. Confirm the measured area, then save.

At least three corners are needed for area and satellite calculations. The area is calculated from the boundary, in hectares, and stored with it as GeoJSON. A field without a boundary can still be recorded, but it cannot receive satellite indices or deforestation checks.

## Field detail

The page summarises the total cultivated area, active crop timelines and harvested yield, and for each field shows:

- **Crop cycle** - what is planted and at what stage.
- **Boundary and area** - the outline, number of corners and measured area.
- **Soil tests** - results over the years, including organic carbon.
- **Satellite indices and weather** - vegetation and moisture indices with the observation date, and measured weather.
- **Satellite** (from Digital Earth Africa, free) - last month's rain against the same month in earlier years, crop greenness against its 1984–2020 normal, how often the spot has been seen under water since 1984, whether it was mapped as cropland in 2019, and what ESA WorldCereal mapped there in 2021. Each fact names its source.

> Satellite and soil modules state their own data status. A modelled estimate is labelled as modelled; a proxy measurement is labelled as a proxy. Never present an estimate as a field sensor reading in a report.

Offline: the fields already kept on the device stay visible, and the page says it is showing the device's copy.

## Editing boundaries

Redraw a boundary when a farmer expands or splits a parcel. Historic visits keep the boundary that was current at the time, so changing an outline does not rewrite past records.

---

# Visits

Visits are the unit of accountable field work. A visit has a schedule, a report, a location check and a follow-up. **Visits** is a paid service (Chapter 14).

## Schedule a visit

1. Open **Visits** and select **Schedule a visit** (or **Plan visits** on the dashboard).
2. Choose the farmer and the date and time.
3. Choose the visit type: new farmer, routine, follow-up, emergency, training or query.
4. Add notes if useful, then **Schedule visit**.

The list filters visits into **All**, **Upcoming**, **Completed** and **Cancelled**.

Offline: scheduling works from the cached farmer list and is queued. Conflicts are resolved on sync; if two officers scheduled the same slot, both records are kept and flagged for review rather than one being silently dropped.

## Record what happened

1. Open the visit.
2. Record what you observed: symptoms, agronomic observations, recommendations and follow-up needs. **Talk the visit** lets you dictate the report: **Start recording**, speak, then **Stop and fill the report**, and check the filled fields before saving.
3. Attach photographs, laboratory slips or other evidence where relevant.
4. Record the recommendation given, including product, dose and pre-harvest interval when a pesticide is involved.
5. Set the follow-up date if the case is not closed, and save.

**Generate summary** can write a short summary of the farm assessment from your notes. Read it before saving; it is a draft, not a record of its own.

## Location check

When a report is filed with the device's location, the visit shows how far from the farm it was filed:

| Label | Meaning |
|---|---|
| Verified on the farm | Filed at the farm, within the allowed distance |
| Filed some distance from the farm | Filed away from the farm; the distance is shown |
| Location too imprecise to confirm | The device's fix was not accurate enough |
| Location not shared with this report | No location was sent |

> Verification is deliberately strict. A visit recorded without physical presence, or with signs that the device did not move, is flagged for review. Explain any genuine discrepancy in the notes; do not attempt to work around the check.

## Visit statuses

| Status | Meaning |
|---|---|
| Scheduled | Planned, not started |
| In progress | Started, not completed |
| Completed | Recorded |
| No show | The farmer was not there |
| Cancelled | Did not take place |

Older visits are read-only to preserve the audit trail.

---

# Disease diagnosis

The diagnosis tools turn a photograph, a video or a symptom description into an evidence-labelled assessment. **Disease diagnosis** is a paid service for farmers, extension officers and administrators. Farmers use it for their own crops; whoever runs the check, treatment advice waits for an extension officer's confirmation.

The page has these tabs: **Leaf photo**, **Video**, **Describe symptoms**, **Soil** and **Disease library**. Administrators and regional managers also see **Testing**, which checks the diagnosis models against known photos.

## Leaf photo

1. Open **Disease diagnosis** (or **Diagnose a crop photo** on the dashboard). The **Leaf photo** tab opens.
2. Optionally enter the crop, for example `maize`.
3. Under **Your photo**, select **Take or choose a photo of the leaf** (JPG or PNG, up to 10 MB). Frame a single affected leaf in even light; avoid shadows and blur.
4. Select **Check this photo**.

The **Result** panel stays empty, with a short instruction, until a photo has been checked. It never shows an example picture that could be mistaken for a result.

The check runs in two steps, and the result says which one answered:

| Step | When it answers | What you get |
|---|---|---|
| **Checked on this phone** | The model on the device is sure enough, or there is no connection | The most likely cause and what else is possible. No image leaves the device. |
| Online check | The device is not sure, has no model, or you choose **Check with the online model** | Model-based assessment with ranked candidates, sources and a review status |

Offline: the photo is queued for the online check, and the device's answer, if any, is shown meanwhile.

**Camera scan leaf**, under the photo, opens the live camera scanner instead. It points the camera at the leaf and runs the check on the device, so it works without a connection; when online it can ask the server to verify.

Model confidence and symptom-match scores are not proof of a diagnosis, at any value. Treatment advice is held back until an extension officer confirms the diagnosis; farmers can send the result to their officer in **My officer**.

## Reading a result

- **Most likely** and **Also possible** - likely causes, each with how sure the model is. The top candidate is not a certainty.
- **Evidence** - the symptoms the assessment relied on.
- **Provenance** - which engine produced the result and whether it ran on the device, online, or was unavailable.
- **Translation** - when your app language is not English, the result is machine-translated and says so; **Show original** shows the English.
- **Treatment guidance** - specific treatment and prevention instructions are withheld until a qualified local expert confirms the diagnosis and applicable authorization.

If the service is unavailable, the screen says so and offers the on-device scanner and the symptom questionnaire. It does not fabricate a diagnosis.

## Video

Select **Video**, choose an MP4, WebM or MOV file up to 30 MB, and start the analysis. Sign-in, connectivity, a configured vision provider and server-side FFmpeg are required. The server extracts a limited number of frames and returns only supported visual observation labels. The video frames are sent to the configured provider; do not upload sensitive footage without appropriate consent.

The result is unverified and is not a diagnosis. If the video cannot be decoded, the provider is unavailable, or its response cannot be safely interpreted, the screen reports the failure and keeps the selected video for retry. Deployment-specific proxy or request-body limits can be lower than 30 MB.

## Describe symptoms

When a photo is not possible, describe the symptoms in **Describe symptoms**. The result is explicitly labelled as an internal heuristic, not a laboratory confirmation, and carries a confidence statement. Use it to decide whether to visit, not as a final determination.

## Soil and disease library

**Soil** shows soil data for a chosen farmer, including SoilGrids (250 m) values adjusted by the farmer's own soil tests where they exist. A farmer sees only their own soil, which loads without choosing. **Disease library** describes common diseases, their symptoms and how they spread.

---

# Advisory Studio

Advisory Studio builds repeatable field protocols: a sequence of steps an officer follows in the same order every time, so results are comparable across farms and seasons.

## Use a template

1. Open **Advisory Studio**.
2. Pick a template, for example **Template: Maize fall armyworm** or **Template: Soil pH & lime**.
3. Review the step list: crop and growth stage, scouting, photo capture, dosage guidance and notes.
4. Adapt it, or use it as it is.

## Build a protocol

1. Name the protocol in the title field at the top of the editor.
2. Add steps from **Agronomic blocks**: select a block to insert it into the protocol. Each step has a type (crop selection, soil test, pest scouting, leaf photo, dosage advisory, free text), a title and optional conditions that decide when the step appears. Conditions are checked on the device, so a protocol works offline.
3. Reorder steps with the up and down controls.
4. Watch the phone preview: it shows what an officer will see.
5. Select **Save draft**, then **Publish** when it is ready for the team.

Draft protocols are private to their author. Published protocols are available to every officer in the organisation and are versioned: publishing again creates a new version, and completed runs keep the version they used.

## Export

**Export** saves the protocol as a JSON file, for backup or to move it to another installation.

---

# AI agronomist and Farmer chat

The assistant answers agronomic questions from the knowledge base and, where configured, live data sources. It is a decision support tool, not a replacement for an agronomist. Both are paid services (Chapter 14), and neither is available to regional managers.

## Ask the AI agronomist

1. Open **AI agronomist**.
2. Type the question, for example `lower maize leaves turning yellow after rain`, or use the microphone to ask by voice.
3. Add a leaf photo if you have one.
4. Read the answer and its sources before acting on it.

## What the answer includes

- **Answer** - the guidance, in your app language.
- **Sources** - the extension guides behind the answer, listed beside the conversation.
- **Safety checks** - answers are checked for unsafe doses and mixtures. A diagnosis from a photo needs confirmation by your officer.
- **Save as PDF** and **Send by SMS** - keep the answer or send it to a farmer.

If no provider is reachable, the assistant states that it cannot answer and points to the knowledge base. It does not produce an unsourced guess.

## Farmer chat

**Farmer chat** is the conversation inbox. Each farmer has a thread combining their messages by SMS, WhatsApp and Telegram, so an officer can answer in context. Farmers use the same conversation from their side as **My officer**.

1. Choose a conversation from **Conversations**, or filter by **SMS**, **WhatsApp** or **Telegram**. The **+** button starts a new conversation.
2. Read the thread. Inbound messages are labelled with the channel they arrived on.
3. Reply. **AI-suggested follow-ups** offers questions to ask, and **Copilot: draft a reply** writes a draft; check both before sending. The microphone dictates a reply, and **Also send as a voice message (WhatsApp)** adds a spoken copy.
4. On wide screens, the **Plot telemetry** panel on the right shows the farmer's vegetation, soil and weather readings and any forecast risk periods, each with its source.

**Live updates on** in the header means new messages appear as they arrive; when it is off, they appear when you reopen the conversation. **Delete** removes a conversation after you confirm.

## Allowances

AI features are metered separately from messaging. When an allowance is used up, the interface explains which limit was hit and when it resets. The counters are under **Billing & subscription**, **Usage**.

---

# Knowledge

**Knowledge** holds the agronomic library the platform answers from: crop guides, pest and disease references, regulatory documents and material your organisation adds. The page has tabs for **Search & discovery**, **Knowledge graph**, **Illustrations**, **Document library** and **Index status**.

## Search

1. Open **Knowledge**.
2. Type a question or keywords and search.
3. Open a result. Each article shows its source, publication date and, where applicable, the version of the document it was ingested from.

Search combines keyword matching with semantic retrieval, so a natural-language question can find an article that does not contain the exact words. Results show why they matched and which document they came from. **Knowledge graph** shows how the guides behind an answer connect.

## Ask the library

Asking a question in Knowledge gives an AI answer with references to the guides it used. Retrieval and citation scores describe relevance, not independent factual verification or local regulatory approval.

- If AI synthesis is unavailable but sources exist, the panel shows the most relevant source excerpts instead of claiming a fresh answer.
- Answers without supporting sources are labelled general advice only.
- If a very similar question was answered before, the earlier answer is shown and says so.
- If neither an answer nor sources are available, the panel shows an error. Failed requests keep attachments for retry, and unavailable answers do not count against the daily allowance.

AI answers are a paid service. Without it, the page says **Asking the AI is not included in this account**; the guides, knowledge graph and illustrations stay available, and **Ask us for access** explains how to get it.

An answer or factsheet can be kept with **Save factsheet as PDF**, sent with **Send as SMS**, or stored with **Download for offline use**.

## Add material

Administrators can upload guides with **Upload a guide**. Ingested files are split, indexed and listed under **Your organisation's guides**; **Index status** shows the state of each document. The platform adds no guides of its own.

> A document that is still processing will not appear in answers. Check the index status before concluding that a source is missing.

## Offline

Guides downloaded for offline use and recently opened articles are kept on the device. Offline search covers that set only, and the interface states that the index is partial so you do not mistake a limited result for an empty library.

---

# Reports

**Reports** turns the records into written summaries a cooperative, funder or ministry can read. It is a paid service (Chapter 14).

## Write a report

1. Open **Reports** and select **Write a report**.
2. Choose what to cover and the period; managers can choose an officer or region.
3. Confirm. While the report is being written the button shows **Writing report**.

Reports appear under **Written reports**, newest first, and can be found by title. A failed report states the reason; retry after fixing the cause, usually an empty period or portfolio.

## Read and share

Open a report to read the narrative and the tables behind it. **Download PDF** saves a copy. Every report records the period, the filters and the account that wrote it; two reports with the same title but different filters are different documents.

## Data honesty in reports

The platform refuses to fill gaps with invented values. If a metric could not be computed, the report says which input was missing. When you forward a report, keep those notes: they are the difference between an auditable document and a claim.

---

# Outreach: SMS and messaging channels

**Outreach** reaches farmers who do not use the app. It has two tabs: **SMS**, and for administrators **Email automation**. Delivery and record-keeping depend on the configured provider and channel; a provider accepting a message does not guarantee delivery. SMS is a paid service (Chapter 14).

## Send SMS

1. Open **Outreach**, **SMS**.
2. Choose one farmer, or several for a bulk message.
3. Write the message, or start from a template such as a greeting, a visit reminder or an alert.
4. Check the character count. Long messages are split and billed per part.
5. Send.

The delivery report shows sent, delivered, failed and pending messages. Failures include the gateway reason; a wrong number is a data-quality issue to fix in the farmer record, not something to retry blindly.

## Ask for a knowledge hint

On SMS, Twilio WhatsApp or Telegram, send `ASK` followed by a question, for example `ASK maize leaves turning yellow`. Include the crop, location, growth stage and symptoms when relevant. Telegram also accepts `/ask`. Send `ASK` alone for instructions. Do not include personal or sensitive information; messages may be retained by the service and its providers.

The reply is a short, separately reviewed public hint linked to a matching Knowledge article, not a diagnosis or a treatment prescription. Confirm it with a local extension officer. A message does not automatically request a visit or queue an officer review. If there is no eligible matching source, the reply says so. USSD cannot retrieve knowledge hints; use SMS instead.

Administrators must explicitly configure public hints before any are available. The knowledge base does not currently have a public/private visibility field, so the channel does **not** expose article text, private documents, or tenant-specific knowledge. `MESSAGING_KB_PUBLIC_HINTS` is a JSON array with at most 100 entries, each containing `articleId`, `sha256`, `source`, and `hint`. Example structure:

```json
[{"articleId":"9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb01","sha256":"REPLACE_WITH_REVISION_HASH","source":"Public field guide","hint":"Inspect maize leaves regularly."}]
```

For each article, independently verify public redistribution rights and review the hint for safety and general applicability. `source` is a public source label (at most 60 characters) and `hint` is the approved standalone public note (at most 160 characters); neither may contain private information. Notes containing treatment rates or common pesticide/fertilizer terms are withheld, but this automated screen is not a substitute for review. The SHA-256 must be the lowercase hex digest of the UTF-8 bytes of JavaScript `JSON.stringify([article.title, article.content])`. Calculate it from the exact database values, for example with `crypto.createHash('sha256').update(JSON.stringify([title, content])).digest('hex')`. A changed article or one tagged `unverified_scrape` is withheld until reviewed and reapproved. An empty list disables hints; malformed configuration or a database failure produces an unavailable response. Remove an entry to revoke it. Configure and distribute the same list to all backend instances.

Telegram requires `TELEGRAM_WEBHOOK_SECRET` and a webhook registered with the same Telegram `secret_token`; requests without the matching secret are rejected. SMS inbound requires a supported provider signature. WhatsApp replies currently require the Twilio WhatsApp provider; Meta Cloud outbound delivery is not implemented. Ensure provider credentials, webhook registration and delivery monitoring are in place before relying on any channel.

## Allowances

Each plan defines a monthly allowance for SMS, WhatsApp, AI chat, reports, photo analyses and speech transcription. The consumed amounts are under **Billing & subscription**, **Usage**. When a limit is reached, sending is blocked with an explanation rather than silently dropped.

---

# Analytics and Farm map

## Analytics

**Analytics** shows how quickly farmers get answers, what they ask about, crop prices and daily activity, for the last 30 days by default. Use the filters to compare officers, regions and periods. A metric with no underlying data is shown as "No data available", not as zero. It is a paid service (Chapter 14).

## Farm map

**Farm map** is the geographic view of your farmers and the signals around them. It is a paid service for extension officers, regional managers and administrators.

1. Open **Farm map**.
2. Under **Layers**, choose what to show: **Farms**, **Crop stress (30 days)** from recent diagnoses, **Pest reports (14 days)** and **Soil sample point**.
3. Select **Apply**.
4. Drag the globe to turn it, and select a point to see its details.

Totals beside the map count farms mapped, crop stress reports, pest clusters and soil pH at sample points. A layer whose source is not connected says **not connected**; a farm appears only once the farmer's location is saved.

> Signals on the map come from records and recent reports, not from a forecast. Quote their period (30 or 14 days) when you forward them.

---

# Billing and access

## While payments are switched off

Payments are currently switched off while pricing is decided. Until they are switched on:

- No plan can be bought or changed in the app, and upgrade buttons are hidden.
- A paid service your account does not include says **Not included in your account yet**, with **Ask us for access**. That button writes an email to `info@gpfed.com`; an administrator then opens the service for your account (see below).
- **Billing & subscription** is in the menu only for administrators and accounts already on a paid plan.

## Free plan

Every account has a plan. New accounts are on the Free plan, which is deliberately limited:

| Capability | Free allowance |
|---|---|
| SMS | Not included |
| AI agronomist and Farmer chat | Not included |
| Written reports | Not included |
| Disease and soil photo diagnosis | Not included |
| Speech transcription | 100 per cycle |
| WhatsApp and Telegram broadcasting | Not included |
| Knowledge searches | 3 per day |
| Knowledge AI answers, Crops & fields, Visits, Analytics, Farm map | Not included |

The server enforces the same limits, so a screen that looks available still refuses a request beyond them.

## Access granted by an administrator

A system administrator can open individual paid services to a Free account without changing its plan:

1. Open **Staff & officers** and find the account.
2. Select **Edit access**.
3. Under **Service access**, select **Grant** beside each service. Optionally set **New grants end on** to make the access temporary.
4. **Revoke** removes a service again.

The services listed there are: Farmer chat & AI assistant, Field visits & tracking, Operational analytics, Autonomous outreach campaigns, WorldMonitor spatial intelligence (the Farm map), Knowledge AI answers, Crops & fields and Reports, each for the roles it applies to. Administrators always have full access.

> Disease diagnosis and the SMS page are not tied to a grantable service, so they open only on a paid plan; granting outreach campaigns does not unlock the SMS page.

## Billing & subscription

For accounts that see it, the page has these tabs while payments are off:

- **Usage** - what you have used this cycle against each allowance. A service your plan does not include shows "Not included".
- **Voucher code** - redeem a prepaid code from a cooperative, NGO or grant programme with **Redeem**, then **Activate token**.
- **Invoices & receipts** - past charges with download links.
- **Payment keys** - administrators only: payment provider keys, pending mobile-money payments and voucher generation.

The customer portal and **Cancel** remain available to paying accounts. Cancelling ends the subscription at the end of the paid period, and access continues until then. You may choose a reason and add a comment; this is optional, but it is how the organisation learns why customers leave.

When payments are switched on again, **Plans & pricing** and **Payment methods** return, and plans can be chosen and paid for in the app.

---

# Administration

These screens are visible to administrators only.

## Staff & officers

Create users with **Create user**, assign roles, reassign officers between regions, deactivate leavers and reset credentials. **Edit access** on an account changes its role, plan and service access; **History** shows what changed and who changed it. Deactivation immediately blocks sign-in and revokes sessions; data created by the user remains, attributed to them.

The demo account's visits are listed for administrators under the demo records, with the time, the approximate place and the shortened IP address of each visit.

## System

**System** is one menu entry with five tabs:

- **System health** - status of the database, cache, AI providers and external services, with the reason for any failure. **Run full check** tests them all. This is the first screen to check when users report that "nothing works".
- **Field conditions** - weather and soil readings by area, over a chosen period.
- **Assistant tasks** - background workers and their recent runs: ingestion, advisory scheduling, weather polling and the task queue. A worker that is switched off by configuration says so explicitly instead of appearing healthy.
- **Assistant memory** - the long-running context the assistant keeps, searchable by key, value or category, with the option to add or clear entries.
- **Connected tools** - the agronomic tools exposed to the assistant, their inputs and the result of their last use.

## Email automation

Templates and automations for transactional and campaign email, under **Outreach**. Preview every template change against sample data before enabling it.

---

# Account and security

## Profile

Update your name, phone number and language from the profile menu. Email changes require verification of the new address.

## Two-factor authentication

1. Open the profile menu and choose the security settings.
2. Select **Set up Two-Factor authentication** and scan the QR code with an authenticator app (TOTP).
3. Enter the six-digit code and confirm.
4. Store the backup codes offline. They are shown once.

If you lose the authenticator and the backup codes, an administrator must reset two-factor authentication for you.

## Sessions

The security settings list active sessions with device and last-seen time. Ending a session signs that device out immediately. Changing your password signs out other sessions.

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
| Recording visits and capturing photos | The online photo check and AI answers |
| Photo check on the device and the camera scanner | Sending SMS |
| Reading guides downloaded for offline use | Writing reports |
| Field tools (calculators) | Syncing queued records |

## How the queue behaves

1. Actions taken offline are written to local storage with a unique identifier and marked pending.
2. When a connection returns, the queue drains in order, retrying failed items with increasing delays.
3. Items that cannot be applied, for example because the farmer was deleted elsewhere, are surfaced for review rather than discarded.
4. Duplicate submissions are detected by identifier, so a retry after a timeout does not create a second record.

The dashboard header shows how many changes wait to sync, with **Sync now** to try at once.

## Good field practice

- Sync before leaving for the field, so the day's farmers and fields are cached.
- Keep the app open long enough after returning to coverage for the queue to drain.
- Photograph evidence even when you will diagnose later: images stay with the queued visit.
- Never clear browser data or uninstall the app while items are pending.

---

# Troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| A menu item has a lock symbol | The service is not included in your account | Open it and select **Ask us for access** (Chapter 14) |
| "Not included in your account yet" | Free plan, and the service has not been granted | Ask for access; an administrator can grant it |
| Billing & subscription is missing from the menu | Payments are switched off and the account is on the Free plan | Nothing to buy for now; ask for access to the service you need |
| "Asking the AI is not included in this account" in Knowledge | Knowledge AI answers are a paid service | Read the guides; ask for access to AI answers |
| Diagnosis returns "unavailable" | Vision provider not configured or unreachable | Use the camera scanner or **Describe symptoms**; report the outage |
| AI agronomist refuses to answer | Provider unreachable or allowance used up | Check **Billing & subscription**, **Usage**; use Knowledge |
| A visit shows "Filed some distance from the farm" | Report filed away from the farm | Explain the reason in the notes; file reports on the farm where possible |
| Records stuck as pending | Queue has not drained | Keep the app open on a connection; select **Sync now**; check storage space |
| SMS shows failed for many recipients | Invalid numbers or allowance used up | Fix numbers in farmer records; check usage |
| Maps or satellite layers blank | No location permission, or source not connected | Grant location; read the layer's status |
| Rain and temperature asks for a location | No location on your profile | Add your location to your profile |
| Cannot sign in after several attempts | Account locked | Wait for the lockout window or ask an administrator |
| Report has blanks instead of numbers | Missing inputs for that metric | Read the report's data notes; fill the gap and write it again |
| "Something went wrong" | Part of the page stopped working | Select **Try again**, then **Reload page**; if it repeats, use **Copy error details** and send them to support |

## The error screen

When part of a page fails, it is replaced by **Something went wrong** in your language, with the error message and the part of the app that failed. **Try again** reloads that part, **Reload page** reloads the whole page and **Go to the home page** returns to the dashboard. **Copy error details** copies what support needs to investigate; nothing you entered on the page is included.

## When to escalate

Escalate to an administrator, with the farmer code or visit identifier and the time of the problem, when:

- data you recorded is missing after a successful sync,
- a location check looks wrong and the evidence supports you,
- a payment succeeded but the plan did not change,
- the same error repeats after a refresh and signing in again.

---

# Glossary

| Term | Meaning |
|---|---|
| Advisory | Guidance issued to a farmer, in the app, by SMS or by WhatsApp |
| Confidence | How strongly the evidence supports a diagnosis or answer; not a guarantee |
| Coverage | The share of a population a figure actually accounts for, for example recorded cancellation reasons |
| Demo account | A shared, read-only sample account for exploring the platform |
| EUDR | European Union Deforestation Regulation; requires proof a commodity was not grown on land deforested after 2020 |
| Field / parcel | A mapped piece of land with a crop and, usually, a boundary |
| GS1 Digital Link | A standard web-resolvable identifier used on traceability passports |
| NDVI | Normalised Difference Vegetation Index; a satellite-derived measure of vegetation vigour |
| Paid service | A feature that needs a paid plan or access granted by an administrator |
| Portfolio | The set of farmers assigned to an officer |
| Provenance | The recorded origin and status of a value: measured, computed, modelled, demo or unavailable |
| PWA | Progressive Web App; the installable web build of the dashboard |
| Service access | A paid service an administrator opened to one account without changing its plan |
| Allowance | The metered amount of a capability included in a plan |
| Traceability passport | A signed record of a batch's origin, harvest and compliance status |
| Voucher code | A prepaid code that activates a plan without payment |
