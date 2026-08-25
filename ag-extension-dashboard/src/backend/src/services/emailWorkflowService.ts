/* eslint-disable @typescript-eslint/no-explicit-any */
import { query, getPool, TypedQueryResult } from '@/services/databaseService';
import { emailService } from '@/services/emailService';
import { logger } from '@/utils/logger';
import { t, loadTranslations } from '@/utils/translations';

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

/** Raw `email_templates` row shape as returned by `pg`. */
interface EmailTemplateRow {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  variables: string[];
  created_by: string;
  created_at: Date | string;
}

class EmailWorkflowService {
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
      // Load translations for template seeding and display
      loadTranslations();

      const pool = getPool();
      if (!pool) return;

      await query(`
        CREATE TABLE IF NOT EXISTS email_templates (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          subject TEXT NOT NULL,
          body TEXT NOT NULL,
          category VARCHAR(100) DEFAULT 'general',
          variables TEXT[] DEFAULT '{}',
          created_by VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Migration: Add UNIQUE constraint if it doesn't exist and cleanup duplicates
      try {
        // Cleanup duplicates first (keep the one with the smallest ID)
        await query(`
          DELETE FROM email_templates a 
          USING email_templates b 
          WHERE a.id > b.id AND a.name = b.name
        `);
        
        // Add constraint if it doesn't exist (Postgres 9.1+)
        await query(`
          DO $$ 
          BEGIN 
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_templates_name_unique') THEN
              ALTER TABLE email_templates ADD CONSTRAINT email_templates_name_unique UNIQUE (name);
            END IF;
          END $$;
        `);
      } catch (err) {
        logger.warn('Email templates migration warning:', err);
      }

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
        subject: t('email_template_farmer_visit_confirmation_subject'),
        body: t('email_template_farmer_visit_confirmation_body'),
        category: 'visits',
        variables: ['farmerName', 'officerName', 'location', 'visitDate', 'visitTime', 'purpose'],
      },
      {
        name: 'disease_alert_notification',
        subject: t('email_template_disease_alert_subject'),
        body: t('email_template_disease_alert_body'),
        category: 'alerts',
        variables: ['diseaseName', 'region', 'affectedCrops', 'severity', 'recommendations'],
      },
      {
        name: 'market_price_update',
        subject: t('email_template_market_price_subject'),
        body: t('email_template_market_price_body'),
        category: 'market',
        variables: ['cropName', 'price', 'unit', 'priceTable', 'marketName', 'date'],
      },
      {
        name: 'weather_advisory',
        subject: t('email_template_weather_advisory_subject'),
        body: t('email_template_weather_advisory_body'),
        category: 'weather',
        variables: ['region', 'dateRange', 'weatherSummary', 'recommendations'],
      },
      {
        name: 'training_invitation',
        subject: t('email_template_training_invitation_subject'),
        body: t('email_template_training_invitation_body'),
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

    let result: TypedQueryResult<EmailTemplateRow>;
    if (category) {
      result = await query<EmailTemplateRow>(`
        SELECT * FROM email_templates WHERE category = $1 ORDER BY name
      `, [category]);
    } else {
      result = await query<EmailTemplateRow>('SELECT * FROM email_templates ORDER BY category, name');
    }

    // Translate subjects and add display names
    return result.rows.map((template) => ({
      id: template.id,
      name: template.name,
      subject: this.translateTemplateField(template.subject),
      body: template.body,
      category: template.category,
      variables: template.variables,
      createdBy: template.created_by,
      createdAt: template.created_at instanceof Date ? template.created_at.toISOString() : template.created_at,
      displayName: this.getTemplateDisplayName(template.name),
    }));
  }

  private getTemplateDisplayName(templateName: string): string {
    const displayNames: Record<string, string> = {
      'farmer_visit_confirmation': 'Farmer Visit Confirmation',
      'disease_alert_notification': 'Disease Alert Notification',
      'market_price_update': 'Market Price Update',
      'weather_advisory': 'Weather Advisory',
      'training_invitation': 'Training Invitation'
    };
    return displayNames[templateName] || templateName;
  }

  private translateTemplateField(field: string): string {
    // If it's already translated (doesn't start with email_template_), return as is
    if (!field.startsWith('email_template_')) {
      return field;
    }

    // Try to translate using our translation function
    try {
      const translated = t(field);
      // If translation is different from the key, return it
      if (translated !== field && translated) {
        logger.info(`✅ Translated: ${field} -> ${translated}`);
        return translated;
      } else {
        logger.warn(`⚠️ Translation not found for key: ${field}`);
        return field;
      }
    } catch (error) {
      logger.error(`❌ Translation error for ${field}:`, error);
      return field;
    }
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

    const approval = result.rows[0] as unknown as EmailApproval;
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

  async updateTemplate(id: string, updates: {
    subject?: string;
    body?: string;
    category?: string;
    variables?: string[];
  }): Promise<boolean> {
    const pool = getPool();
    if (!pool) return false;

    const setClauses: string[] = [];
    const values: (string | string[])[] = [];
    let paramIndex = 1;

    if (updates.subject !== undefined) {
      setClauses.push(`subject = $${paramIndex++}`);
      values.push(updates.subject);
    }
    if (updates.body !== undefined) {
      setClauses.push(`body = $${paramIndex++}`);
      values.push(updates.body);
    }
    if (updates.category !== undefined) {
      setClauses.push(`category = $${paramIndex++}`);
      values.push(updates.category);
    }
    if (updates.variables !== undefined) {
      setClauses.push(`variables = $${paramIndex++}`);
      values.push(updates.variables);
    }

    if (setClauses.length === 0) return false;

    values.push(id);
    const result = await query(`
      UPDATE email_templates
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);

    return result.rows.length > 0;
  }

  async getPendingApprovals(): Promise<EmailApproval[]> {
    const pool = getPool();
    if (!pool) return [];

    const result = await query(`
      SELECT * FROM email_approvals WHERE status = 'pending' ORDER BY created_at DESC
    `);
    return result.rows as unknown as EmailApproval[];
  }
}

export const emailWorkflowService = EmailWorkflowService.getInstance();
