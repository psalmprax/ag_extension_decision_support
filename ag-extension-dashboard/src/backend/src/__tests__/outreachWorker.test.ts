import { query } from '../services/databaseService';
import { smsService } from '../services/smsService';
import { whatsappService } from '../services/whatsappService';
import { emailService } from '../services/emailService';
import { OutreachWorker, OutreachQueueRow, getOutreachDeliveryStats, retryOutreachMessages } from '../workers/outreachWorker';

jest.mock('../services/databaseService', () => ({
  query: jest.fn(),
}));
jest.mock('../services/smsService', () => ({
  smsService: { sendSMS: jest.fn() },
}));
jest.mock('../services/whatsappService', () => ({
  whatsappService: { sendMessage: jest.fn() },
}));
jest.mock('../services/emailService', () => ({
  emailService: { sendEmail: jest.fn() },
}));
jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const dbQuery = query as jest.Mock;
const sendSMS = smsService.sendSMS as jest.Mock;
const sendWhatsApp = whatsappService.sendMessage as jest.Mock;
const sendEmail = emailService.sendEmail as jest.Mock;

function makeRow(overrides: Partial<OutreachQueueRow> = {}): OutreachQueueRow {
  return {
    id: 'row-1',
    farmer_id: 'f-1',
    recipient: null,
    message: 'Heavy rain expected tomorrow. Delay spraying.',
    channel: 'sms',
    attempts: 1,
    ...overrides,
  };
}

interface CapturedUpdate {
  sql: string;
  params: unknown[];
}

function setupDb(claimRows: OutreachQueueRow[], farmerRows: Array<{ phone: string | null }> = []) {
  const updates: CapturedUpdate[] = [];
  dbQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('CREATE TABLE IF NOT EXISTS outreach_messages')) return { rows: [] };
    if (sql.includes('RETURNING id, farmer_id')) return { rows: claimRows };
    if (sql.includes('FROM farmers')) return { rows: farmerRows };
    updates.push({ sql, params });
    return { rows: [] };
  });
  return updates;
}

describe('OutreachWorker', () => {
  let worker: OutreachWorker;

  beforeEach(() => {
    jest.resetAllMocks();
    worker = new OutreachWorker();
  });

  it('claims rows atomically with FOR UPDATE SKIP LOCKED and priority ordering', async () => {
    const updates = setupDb([]);
    await worker.processQueue();

    const claimSql = dbQuery.mock.calls.find(([sql]) => sql.includes('RETURNING id, farmer_id'))?.[0] as string;
    expect(claimSql).toContain('FOR UPDATE SKIP LOCKED');
    expect(claimSql).toContain("CASE priority WHEN 'urgent' THEN 0");
    expect(updates).toHaveLength(0);
  });

  it('delivers queued sms via the resolved farmer phone and marks it sent', async () => {
    const updates = setupDb([makeRow()], [{ phone: '+254712345678' }]);
    sendSMS.mockResolvedValue(true);

    const processed = await worker.processQueue();

    expect(processed).toBe(1);
    expect(sendSMS).toHaveBeenCalledWith(
      expect.objectContaining({ to: '+254712345678', message: 'Heavy rain expected tomorrow. Delay spraying.' })
    );
    const sentUpdate = updates.find(u => u.sql.includes("status = 'sent'"));
    expect(sentUpdate).toBeDefined();
    expect(sentUpdate!.params).toContain('row-1');
  });

  it('prefers the producer-supplied recipient over the farmer record lookup', async () => {
    setupDb(
      [makeRow({ recipient: '+254700000000' })],
      [{ phone: '+254712345678' }]
    );
    sendSMS.mockResolvedValue(true);

    await worker.processQueue();

    expect(sendSMS).toHaveBeenCalledWith(expect.objectContaining({ to: '+254700000000' }));
    expect(dbQuery.mock.calls.some(([sql]) => String(sql).includes('FROM farmers'))).toBe(false);
  });

  it('requeues sms for retry when the provider fails and attempts remain', async () => {
    const updates = setupDb([makeRow({ attempts: 1 })], [{ phone: '+254712345678' }]);
    sendSMS.mockResolvedValue(false);

    await worker.processQueue();

    const requeued = updates.find(u => u.sql.includes("status = $2") && u.params.includes('queued'));
    expect(requeued).toBeDefined();
    expect(requeued!.params).toContain('SMS provider rejected or failed to send the message');
  });

  it('marks sms as failed when attempts are exhausted', async () => {
    const updates = setupDb([makeRow({ attempts: 3 })], [{ phone: '+254712345678' }]);
    sendSMS.mockResolvedValue(false);

    await worker.processQueue();

    const failed = updates.find(u => u.params.includes('failed'));
    expect(failed).toBeDefined();
    expect(updates.some(u => u.params.includes('queued'))).toBe(false);
  });

  it('sends queued email directly (useQueue false) so the result reflects real delivery', async () => {
    const updates = setupDb([makeRow({ channel: 'email', recipient: 'farmer@example.com', farmer_id: null })]);
    sendEmail.mockResolvedValue(true);

    await worker.processQueue();

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'farmer@example.com', useQueue: false })
    );
    const sentUpdate = updates.find(u => u.sql.includes("status = 'sent'"));
    expect(sentUpdate).toBeDefined();
  });

  it('fails email rows immediately when no recipient was captured at enqueue time', async () => {
    const updates = setupDb([makeRow({ channel: 'email', recipient: null })]);

    await worker.processQueue();

    expect(sendEmail).not.toHaveBeenCalled();
    const failed = updates.find(u => u.params.includes('failed'));
    expect(failed).toBeDefined();
    expect(failed!.params.some(p => String(p).includes('No email address available'))).toBe(true);
  });

  it('fails rows permanently for unsupported channels without calling providers', async () => {
    const updates = setupDb([makeRow({ channel: 'telegram' })]);

    await worker.processQueue();

    expect(sendSMS).not.toHaveBeenCalled();
    expect(sendWhatsApp).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    const failed = updates.find(u => u.params.includes('failed'));
    expect(failed).toBeDefined();
    expect(failed!.params.some(p => String(p).includes('Unsupported outreach channel "telegram"'))).toBe(true);
  });

  it('marks whatsapp rows failed permanently when no phone is resolvable', async () => {
    const updates = setupDb([makeRow({ channel: 'whatsapp', farmer_id: null })]);
    sendWhatsApp.mockResolvedValue({ success: true, status: 'sent', provider: 'twilio' });

    await worker.processQueue();

    expect(sendWhatsApp).not.toHaveBeenCalled();
    const failed = updates.find(u => u.params.includes('failed'));
    expect(failed).toBeDefined();
  });

  it('delivers whatsapp rows through the provider and marks sent on success', async () => {
    const updates = setupDb([makeRow({ channel: 'whatsapp' })], [{ phone: '+254712345678' }]);
    sendWhatsApp.mockResolvedValue({ success: true, status: 'sent', provider: 'twilio' });

    await worker.processQueue();

    expect(sendWhatsApp).toHaveBeenCalledWith(expect.objectContaining({ to: '+254712345678' }));
    expect(updates.some(u => u.sql.includes("status = 'sent'"))).toBe(true);
  });

  it('returns zero without dispatching anything when the queue is empty', async () => {
    const updates = setupDb([]);
    sendSMS.mockResolvedValue(true);

    const processed = await worker.processQueue();

    expect(processed).toBe(0);
    expect(sendSMS).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });
});

describe('getOutreachDeliveryStats', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('aggregates status counts, delivery rate, channel breakdown, and recent failures', async () => {
    dbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('GROUP BY status')) {
        return {
          rows: [
            { status: 'sent', count: '7' },
            { status: 'failed', count: '3' },
            { status: 'queued', count: '2' },
          ],
        };
      }
      if (sql.includes('GROUP BY channel, status')) {
        return {
          rows: [
            { channel: 'sms', status: 'sent', count: '5' },
            { channel: 'sms', status: 'failed', count: '2' },
            { channel: 'email', status: 'sent', count: '2' },
            { channel: 'email', status: 'failed', count: '1' },
          ],
        };
      }
      if (sql.includes("WHERE status = 'failed'")) {
        return {
          rows: [
            {
              id: 'f-1',
              channel: 'sms',
              recipient: '+254700000000',
              last_error: 'SMS provider rejected the message',
              attempts: 3,
              updated_at: new Date('2026-08-28T10:00:00Z'),
            },
          ],
        };
      }
      return { rows: [] };
    });

    const stats = await getOutreachDeliveryStats();

    expect(stats.totals).toEqual({ total: 12, sent: 7, failed: 3, queued: 2, processing: 0, sentRate: 58 });
    expect(stats.byChannel).toEqual([
      { channel: 'sms', total: 7, sent: 5, failed: 2 },
      { channel: 'email', total: 3, sent: 2, failed: 1 },
    ]);
    expect(stats.recentFailures).toEqual([
      {
        id: 'f-1',
        channel: 'sms',
        recipient: '+254700000000',
        lastError: 'SMS provider rejected the message',
        attempts: 3,
        updatedAt: '2026-08-28T10:00:00.000Z',
      },
    ]);
  });

  it('returns honest zeros when the queue table does not exist', async () => {
    dbQuery.mockRejectedValue(new Error('relation "outreach_messages" does not exist'));

    const stats = await getOutreachDeliveryStats();

    expect(stats).toEqual({
      totals: { total: 0, sent: 0, failed: 0, queued: 0, processing: 0, sentRate: 0 },
      byChannel: [],
      recentFailures: [],
    });
  });
});

describe('retryOutreachMessages', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('requeues failed rows with a fresh attempt budget and returns the count', async () => {
    dbQuery.mockResolvedValue({ rows: [{ id: 'f-1' }, { id: 'f-2' }] });

    const requeued = await retryOutreachMessages(['f-1', 'f-2']);

    expect(requeued).toBe(2);
    const sql = dbQuery.mock.calls[0][0] as string;
    expect(sql).toContain("status = 'queued'");
    expect(sql).toContain('attempts = 0');
    expect(sql).toContain('last_error = NULL');
    expect(sql).toContain("status = 'failed'");
    expect(sql).toContain('RETURNING id');
    expect(dbQuery.mock.calls[0][1]).toEqual([['f-1', 'f-2']]);
  });

  it('returns 0 for an empty id list without querying', async () => {
    const requeued = await retryOutreachMessages([]);

    expect(requeued).toBe(0);
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it('returns 0 when the table is unavailable', async () => {
    dbQuery.mockRejectedValue(new Error('relation "outreach_messages" does not exist'));

    const requeued = await retryOutreachMessages(['f-1']);

    expect(requeued).toBe(0);
  });
});
