import { Router, Response } from 'express';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';
import { authorize, AuthRequest } from '@/middleware/authorize';

const router = Router();

// ── Types (mirrors the frontend ActivityItem shape) ──────────────────

interface JourneyStep {
  label: string;
  dwellTime: string;
  status?: 'active' | 'completed';
}

interface ActivityItem {
  id: string;
  farmerName: string;
  phone: string;
  channel: 'USSD' | 'SMS' | 'App' | 'Voice';
  language: 'EN' | 'SW' | 'FR';
  severityScore: number;
  crop: string;
  region: string;
  issue: string;
  aiSummary: string;
  timestamp: string;
  isClaimed: boolean;
  claimedBy?: string;
  journeySteps: JourneyStep[];
}

// ── Severity scoring ─────────────────────────────────────────────────

const CRITICAL_TERMS = [
  'blight', 'fall armyworm', 'armyworm', 'locust', 'necrosis',
  'wilt', 'xanthomonas', 'streak', 'outbreak', 'emergency',
  'dying', 'dead', 'destroyed', 'severe',
];

function computeSeverity(message: string): number {
  const lower = message.toLowerCase();
  let score = 15; // baseline

  for (const term of CRITICAL_TERMS) {
    if (lower.includes(term)) score += 20;
  }

  if (lower.includes('help') || lower.includes('urgent')) score += 10;
  if (lower.includes('?')) score += 5;
  return Math.min(score, 100);
}

function extractIssue(message: string, channel: string): string {
  if (channel === 'USSD' || channel === 'SMS') {
    // Extract first meaningful sentence, cap at 80 chars
    const sentence = message.split(/[.!?]\s*/)[0].trim();
    return sentence.length > 80 ? sentence.slice(0, 77) + '…' : sentence;
  }
  // App/Voice — use intent or first line
  return message.slice(0, 100).replace(/\n/g, ' ');
}

function extractCrop(message: string): string {
  const lower = message.toLowerCase();
  const crops = [
    'maize', 'beans', 'potato', 'tomato', 'coffee', 'banana',
    'cassava', 'wheat', 'rice', 'sorghum', 'millet', 'sugarcane',
    'tea', 'cotton', 'sunflower', 'groundnut', 'cowpea',
  ];
  const found = crops.filter(c => lower.includes(c));
  return found.length > 0
    ? found.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(' / ')
    : 'General';
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function buildJourney(channel: string, _status: string): JourneyStep[] {
  switch (channel) {
    case 'USSD':
      return [
        { label: 'USSD Dialed', dwellTime: timeAgo(new Date().toISOString()) },
        { label: 'Menu Navigated', dwellTime: timeAgo(new Date().toISOString()) },
        { label: 'Query Submitted', dwellTime: 'Now', status: 'active' },
      ];
    case 'SMS':
      return [
        { label: 'SMS Received', dwellTime: timeAgo(new Date().toISOString()) },
        { label: 'AI Parser', dwellTime: timeAgo(new Date().toISOString()) },
        { label: 'Triage Queue', dwellTime: 'Now', status: 'active' },
      ];
    case 'App':
      return [
        { label: 'App Opened', dwellTime: timeAgo(new Date().toISOString()) },
        { label: 'Data Submitted', dwellTime: timeAgo(new Date().toISOString()) },
        { label: 'Awaiting Review', dwellTime: 'Now', status: 'active' },
      ];
    case 'Voice':
      return [
        { label: 'Call Received', dwellTime: timeAgo(new Date().toISOString()) },
        { label: 'Transcribed', dwellTime: timeAgo(new Date().toISOString()) },
        { label: 'Triage Queue', dwellTime: 'Now', status: 'active' },
      ];
    default:
      return [];
  }
}

// ── Data fetchers ─────────────────────────────────────────────────────

interface SmsRow {
  id: string;
  recipient_phone: string;
  message: string;
  status: string;
  provider: string;
  created_at: string;
  farmer_name?: string;
  farmer_phone?: string;
  farmer_region?: string;
  farmer_language?: string;
}

interface ChatRow {
  id: string;
  role: string;
  content: string;
  language: string;
  is_voice: boolean;
  created_at: string;
  farmer_name?: string;
  farmer_phone?: string;
  farmer_region?: string;
}

async function fetchSmsEvents(userId: string, role: string): Promise<ActivityItem[]> {
  let scopeClause = '';
  const params: unknown[] = [];
  let paramIdx = 1;

  if (role === 'farmer') {
    scopeClause = `AND sh.farmer_id IN (SELECT id FROM farmers WHERE user_id = $${paramIdx++})`;
    params.push(userId);
  } else if (role === 'extension_officer') {
    scopeClause = `AND sh.farmer_id IN (SELECT id FROM farmers WHERE assigned_officer_id = $${paramIdx++})`;
    params.push(userId);
  }

  const sql = `
    SELECT sh.id, sh.recipient_phone, sh.message, sh.status,
           COALESCE(sh.provider, 'sms') AS provider, sh.created_at,
           TRIM(CONCAT(f.first_name, ' ', f.last_name)) AS farmer_name,
           f.phone AS farmer_phone,
           f.region AS farmer_region,
           f.language_preference AS farmer_language
    FROM sms_history sh
    LEFT JOIN farmers f ON f.id = sh.farmer_id
    WHERE sh.created_at >= NOW() - INTERVAL '24 hours'
      ${scopeClause}
      AND sh.status != 'scheduled'
    ORDER BY sh.created_at DESC
    LIMIT 50
  `;

  const result = await query<SmsRow>(sql, params);
  return result.rows.map(row => mapSmsToActivity(row));
}

function mapSmsToActivity(row: SmsRow): ActivityItem {
  const channel: ActivityItem['channel'] =
    row.provider === 'ussd' ? 'USSD' : 'SMS';
  const lang = normalizeLanguage(row.farmer_language);
  return {
    id: `sms-${row.id}`,
    farmerName: row.farmer_name || 'Unknown Farmer',
    phone: row.farmer_phone || row.recipient_phone || '',
    channel,
    language: lang,
    severityScore: computeSeverity(row.message),
    crop: extractCrop(row.message),
    region: row.farmer_region || 'Unknown Region',
    issue: extractIssue(row.message, channel),
    aiSummary: row.message.slice(0, 120),
    timestamp: timeAgo(row.created_at),
    isClaimed: row.status === 'delivered' || row.status === 'read',
    journeySteps: buildJourney(channel, row.status),
  };
}

async function fetchChatEvents(userId: string, role: string): Promise<ActivityItem[]> {
  let scopeClause = '';
  const params: unknown[] = [];
  let paramIdx = 1;

  if (role === 'farmer') {
    scopeClause = `AND cc.farmer_id IN (SELECT id FROM farmers WHERE user_id = $${paramIdx++})`;
    params.push(userId);
  } else if (role === 'extension_officer') {
    scopeClause = `AND cc.farmer_id IN (SELECT id FROM farmers WHERE assigned_officer_id = $${paramIdx++})`;
    params.push(userId);
  }

  const sql = `
    SELECT cm.id, cm.role, cm.content, COALESCE(cm.language, 'EN') AS language,
           COALESCE(cm.is_voice, false) AS is_voice, cm.created_at,
           TRIM(CONCAT(f.first_name, ' ', f.last_name)) AS farmer_name,
           f.phone AS farmer_phone,
           f.region AS farmer_region
    FROM chat_messages cm
    JOIN chat_conversations cc ON cc.id = cm.conversation_id
    LEFT JOIN farmers f ON f.id = cc.farmer_id
    WHERE cm.role = 'user'
      AND cm.created_at >= NOW() - INTERVAL '24 hours'
      ${scopeClause}
    ORDER BY cm.created_at DESC
    LIMIT 30
  `;

  const result = await query<ChatRow>(sql, params);
  return result.rows.map(row => mapChatToActivity(row));
}

function mapChatToActivity(row: ChatRow): ActivityItem {
  // There is currently no producer that ingests voice messages (no webhook or
  // route writes is_voice = true), so a chat record is always app text. Keep
  // the mapping honest instead of surfacing a phantom 'Voice' channel that can
  // never be populated.
  const channel: ActivityItem['channel'] = 'App';
  const lang = normalizeLanguage(row.language);
  return {
    id: `chat-${row.id}`,
    farmerName: row.farmer_name || 'Unknown Farmer',
    phone: row.farmer_phone || '',
    channel,
    language: lang,
    severityScore: computeSeverity(row.content),
    crop: extractCrop(row.content),
    region: row.farmer_region || 'Unknown Region',
    issue: extractIssue(row.content, channel),
    aiSummary: row.content.slice(0, 120),
    timestamp: timeAgo(row.created_at),
    isClaimed: false,
    journeySteps: buildJourney(channel, 'received'),
  };
}

function normalizeLanguage(raw: string | undefined | null): ActivityItem['language'] {
  if (!raw) return 'EN';
  const upper = raw.toUpperCase();
  if (upper.startsWith('SW')) return 'SW';
  if (upper.startsWith('FR')) return 'FR';
  return 'EN';
}

// ── Endpoint ──────────────────────────────────────────────────────────

/**
 * GET /api/v1/activities/triage
 *
 * Aggregates real SMS/USSD/App/Voice events from sms_history and
 * chat_messages into a unified triage stream for the extension officer
 * LiveActivityStream dashboard.
 *
 * Scoped by role: farmers see their own, officers see assigned farmers,
 * admins see everything.
 */
router.get(
  '/triage',
  authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role || 'extension_officer';

      const [smsEvents, chatEvents] = await Promise.all([
        fetchSmsEvents(userId, role),
        fetchChatEvents(userId, role),
      ]);

      // Merge and sort by severity descending
      const all = [...smsEvents, ...chatEvents]
        .sort((a, b) => b.severityScore - a.severityScore);

      res.json({
        success: true,
        data: all,
        meta: {
          total: all.length,
          smsCount: smsEvents.length,
          chatCount: chatEvents.length,
          isRealData: all.length > 0,
          note: all.length === 0
            ? 'No live events in the last 24 hours. SMS/USSD and chatbot activity will appear here automatically.'
            : undefined,
        },
      });
    } catch (error) {
      logger.error('Activity triage aggregation failed:', error);
      safeError(res, 500, 'Failed to aggregate activity triage data');
    }
  }
);

export default router;