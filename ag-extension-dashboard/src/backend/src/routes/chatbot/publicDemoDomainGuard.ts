export const DOMAIN_GUARD_MESSAGE =
  'I am specialized in agricultural extension and crop health. How can I assist with your farm or crops?';

const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /(?:ignore|disregard|forget)\s+(?:all\s+|any\s+)?(?:previous|prior|above)\s+instructions/i,
  /(?:what\s+is|reveal|show|print|display|tell\s+me|repeat)\s+(?:your|the)\s+(?:system\s+|initial\s+)?(?:prompt|instructions)/i,
  /you\s+are\s+now\s+(?:a|an|in)\s+(?:unrestricted|developer\s+mode|dan|jailbreak)/i,
  /system\s*:\s*override/i,
  /bypass\s+(?:all\s+|any\s+)?(?:safety|content|domain)\s+(?:filters|guardrails)/i,
];

const OFF_TOPIC_CODING_PATTERNS: RegExp[] = [
  /(?:write|create|generate|give\s+me)\s+(?:a\s+|an\s+|some\s+)?(?:python|javascript|java|c\+\+|bash|powershell|sql|html|css|rust|go|react)\s+(?:script|code|program|function|app)/i,
  /(?:hack|exploit|bypass|crack|payload|sql\s+injection|reverse\s+shell)/i,
];

const OFF_TOPIC_MATH_PATTERNS: RegExp[] = [
  /(?:solve|calculate|evaluate)\s+(?:the\s+)?(?:integral|derivative|calculus|equation\s+x|matrix|fibonacci)/i,
  /^\s*(?:what\s+is\s+|calculate\s+)?\s*\d+\s*[\+\-\*\/\^\%]\s*\d+\s*\??\s*$/i,
];

const OFF_TOPIC_GENERAL_PATTERNS: RegExp[] = [
  /(?:bitcoin|ethereum|cryptocurrency|crypto\s+wallet|forex\s+trading|stock\s+market|wall\s+street)/i,
  /(?:who\s+won|score\s+of)\s+(?:the\s+)?(?:super\s*bowl|nba|world\s*cup|champions\s*league)/i,
  /(?:celebrity\s+gossip|movie\s+review|hollywood\s+actors)/i,
];

const AGRONOMIC_KEYWORDS: RegExp =
  /(?:crop|farm|field|acre|hectare|ha|maize|cassava|tomato|sorghum|coffee|soil|fertilizer|lime|pest|disease|armyworm|blight|aphid|weather|rain|drought|irrigation|spei|whorl|yield|plant|seed|neem|mahindi|mhogo|nyanya|mtama|udongo|chokaa|mbolea|wadudu|funza|ukungu|kilimo|ekari|hekta)/i;

export function isNonAgronomicOrInjection(query: string): boolean {
  const q = query.trim();
  if (!q) return true;

  // Prompt injection is always blocked, even if agricultural words are injected
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(q)) {
      return true;
    }
  }

  // Pure off-topic coding tasks without farming context
  for (const pattern of OFF_TOPIC_CODING_PATTERNS) {
    if (pattern.test(q)) {
      return true;
    }
  }

  // Pure off-topic math calculations
  for (const pattern of OFF_TOPIC_MATH_PATTERNS) {
    if (pattern.test(q)) {
      return true;
    }
  }

  // General off-topic (crypto, entertainment) without agronomic keywords
  for (const pattern of OFF_TOPIC_GENERAL_PATTERNS) {
    if (pattern.test(q) && !AGRONOMIC_KEYWORDS.test(q)) {
      return true;
    }
  }

  return false;
}
