# Headings and type: proposal (not started)

Status: **waiting for a decision** (25 Nov 2026). Nothing in the app has changed yet.

Visual sample: the design canvas "Heading style sample: dashboard" on claude.ai
(https://claude.ai/artifact/EqUqP6dZsW5FM5bFjGXUCY, private to the owner). It shows the officer
dashboard and the top of the landing page as they are now, and in options A and B below,
plus a sheet of headings rewritten as labels. Its figures are example values.

## Why

Our pages read like a written document, not a website. Measured on 25 Nov over the 164
`h1`–`h3` headings that use `t()`:

- **Headings look like body text.** One font, Atkinson Hyperlegible, for everything. 60 of
  122 `h3` are `text-xs` or `text-sm` (12–14 px), the size of body text, at weight 500.
  Only the page titles are large (`text-2xl`/`3xl`).
- **Our own rules remove the usual website cues.** CLAUDE.md allows weights 400 and 500
  only (600 rarely) and bans tracked all-caps labels.
- **A few headings are sentences**, the clearest on the landing page: "Photograph a sick
  crop. See what it might be and who can confirm it." (four lines at 60 px), "Pilots: does
  the service raise harvests?", "Approved. Add this advice to the knowledge base?". Most
  headings are short already (median 3 words; 3 end in . or ?; 5 have a colon).
- **Some are jargon:** "Category vector distribution & cluster strength", "Spatial soil &
  environmental telemetry interpolator".

Compared with https://www.54natives.com/about (looked at in a browser on 25 Nov):

- A large serif display font for the page title (about 48 px) over a plain sans body.
- Case by job:
  - Title Case for names of pages and links ("About Us", "Artisan Stories").
  - Capitals for the menu, buttons and footer group labels.
  - Sentence case for anything that is a sentence, their tagline included.
- Very little text on the first screen: a two-word title, a one-line tagline, one button.

**We keep sentence case.** Title Case would change only some of our 37 languages: 11 have no
letter case (Arabic, Hindi, Chinese, Amharic and others). All-caps text is also slower to read
for officers on cheap phones in the sun. The difference that matters is the size, the
font and the length of headings.

## Options

**A: same font, clear sizes.** This fits the current design rules.

- Page title 40 px (landing hero 72 px).
- Section heading 22–24 px (landing 48 px).
- Card heading 20 px. Nothing used as a heading below 16 px.
- Stat figures 40 px.
- A heading names the thing in a few words. Anything longer moves to a 15 px grey line under
  it.

**B: A, plus a title font.** Literata (serif) for page, section and card headings only;
everything else stays Atkinson. B needs a rule change and two decisions:

- **Hosting:** self-host the font. The CSP blocks Google Fonts, as it does for Atkinson.
- **Scripts:** Literata covers Latin, Greek and Cyrillic. Headings in Arabic, Ethiopic,
  Devanagari, Bengali, Han and other scripts fall back to Atkinson.

Suggested: **B on the public landing page, A inside the app.**

## Headings to rewrite (heading, then subtitle)

| Screen | Now | Proposed |
|---|---|---|
| Landing hero | Photograph a sick crop. See what it might be and who can confirm it. | **Photograph a sick crop.** / See what it might be, and who can confirm it. |
| Landing services | Four things you can do from a phone | **Farmer services** / Four things you can do from a phone, in plain language. Some work offline. |
| Landing hero | Are you an extension officer, cooperative, or ministry? | **For extension officers, cooperatives and ministries** |
| Analytics | Pilots: does the service raise harvests? | **Pilots** / Does the service raise harvests? |
| Reports | Approved. Add this advice to the knowledge base? | **Add to knowledge base** / Approved advice can then answer other farmers' questions |
| Dashboard | Proactive agronomic advisories | **Advisories** / Alerts sent to farmers who opted in |
| Dashboard | Field agronomy tools | **Field tools** / Calculators that work offline |
| Dashboard | Record advice outcome | **Follow-ups** / Record whether the advice worked |
| Dashboard | Support efficiency | **Support** / Questions resolved, and how farmers rated the help |
| Telemetry | Spatial soil & environmental telemetry interpolator | **Soil map** / Soil and weather values estimated between sensor points |
| Memory | Category vector distribution & cluster strength | **Knowledge by topic** / How stored answers spread across categories |
| Landing | Autonomous multi-agent extension OS for districts & cooperatives | **For districts and cooperatives** / AI agents handle routine extension work |

On landing cards, drop the small label above each title ("Crop assessment" above "Diagnose
my crop"): it repeats the title.

## Decisions needed

1. A or B, for the landing page and for the app (they can differ).
2. With B: approve self-hosting Literata and the fallback for non-Latin scripts.
3. Approve the rewritten headings above, or change them.

## Work plan once decided

1. **Type scale in one place:** heading classes in `src/hooks/useThemeClasses.ts`, the `h1`–`h3`
   base in `src/index.css`, `fontFamily.headline` in `src/theme/tokens.ts`. Card headers use
   these, not their own `text-sm`.
2. **Dashboard first** (`pages/DashboardPage.tsx`, `DashboardHeader.tsx`, `StatTile`, the
   dashboard cards), then the landing page (`pages/landing/sections/Hero.tsx`,
   `SectionHeader.tsx`, `FarmerServices.tsx`), then the other screens.
3. **Text:** shorten the headings in `public/locales/en.json` and add subtitle keys. Then run
   the "Translate locales" workflow with `keys=` for just those keys and import the result
   (`npm run audit-locales` must pass).
4. **With B:** add Literata under `public/fonts`, `@font-face` with `unicode-range` for its
   scripts, and update the design-rules check and CLAUDE.md for the headline face and the
   heading sizes.
5. **Checks:**
   - `npm run check:design-rules` and `npm run check:component-size`.
   - Unit tests that match heading text.
   - The Playwright stories that find headings by name. They use the English text, so
     renamed headings need the specs updated.

To repeat the measurement, scan `src/**/*.tsx` for `<h1|h2|h3>` containing `t('key')` and
look the keys up in `public/locales/en.json` (word count, final punctuation, `text-*` size).
