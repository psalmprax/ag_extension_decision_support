/** An approval sends its email once, and never on the requester's own say-so. */
const mockQuery = jest.fn();
const mockSendEmail = jest.fn();
jest.mock('@/services/databaseService', () => ({ query: (...args: unknown[]) => mockQuery(...args), getPool: () => ({}) }));
jest.mock('@/services/emailService', () => ({ emailService: { sendEmail: (...args: unknown[]) => mockSendEmail(...args) } }));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { emailWorkflowService } from '@/services/emailWorkflowService';

const email = { to: ['coop@example.org'], subject: 'Training on Thursday', html: '<p>Bring your seed samples.</p>' };

beforeEach(() => {
  mockQuery.mockReset();
  mockSendEmail.mockReset().mockResolvedValue(true);
});

describe('emailWorkflowService.reviewApproval', () => {
  it('sends the email when a pending approval is approved', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ email_data: email }] });
    await expect(emailWorkflowService.reviewApproval('ap-1', 'approved', 'admin-1')).resolves.toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("status = 'pending'");
    expect(sql).toContain('requested_by <> $2');
    expect(params).toEqual(['approved', 'admin-1', null, 'ap-1']);
  });

  it('sends nothing for an approval that was already reviewed, or is the reviewer\'s own', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(emailWorkflowService.reviewApproval('ap-1', 'approved', 'admin-1')).resolves.toBe(false);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
