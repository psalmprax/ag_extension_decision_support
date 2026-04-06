import { query, getPool } from '@/services/databaseService';
import { emailService } from '@/services/emailService';
import { logger } from '@/utils/logger';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  variables: string[];
  createdBy: string;
  createdAt: string;
}

export interface EmailApproval {
  id: string;
  emailData: {
    to: string[];
    subject: string;
    html: string;
    templateId?: string;
  };
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComment?: string;
  createdAt: string;
}

export class EmailWorkflowService {
  private static instance: EmailWorkflowService;
  private templates: Map<string, EmailTemplate> = new Map();

  static getInstance(): EmailWorkflowService {
    if (!EmailWorkflowService.instance) {
      EmailWorkflowService.instance = new EmailWorkflowService();
    }
    return EmailWorkflowService.instance;
  }

  async initialize(): Promise<void> {
    try {
      const pool = getPool();
      if (!pool) return;

      await query(`
        CREATE TABLE IF NOT EXISTS email_templates (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          subject TEXT NOT NULL,
          body TEXT NOT NULL,
          category VARCHAR(100) DEFAULT 'general',
          variables TEXT[] DEFAULT '{}',
          created_by VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS email_approvals (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          email_data JSONB NOT NULL,
          requested_by VARCHAR(255) NOT NULL,
          status VARCHAR(20) DEFAULT 'pending',
          reviewed_by VARCHAR(255),
          reviewed_at TIMESTAMP,
          review_comment TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await this.seedDefaultTemplates();
      logger.info('Email workflow service initialized');
    } catch (error) {
      logger.error('Failed to initialize email workflow:', error);
    }
  }

  private async seedDefaultTemplates(): Promise<void> {
    const templates = [
      {
        name: 'farmer_visit_confirmation',
        subject: 'Farm Visit Confirmed - {{farmerName}} on {{visitDate}}',
        body: `Dear {{officerName}},

Your farm visit has been confirmed:

Farmer: {{farmerName}}
Location: {{location}}
Date: {{visitDate}}
Time: {{visitTime}}
Purpose: {{purpose}}

Please bring your field kit and ensure GPS tracking is enabled.

Best regards,
Ag Extension Team`,
        category: 'visits',
        variables: ['farmerName', 'officerName', 'location', 'visitDate', 'visitTime', 'purpose'],
      },
      {
        name: 'disease_alert_notification',
        subject: '⚠️ {{diseaseName}} Alert - {{region}} Region',
        body: `URGENT AGRICULTURAL ALERT

A {{diseaseName}} outbreak has been detected in the {{region}} region.

Affected Crops: {{affectedCrops}}
Severity: {{severity}}
Recommended Actions:
{{recommendations}}

Please inspect your fields immediately and report any signs of infection.

Contact your extension officer for assistance.`,
        category: 'alerts',
        variables: ['diseaseName', 'region', 'affectedCrops', 'severity', 'recommendations'],
      },
      {
        name: 'market_price_update',
        subject: 'Market Price Update - {{cropName}} at {{price}}/{{unit}}',
        body: `Dear Farmer,

Current market prices for your area:

{{priceTable}}

Market: {{marketName}}
Date: {{date}}

For more details, visit your dashboard or contact your extension officer.`,
        category: 'market',
        variables: ['cropName', 'price', 'unit', 'priceTable', 'marketName', 'date'],
      },
      {
        name: 'weather_advisory',
        subject: 'Weather Advisory - {{region}} ({{dateRange}})',
        body: `Weather Advisory for {{region}}

Forecast Period: {{dateRange}}

{{weatherSummary}}

Recommendations:
{{recommendations}}

Stay safe and plan your farming activities accordingly.`,
        category: 'weather',
        variables: ['region', 'dateRange', 'weatherSummary', 'recommendations'],
      },
      {
        name: 'training_invitation',
        subject: 'Training Invitation: {{trainingTopic}} on {{date}}',
        body: `Dear {{recipientName}},

You are invited to attend a training session:

Topic: {{trainingTopic}}
Date: {{date}}
Time: {{time}}
Location: {{location}}
Trainer: {{trainerName}}

Agenda:
{{agenda}}

Please confirm your attendance by replying to this email.

Best regards,
Ag Extension Training Team`,
        category: 'training',
        variables: ['recipientName', 'trainingTopic', 'date', 'time', 'location', 'trainerName', 'agenda'],
      },
    ];

    for (const tmpl of templates) {
      try {
        await query(`
          INSERT INTO email_templates (name, subject, body, category, variables, created_by)
          VALUES ($1, $2, $3, $4, $5, 'system')
          ON CONFLICT DO NOTHING
        `, [tmpl.name, tmpl.subject, tmpl.body, tmpl.category, tmpl.variables]);
      } catch {
        logger.warn(`Template ${tmpl.name} already exists, skipping`);
      }
    }
  }

  async getTemplates(category?: string): Promise<EmailTemplate[]> {
    const pool = getPool();
    if (!pool) return [];

    if (category) {
      const result = await query(`
        SELECT * FROM email_templates WHERE category = $1 ORDER BY name
      `, [category]);
      return result.rows;
    }

    const result = await query('SELECT * FROM email_templates ORDER BY category, name');
    return result.rows;
  }

  async renderTemplate(templateId: string, variables: Record<string, string>): Promise<{ subject: string; body: string } | null> {
    const pool = getPool();
    if (!pool) return null;

    const result = await query('SELECT * FROM email_templates WHERE id = $1', [templateId]);
    if (result.rows.length === 0) return null;

    const template = result.rows[0];
    let subject = template.subject;
    let body = template.body;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      subject = subject.replace(placeholder, value);
      body = body.replace(placeholder, value);
    }

    return { subject, body };
  }

  async requestApproval(emailData: {
    to: string[];
    subject: string;
    html: string;
    templateId?: string;
  }, requestedBy: string): Promise<EmailApproval> {
    const pool = getPool();
    if (!pool) throw new Error('Database not available');

    const result = await query(`
      INSERT INTO email_approvals (email_data, requested_by, status)
      VALUES ($1, $2, 'pending')
      RETURNING *
    `, [JSON.stringify(emailData), requestedBy]);

    const approval = result.rows[0];
    logger.info(`Email approval requested by ${requestedBy}: ${approval.id}`);
    return approval;
  }

  async reviewApproval(approvalId: string, status: 'approved' | 'rejected', reviewedBy: string, comment?: string): Promise<boolean> {
    const pool = getPool();
    if (!pool) return false;

    await query(`
      UPDATE email_approvals 
      SET status = $1, reviewed_by = $2, reviewed_at = NOW(), review_comment = $3
      WHERE id = $4
    `, [status, reviewedBy, comment, approvalId]);

    if (status === 'approved') {
      const result = await query('SELECT email_data FROM email_approvals WHERE id = $1', [approvalId]);
      if (result.rows.length > 0) {
        const emailData = result.rows[0].email_data;
        await emailService.sendEmail({
          to: emailData.to,
          subject: emailData.subject,
          html: emailData.html,
        });
        logger.info(`Approved email sent: ${approvalId}`);
      }
    }

    logger.info(`Email approval ${status}: ${approvalId} by ${reviewedBy}`);
    return true;
  }

  async getPendingApprovals(): Promise<EmailApproval[]> {
    const pool = getPool();
    if (!pool) return [];

    const result = await query(`
      SELECT * FROM email_approvals WHERE status = 'pending' ORDER BY created_at DESC
    `);
    return result.rows;
  }
}

export const emailWorkflowService = EmailWorkflowService.getInstance();
