const findUnique = jest.fn();
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({ user: { findUnique } })),
}));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { usageService } from '@/services/usageService';

describe('usageService.hasAllowance (work done on a user behalf outside a request)', () => {
  let checkLimit: jest.SpyInstance;

  beforeEach(() => {
    findUnique.mockReset();
    checkLimit = jest.spyOn(usageService, 'checkLimit');
  });
  afterEach(() => checkLimit.mockRestore());

  it.each([
    ['an admin', { role: 'admin', isDemo: false, email: 'ops@example.org' }],
    ['a demo account', { role: 'extension_officer', isDemo: true, email: 'x@example.org' }],
  ])('is unlimited for %s, like checkUsageLimit', async (_label, user) => {
    findUnique.mockResolvedValue(user);
    await expect(usageService.hasAllowance('u1', 'sms')).resolves.toBe(true);
    expect(checkLimit).not.toHaveBeenCalled();
  });

  it("follows the user's plan quota otherwise", async () => {
    findUnique.mockResolvedValue({ role: 'extension_officer', isDemo: false, email: 'o@example.org' });
    checkLimit.mockResolvedValueOnce({ allowed: false, current: 0, limit: 0 });
    await expect(usageService.hasAllowance('u1', 'ai_chat')).resolves.toBe(false);
    checkLimit.mockResolvedValueOnce({ allowed: true, current: 3, limit: 1000 });
    await expect(usageService.hasAllowance('u1', 'ai_chat')).resolves.toBe(true);
    expect(checkLimit).toHaveBeenCalledWith('u1', 'ai_chat');
  });

  it('refuses an unknown user and fails closed when the lookup errors', async () => {
    findUnique.mockResolvedValueOnce(null);
    await expect(usageService.hasAllowance('ghost', 'sms')).resolves.toBe(false);
    findUnique.mockRejectedValueOnce(new Error('db down'));
    await expect(usageService.hasAllowance('u1', 'sms')).resolves.toBe(false);
  });
});
