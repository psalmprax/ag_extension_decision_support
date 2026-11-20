# Working from a phone: SMS, WhatsApp and the voice line

What farmers and officers can do without the app, and what each channel cannot carry.

| | SMS | WhatsApp or Telegram | Voice line |
|---|---|---|---|
| Text messages with the officer | yes | yes | — |
| Photos and video | no (SMS carries text only) | yes, kept in the thread | no |
| Voice | no | voice notes, transcribed and kept | record a question after the beep |
| Works on a basic phone | yes | no | yes |

## Farmers

- **Sign up**: text START (or any message) to the SMS number, or dial the USSD code.
- **Ask the officer**: any message goes to the farmer's thread; the officer replies from the app, SMS or WhatsApp,
  and the reply comes back on the channel the farmer last used.
- **Ask the AI**: ASK AI and the question.
- **Photos, videos, voice notes** (WhatsApp or Telegram): kept in the thread so the officer can open or play them. Voice notes are
  also transcribed.
- **Voice line**: call the number, speak the question after the beep, press #. The recording and its transcript reach
  the officer; the answer comes by SMS. Unregistered callers are told how to register.
- **Notices**: a confirmation when an officer registers them, and a message when a visit is planned or cancelled.
  STOP turns notices off (replies to their own messages still arrive); START turns them on again.
- **Language**: LANG SW, LANG EN, LANG FR or LANG PT.

## Officers and managers (SMS or WhatsApp, from the phone on their account)

Send PIN and the 4 digits once a day, then:

| Command | Does |
|---|---|
| INBOX | the three newest unanswered farmer messages, numbered |
| R 12 reply | reply to farmer 12 |
| FIND name | look up a farmer |
| VISIT 12 notes | record a visit today; on WhatsApp, photos, a video or a dictated voice note sent with it join the visit report |
| PLAN 12 Tue notes | plan a visit; the farmer is told |
| REG 0712345678 Jane Wanjiku, maize, Kaptembwo | register a farmer to you; they get a confirmation |
| ASK AI question | an AI answer |
| LOCK | turn commands off until the next PIN |

A voice note on WhatsApp that starts "Visit 12, ..." (or "Ziara 12") is transcribed and recorded as visit notes. Notes
dictated in another language keep the spoken words and get an English summary, marked as AI output to check against
the recording (it counts against the officer's AI allowance).

## Not done yet

- Calling a farmer back with a recorded answer: answers to the voice line go by SMS.
- An offline video library on the officer's phone.
- WhatsApp files from the Meta Cloud API (media ids): files are fetched from Twilio's media links only.
