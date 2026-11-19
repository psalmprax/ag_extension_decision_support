jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/services/smsService', () => ({ smsService: { sendSMS: jest.fn() } }));
jest.mock('@/services/whatsappService', () => ({ whatsappService: { sendMessage: jest.fn() } }));
jest.mock('@/services/telegramService', () => ({ telegramService: { sendMessage: jest.fn() } }));
jest.mock('@/services/usageService', () => ({
  usageService: { hasAllowance: jest.fn(), incrementUsage: jest.fn().mockResolvedValue(undefined) },
}));

import { autonomousCampaignService } from '@/services/autonomousCampaignService';
import { smsService } from '@/services/smsService';
import { whatsappService } from '@/services/whatsappService';
import { telegramService } from '@/services/telegramService';
import { usageService } from '@/services/usageService';

interface CohortFarmer {
  id: string;
  phone?: string | null;
  notes?: string | null;
  first_name?: string;
}

/** The cohort dispatcher, the single place a campaign sends messages. */
const dispatch = (farmers: CohortFarmer[], channel: string, userId: string | null) =>
  (
    autonomousCampaignService as unknown as {
      dispatchToFarmerCohort(
        farmers: CohortFarmer[],
        advisoryText: string,
        channel: string,
        userId?: string | null
      ): Promise<{ total: number; byChannel: { sms: number; whatsapp: number; telegram: number } }>;
    }
  ).dispatchToFarmerCohort(farmers, 'Scout for armyworm this week.', channel, userId);

const farmers: CohortFarmer[] = [
  { id: 'f1', phone: '+254700000001', first_name: 'Amina', notes: 'tg:111' },
  { id: 'f2', phone: '+254700000002', first_name: 'Baraka', notes: 'tg:222' },
  { id: 'f3', phone: '+254700000003', first_name: 'Chebet', notes: 'tg:333' },
];

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(smsService.sendSMS).mockResolvedValue(true as never);
  jest.mocked(whatsappService.sendMessage).mockResolvedValue({ success: true } as never);
  jest.mocked(telegramService.sendMessage).mockResolvedValue({ success: true } as never);
});

describe('campaign messages are charged to the launching officer, one by one', () => {
  it('stops sending SMS the moment the quota runs out, and counts only what was sent', async () => {
    // Two SMS left on the plan.
    jest.mocked(usageService.hasAllowance)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);

    const result = await dispatch(farmers, 'sms', 'officer-1');

    expect(smsService.sendSMS).toHaveBeenCalledTimes(2);
    expect(result.byChannel.sms).toBe(2);
    expect(usageService.incrementUsage).toHaveBeenCalledTimes(2);
    expect(usageService.incrementUsage).toHaveBeenCalledWith('officer-1', 'sms');
  });

  it('sends nothing on a plan without SMS', async () => {
    jest.mocked(usageService.hasAllowance).mockResolvedValue(false);
    const result = await dispatch(farmers, 'sms', 'officer-1');
    expect(smsService.sendSMS).not.toHaveBeenCalled();
    expect(result.total).toBe(0);
  });

  it('charges WhatsApp and Telegram to the WhatsApp & Telegram quota', async () => {
    jest.mocked(usageService.hasAllowance).mockResolvedValue(true);
    await dispatch([farmers[0]], 'all', 'officer-1');

    expect(usageService.hasAllowance).toHaveBeenCalledWith('officer-1', 'sms');
    expect(usageService.hasAllowance).toHaveBeenCalledWith('officer-1', 'whatsapp');
    expect(jest.mocked(usageService.incrementUsage).mock.calls).toEqual([
      ['officer-1', 'sms'],
      ['officer-1', 'whatsapp'],
      ['officer-1', 'whatsapp'],
    ]);
  });

  it('does not count a message the provider failed to send', async () => {
    jest.mocked(usageService.hasAllowance).mockResolvedValue(true);
    jest.mocked(smsService.sendSMS).mockResolvedValue(false as never);
    await dispatch([farmers[0]], 'sms', 'officer-1');
    expect(usageService.incrementUsage).not.toHaveBeenCalled();
  });
});
