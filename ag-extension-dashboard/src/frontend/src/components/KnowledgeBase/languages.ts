export interface MultilingualLanguage {
  code: string;
  label: string;
  flag: string;
  native: string;
  bcp47: string;
  group: 'African' | 'Global';
}

export const MULTILINGUAL_LANGUAGES: MultilingualLanguage[] = [
  // Primary Global & African Languages
  { code: 'en', label: 'English', flag: '🇺🇸', native: 'English', bcp47: 'en-US', group: 'Global' },
  { code: 'sw', label: 'Swahili', flag: '🇰🇪', native: 'Kiswahili', bcp47: 'sw-KE', group: 'African' },
  { code: 'fr', label: 'French', flag: '🇫🇷', native: 'Français', bcp47: 'fr-FR', group: 'Global' },
  { code: 'es', label: 'Spanish', flag: '🇪🇸', native: 'Español', bcp47: 'es-ES', group: 'Global' },
  { code: 'pt', label: 'Portuguese', flag: '🇧🇷', native: 'Português', bcp47: 'pt-BR', group: 'Global' },
  { code: 'ha', label: 'Hausa', flag: '🇳🇬', native: 'Hausa', bcp47: 'ha-NG', group: 'African' },
  { code: 'yo', label: 'Yoruba', flag: '🇳🇬', native: 'Yorùbá', bcp47: 'yo-NG', group: 'African' },
  { code: 'ig', label: 'Igbo', flag: '🇳🇬', native: 'Igbo', bcp47: 'ig-NG', group: 'African' },
  { code: 'am', label: 'Amharic', flag: '🇪🇹', native: 'አማርኛ', bcp47: 'am-ET', group: 'African' },
  { code: 'om', label: 'Oromo', flag: '🇪🇹', native: 'Afaan Oromoo', bcp47: 'om-ET', group: 'African' },
  { code: 'ti', label: 'Tigrinya', flag: '🇪🇷', native: 'ትግርኛ', bcp47: 'ti-ET', group: 'African' },
  { code: 'so', label: 'Somali', flag: '🇸🇴', native: 'Af-Soomaali', bcp47: 'so-SO', group: 'African' },
  { code: 'lg', label: 'Luganda', flag: '🇺🇬', native: 'Oluganda', bcp47: 'lg-UG', group: 'African' },
  { code: 'rw', label: 'Kinyarwanda', flag: '🇷🇼', native: 'Ikinyarwanda', bcp47: 'rw-RW', group: 'African' },
  { code: 'rn', label: 'Kirundi', flag: '🇧🇮', native: 'Ikirundi', bcp47: 'rn-BI', group: 'African' },
  { code: 'zu', label: 'Zulu', flag: '🇿🇦', native: 'isiZulu', bcp47: 'zu-ZA', group: 'African' },
  { code: 'xh', label: 'Xhosa', flag: '🇿🇦', native: 'isiXhosa', bcp47: 'xh-ZA', group: 'African' },
  { code: 'af', label: 'Afrikaans', flag: '🇿🇦', native: 'Afrikaans', bcp47: 'af-ZA', group: 'African' },
  { code: 'sn', label: 'Shona', flag: '🇿🇼', native: 'chiShona', bcp47: 'sn-ZW', group: 'African' },
  { code: 'ny', label: 'Chichewa', flag: '🇲🇼', native: 'Chichewa', bcp47: 'ny-MW', group: 'African' },
  { code: 'wo', label: 'Wolof', flag: '🇸🇳', native: 'Wolof', bcp47: 'wo-SN', group: 'African' },
  { code: 'bm', label: 'Bambara', flag: '🇲🇱', native: 'Bamanankan', bcp47: 'bm-ML', group: 'African' },
  { code: 'ff', label: 'Fula', flag: '🇬🇳', native: 'Fulfulde', bcp47: 'ff-SN', group: 'African' },
  { code: 'ln', label: 'Lingala', flag: '🇨🇩', native: 'Lingála', bcp47: 'ln-CD', group: 'African' },
  { code: 'mg', label: 'Malagasy', flag: '🇲🇬', native: 'Malagasy', bcp47: 'mg-MG', group: 'African' },

  // Major Global & Asian Agricultural Languages
  { code: 'ar', label: 'Arabic', flag: '🇸🇦', native: 'العربية', bcp47: 'ar-SA', group: 'Global' },
  { code: 'hi', label: 'Hindi', flag: '🇮🇳', native: 'हिन्दी', bcp47: 'hi-IN', group: 'Global' },
  { code: 'zh', label: 'Chinese (Simplified)', flag: '🇨🇳', native: '中文 (简体)', bcp47: 'zh-CN', group: 'Global' },
  { code: 'de', label: 'German', flag: '🇩🇪', native: 'Deutsch', bcp47: 'de-DE', group: 'Global' },
  { code: 'ru', label: 'Russian', flag: '🇷🇺', native: 'Русский', bcp47: 'ru-RU', group: 'Global' },
  { code: 'ja', label: 'Japanese', flag: '🇯🇵', native: '日本語', bcp47: 'ja-JP', group: 'Global' },
  { code: 'ko', label: 'Korean', flag: '🇰🇷', native: '한국어', bcp47: 'ko-KR', group: 'Global' },
  { code: 'it', label: 'Italian', flag: '🇮🇹', native: 'Italiano', bcp47: 'it-IT', group: 'Global' },
  { code: 'nl', label: 'Dutch', flag: '🇳🇱', native: 'Nederlands', bcp47: 'nl-NL', group: 'Global' },
  { code: 'tr', label: 'Turkish', flag: '🇹🇷', native: 'Türkçe', bcp47: 'tr-TR', group: 'Global' },
  { code: 'pl', label: 'Polish', flag: '🇵🇱', native: 'Polski', bcp47: 'pl-PL', group: 'Global' },
  { code: 'uk', label: 'Ukrainian', flag: '🇺🇦', native: 'Українська', bcp47: 'uk-UA', group: 'Global' },
  { code: 'id', label: 'Indonesian', flag: '🇮🇩', native: 'Bahasa Indonesia', bcp47: 'id-ID', group: 'Global' },
  { code: 'vi', label: 'Vietnamese', flag: '🇻🇳', native: 'Tiếng Việt', bcp47: 'vi-VN', group: 'Global' },
  { code: 'th', label: 'Thai', flag: '🇹🇭', native: 'ไทย', bcp47: 'th-TH', group: 'Global' },
  { code: 'fil', label: 'Filipino', flag: '🇵🇭', native: 'Wikang Filipino', bcp47: 'fil-PH', group: 'Global' },
  { code: 'fa', label: 'Persian', flag: '🇮🇷', native: 'فارسی', bcp47: 'fa-IR', group: 'Global' },
  { code: 'ur', label: 'Urdu', flag: '🇵🇰', native: 'اردو', bcp47: 'ur-PK', group: 'Global' },
  { code: 'bn', label: 'Bengali', flag: '🇧🇩', native: 'বাংলা', bcp47: 'bn-BD', group: 'Global' },
  { code: 'pa', label: 'Punjabi', flag: '🇮🇳', native: 'ਪੰਜਾਬੀ', bcp47: 'pa-IN', group: 'Global' },
  { code: 'ta', label: 'Tamil', flag: '🇮🇳', native: 'தமிழ்', bcp47: 'ta-IN', group: 'Global' },
  { code: 'te', label: 'Telugu', flag: '🇮🇳', native: 'తెలుగు', bcp47: 'te-IN', group: 'Global' },
  { code: 'mr', label: 'Marathi', flag: '🇮🇳', native: 'मराठी', bcp47: 'mr-IN', group: 'Global' },
];
