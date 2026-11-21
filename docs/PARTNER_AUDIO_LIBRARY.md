# Partner audio library

Recordings by a partner organisation's agronomists (an NGO, a research institute),
imported as a library, checked, and sent to the farmers they fit.

## How a recording is tied to people

| Link | Where it comes from |
|---|---|
| Who made it | The partner, the speaker, the licence (and expiry) and the speaker's consent, from the manifest. Every message that uses it credits partner and speaker. |
| Who it is for | Language, crops, regions and topic, from the manifest, matched to the farmer's own preferred language, crops and region. Nobody tags farmers by hand. |
| Who may use it | Organisations the system administrator grants the partner's library to. Inside an organisation the usual farmer access rule applies. |
| Who heard it | Every send is logged in `recording_deliveries`: recording, farmer, sender, channel, time. |

## Steps

1. **Add the partner** (system administrator): Knowledge › Library › Partner recordings › Content partners and imports.
2. **Grant organisations** that may use the library (tick them under the partner).
3. **Import a zip** (up to `IMPORT_ARCHIVE_MAX_MB`, 300 MB by default) with the audio files and a `manifest.csv`:

   | column | required | example |
   |---|---|---|
   | file | yes | `armyworm_sw.mp3` |
   | title | no (file name) | `Scouting for fall armyworm` |
   | speaker | yes | `Dr. Wanjiru Kamau` |
   | language | yes, a code | `sw`, `en`, `ny`, `pt-MZ` |
   | crops | no, `;` between | `maize;sorghum` |
   | regions | no, `;` between (empty = everywhere) | `Rift Valley;Nyanza` |
   | topic | no | `pests` |
   | licence | yes | `CC BY 4.0` |
   | licence_expires | no, a date | `2028-12-31` |
   | consent | yes, must be `yes` | `yes` |

   Rows without a speaker, a language code, a licence or confirmed consent are not
   imported; the import report lists each skipped file and why.
4. **Transcription** runs in the background (local Whisper, then the speech APIs), every
   10 minutes for anything still pending. If no speech service is available the
   recordings stay pending; a reviewer can also type the transcript.
5. **Review** (administrator or regional manager): listen, correct the transcript, approve
   or reject. Only approved recordings ground the assistant's answers (as a knowledge
   article credited to partner and speaker) or can be sent.
6. **Send** (officer, manager): from the library, or from a farmer's page under
   "Recordings for …", which lists approved recordings in that farmer's language for
   their crops and region. The farmer gets it in their thread with the audio attached,
   and by SMS or WhatsApp with a play link that works without signing in.

Expired licences drop out of matching and sending automatically.

## What the partner provides (not code)

- A data-sharing agreement: ownership, whether paid plans may use it, attribution.
- Speakers' consent.
- A first sample of about 50 files, to measure transcription quality per language.
