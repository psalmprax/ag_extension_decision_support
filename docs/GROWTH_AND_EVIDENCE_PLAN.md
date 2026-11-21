# Growth and evidence plan

The established digital extension services lead on six things code cannot fix alone: reach, proof that the
service works, vetted content, voice in local languages, tested photo diagnosis, and government adoption. This
plan covers the work outside the code for each, and points to what the platform now provides for it.

Where the competitors stand (November 2026, from their own reports):

| | Reach | Evidence | How |
|---|---|---|---|
| Digital Green FarmerChat | 1.6M+ farmers (June 2026) | randomised trial in Kenya running to end of 2026 | AI answers from a library of ~8,000 farmer videos in 50+ languages, built with ministries |
| Precision Development (PxD) | 60M+ farmers reached by services it supports | Odisha trial: 10% less severe crop loss, 9% more harvest after excess rain | voice calls in local languages, handed over to governments (Odisha now 7M+ farmers) |
| Plantix | 10M+ downloads | ~800 crop–problem pairs, trained on images labelled by crop scientists | photo diagnosis app |
| iShamba | hundreds of thousands of subscribers in Kenya | — | SMS and a call centre of agronomists, paid by M-Pesa subscription |

Sources: digitalgreen.org/about, socialscienceregistry.org/trials/17035, precisiondev.org (impact reports and
Nigeria DPAE press release), Financial Express on Plantix (Jan 2026), CGIAR report on iShamba.

## 1. Reach: grow through organisations that already have farmers

Direct-to-farmer marketing is slow and expensive. The organisations that already serve farmers bring them in
whole: cooperatives, out-grower schemes (tea, coffee, dairy, sugar), input companies with agro-dealer networks,
NGOs running extension projects, and county or state agriculture departments.

Steps:

1. Pick one country and two or three partner types for the first year. Write a one-page offer per type: what
   their officers get (caseload, visits, reports, SMS commands), what their farmers get (SMS, WhatsApp, voice
   line, notices), what it costs, and what they must provide (officers, farmer lists, a person to approve guides).
2. Get the phone channels live in that country before selling: an SMS short code and sender ID, a USSD code, a
   verified WhatsApp Business number, a voice number. Each needs an application to the telcos or Meta and takes
   weeks. Get quotes per SMS, per USSD session and per voice minute; the price per farmer per season depends on them.
3. Onboard each partner the same way: one training day for officers (sign-in, SMS PIN, REG, VISIT, PLAN),
   bulk-import the farmer list (CSV with a country column), send registration confirmations, and agree who
   approves local guides.
4. Measure reach as active farmers (sent or received a message in the last 30 days) per partner, not sign-ups.

In the platform: bulk import, REG by SMS, registration confirmations, organisation accounts, USSD and SMS menus
in four languages, WhatsApp and Telegram, the voice line, 53 country profiles.

## 2. Proof: one pilot with an independent evaluator

A trial with a comparison group is what funders and governments ask for. The platform now runs the mechanics; the
design and the conclusions belong to an evaluator.

Steps:

1. Find the partner and region (one region, one main crop, one season, a few hundred farmers or more).
2. Bring in an independent evaluator early: a university agricultural economics department, or an organisation
   such as IPA or a J-PAL affiliate. They set the sample size from the expected yield variance, the outcome
   measures and the analysis.
3. Pre-register the study (for example in the AEA RCT Registry, where Digital Green registered its Kenya trial).
4. Get ethics approval and write the consent wording farmers receive. The comparison group gets the extension
   it already had; it is not denied service.
5. Run the season: start the pilot in Analytics > Pilots (random split), ask for last season's harvest, let
   officers work, ask for this season's harvest after the season, export the farmer-level file for the evaluator.
6. Publish what the evaluator finds, including a null result.

In the platform: pilots with random assignment, harvest collection by SMS (kg or bags), "did you follow the
advice?" follow-ups after officers' replies, reply times per group, the difference between groups with a 95%
range and a "too early" flag, and a CSV export without names or phone numbers.

What the app's numbers are not: self-reported harvests are noisy, and the app's 95% range is a first look, not the
evaluator's analysis. Crop cuts or buyer records are stronger; the evaluator decides.

## 3. Content: license vetted guides, do not write agronomy ourselves

Steps:

1. Use the content-gap report (Knowledge > Document library > Questions no guide answered) to list the 20 topics
   farmers ask about most where no guide exists, per crop and country.
2. Approach, in this order: the country's national agricultural research institute and extension department,
   CABI (PlantwisePlus factsheets and plant-clinic material), FAO publications, Access Agriculture (farmer
   training videos), and partners' own approved material.
3. Read each licence. Many open publications allow non-commercial use only; a paid service may need written
   permission. Record the licence and the attribution in the knowledge sources registry.
4. Upload the guides, tagged with their country. Officers' uploads wait for a manager's approval; a named
   agronomist at each partner approves.
5. Re-run the gap report monthly.

In the platform: guides carry their country, approval before a guide is used in answers, answers cite their
sources and are queued for review when they have none, and the content-gap report.

## 4. Voice in local languages

Steps:

1. For the pilot area, pick two or three languages from the farmer list.
2. Scripts: the three voice-line prompts (their wording is shown in Settings > Recordings) and 8 to 12
   seasonal advisories written from licensed guides and approved by an agronomist.
3. Voice: a local radio presenter or a well-spoken extension officer, recorded on a phone in a quiet room,
   exported as mp3. A native speaker checks each recording against the script.
4. Upload in Settings > Recordings, with what each says in English for staff.
5. Test with ten farmers by phone before calling the whole service group. Ask whether the voice is trusted and
   the words understood.
6. Budget the calls: price per minute times farmers times calls per season. The server caps calls per day.

In the platform: recordings per message and language, played on the voice line instead of English; voice
advisories that ring a pilot's service group and play a recording; farmers who sent STOP are never called.

## 5. Photo diagnosis: build a labelled set before trusting it

Steps:

1. Choose the 10 crop–problem pairs that matter most in the pilot area (from officers and the gap report).
2. Collect at least 20 photos per pair with a confirmed answer: plant clinics (CABI Plantwise plant doctors),
   the national plant protection service or research labs, and officers' own field confirmations.
3. Upload them in Disease diagnosis > Testing and run the test. Repeat monthly and after any change of AI model.
4. Show the mistakes to an agronomist; add photos where the diagnosis is weak.

In the platform: the labelled test set, officers labelling farmers' photos once confirmed in the field, test
runs with accuracy per crop and problem, and the rule that farmers see a diagnosis as "tested" only for pairs
that passed (20 photos, 85% right by default); every other diagnosis tells the farmer to have their officer confirm.

## 6. Government adoption

Governments adopt services that their own staff can run and that keep data in the country.

Steps:

1. After the pilot, offer the ministry or county a build–operate–transfer agreement: we operate for one to two
   seasons with their officers, then hand over operations, content approval and the farmer registry.
2. Prepare for handover: in-country hosting (the Compose setup runs on any server; see SCALING_AND_RESILIENCE.md),
   data export (MIS export, pilot CSV), and training for their technical team.
3. Check the country's data protection law (for example Kenya's Data Protection Act 2019, Nigeria's Data
   Protection Act 2023): registration as a data processor, consent wording, where data is stored.
4. Align with the national digital agriculture strategy and farmer registry so farmers are not registered twice.

In the platform: organisation accounts, regional access rules, MIS export, off-site backups and a restore drill,
and documented self-hosting.

## Twelve months, in order

| Months | Work | Gate before moving on |
|---|---|---|
| 1–2 | Country choice, phone channels applied for, first partner signed, evaluator engaged | channels live; partner and evaluator agreed |
| 2–3 | Gap report, licences, guides approved; voice scripts recorded; labelled photos for 10 pairs | 20 guides live; recordings checked; test run done |
| 3–4 | Officer training, farmer import, pilot registered and started, baseline harvests | 70% of farmers reached by SMS |
| 4–9 | Season runs; monthly diagnosis test; follow-ups | reply time and follow-up answers tracked |
| 9–11 | Endline harvests, export, evaluator's analysis | analysis delivered |
| 11–12 | Results published; government handover proposal | proposal with the ministry |

Costs to get quotes for before signing anything: telco SMS, USSD and voice rates; short code and number fees;
WhatsApp conversation fees; AI usage per question and per diagnosis test photo; hosting; the evaluator; voice
talent; licence fees.
