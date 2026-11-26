import type { VoiceMessages } from './voiceTranscription';

type Translate = (key: string, fallback: string) => string;

export const ENGLISH_VOICE_MESSAGES: VoiceMessages = {
  listening: 'Listening. Tap the mic again to stop.',
  recording: 'Recording. Tap the mic again to stop.',
  transcribing: 'Turning your recording into text…',
  transcribed: 'Done. Check the words before you save.',
  failed: 'Could not turn the recording into text. Try again or type it.',
  languageLimited: 'Voice typing is not reliable in your language yet. Check the words carefully before you save.',
  savedOffline: 'No signal. The recording is saved on this phone. It becomes text once you have signal and this form is open.',
  savedForRetry: 'The recording could not be turned into text just now. It is saved on this phone and will be tried again when this form is open.',
  micDenied: 'Allow the microphone to speak instead of typing.',
  notSupported: 'This browser cannot record sound. Type instead.',
  stopped: 'Voice typing stopped. Tap the mic to start again.',
};

const KEYS: Record<keyof VoiceMessages, string> = {
  listening: 'voice_listening',
  recording: 'voice_recording',
  transcribing: 'voice_transcribing',
  transcribed: 'voice_transcribed',
  failed: 'voice_failed',
  languageLimited: 'voice_language_limited',
  savedOffline: 'voice_saved_offline',
  savedForRetry: 'voice_saved_for_retry',
  micDenied: 'voice_mic_denied',
  notSupported: 'voice_not_supported',
  stopped: 'voice_stopped',
};

/** The recorder's messages in the user's language, from the app's `t`. */
export function voiceMessages(t: Translate): VoiceMessages {
  const say = (name: keyof VoiceMessages) => t(KEYS[name], ENGLISH_VOICE_MESSAGES[name]);
  return {
    listening: say('listening'),
    recording: say('recording'),
    transcribing: say('transcribing'),
    transcribed: say('transcribed'),
    failed: say('failed'),
    languageLimited: say('languageLimited'),
    savedOffline: say('savedOffline'),
    savedForRetry: say('savedForRetry'),
    micDenied: say('micDenied'),
    notSupported: say('notSupported'),
    stopped: say('stopped'),
  };
}
