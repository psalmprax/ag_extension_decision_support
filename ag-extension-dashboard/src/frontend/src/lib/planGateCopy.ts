import { MessageSquare, Send, Bot, Eye, FileText, Zap, MapPin, BarChart3, Globe, Leaf, Search, type LucideIcon } from 'lucide-react';

export type PlanGateCategory =
  | 'sms'
  | 'chat'
  | 'whatsapp'
  | 'vision'
  | 'reports'
  | 'workflows'
  | 'visits'
  | 'analytics'
  | 'worldmonitor'
  | 'fields'
  | 'knowledge';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export interface PlanGateCopy {
  icon: LucideIcon;
  description: string;
  benefits: string[];
}

/**
 * What each paid feature does, in plain words. Quotas come from the plan
 * catalogue (backend prisma/planCatalog.json): Pro has 500 SMS, 1,000 AI
 * questions and 50 reports a month; Enterprise 10,000, 10,000 and 1,000.
 * Only list what the product does today.
 */
export function planGateCopy(category: PlanGateCategory, t: Translate): PlanGateCopy {
  const c = (key: string, defaultValue: string) => t(`plan_gate_${category}_${key}`, { defaultValue });
  switch (category) {
    case 'sms':
      return {
        icon: Send,
        description: c('desc', 'Send SMS to groups of farmers, including weather and pest alerts.'),
        benefits: [
          c('b1', '500 SMS a month on Pro, 10,000 on Enterprise'),
          c('b2', 'One message to many farmers at once'),
          c('b3', 'Weather and pest alerts'),
        ],
      };
    case 'chat':
      return {
        icon: MessageSquare,
        description: c('desc', 'Message farmers and officers, and ask the AI agronomist questions about crops.'),
        benefits: [
          c('b1', '1,000 AI questions a month on Pro, 10,000 on Enterprise'),
          c('b2', 'Two-way messages between officers and farmers'),
          c('b3', 'Voice notes written out as text'),
          c('b4', 'Answers that show the guides they come from'),
        ],
      };
    case 'whatsapp':
      return {
        icon: Bot,
        description: c('desc', 'Reach farmers on WhatsApp and Telegram, and answer their messages from one inbox.'),
        benefits: [
          c('b1', 'WhatsApp Business and Telegram channels'),
          c('b2', 'Incoming questions sorted for the right officer'),
          c('b3', 'Photos and voice notes in the same thread'),
        ],
      };
    case 'vision':
      return {
        icon: Eye,
        description: c('desc', 'Check a photo of a leaf or a field for likely diseases and soil problems. Results are possible causes for an officer to confirm.'),
        benefits: [
          c('b1', 'Likely causes from a crop photo'),
          c('b2', 'Soil readings for a field'),
          c('b3', 'A record of every check, by farmer'),
        ],
      };
    case 'reports':
      return {
        icon: FileText,
        description: c('desc', 'Written summaries of field work and farmer outcomes, with exports for government systems.'),
        benefits: [
          c('b1', '50 reports a month on Pro, 1,000 on Enterprise'),
          c('b2', 'CSV exports for government systems'),
          c('b3', 'Comparisons across districts and seasons'),
        ],
      };
    case 'workflows':
      return {
        icon: Zap,
        description: c('desc', 'Emails that send themselves: follow-ups, reminders and summaries for partners.'),
        benefits: [
          c('b1', 'Emails triggered by events, such as a new farmer'),
          c('b2', 'Follow-up reminders'),
          c('b3', 'Regular summaries for partners'),
        ],
      };
    case 'visits':
      return {
        icon: MapPin,
        description: c('desc', 'Plan farm visits, record what you saw, and keep each farmer\'s history in one place.'),
        benefits: [
          c('b1', 'Visit scheduling with the farm\'s location'),
          c('b2', 'Spoken visit notes turned into a written summary'),
          c('b3', 'Earlier visits side by side'),
          c('b4', 'A suggested order for the day\'s visits'),
        ],
      };
    case 'analytics':
      return {
        icon: BarChart3,
        description: c('desc', 'How quickly farmers get answers, what they ask about, and how your team is doing.'),
        benefits: [
          c('b1', 'Response times by officer'),
          c('b2', 'Farmer satisfaction from ratings'),
          c('b3', 'Crop prices and daily activity'),
          c('b4', 'Data export'),
        ],
      };
    case 'fields':
      return {
        icon: Leaf,
        description: c('desc', 'Each farm\'s fields with crops, growth stages, soil tests and harvests.'),
        benefits: [
          c('b1', 'Fields with their crops and growth stages'),
          c('b2', 'Soil tests and weather for each field'),
          c('b3', 'Harvests recorded per season'),
        ],
      };
    case 'knowledge':
      return {
        icon: Search,
        description: c('desc', 'Ask questions and get answers written from your guides, with the sources behind them.'),
        benefits: [
          c('b1', 'Answers in the language you read the app in'),
          c('b2', 'The sources behind every answer'),
          c('b3', 'Answers read aloud'),
        ],
      };
    case 'worldmonitor':
      return {
        icon: Globe,
        description: c('desc', 'A map of your farmers with crop-stress, soil and pest reports by area.'),
        benefits: [
          c('b1', 'Crop-stress reports from the last 30 days, mapped'),
          c('b2', 'Soil pH by region'),
          c('b3', 'Pest reports from the last 14 days'),
          c('b4', 'Filters by county, crop and region'),
        ],
      };
  }
}
