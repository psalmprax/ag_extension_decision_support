jest.mock('@/utils/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { joinNewUserTenant } from '@/services/newUserTenant';
import { logger } from '@/utils/logger';

type Rows = { rows: Array<{ tenant_id: string | null }> };
const run = (result: Rows | Error) => jest.fn(async () => {
  if (result instanceof Error) throw result;
  return result;
});

describe('joinNewUserTenant', () => {
  beforeEach(() => jest.clearAllMocks());

  it('joins the manager\'s organisation first, then the creator\'s', async () => {
    const query = run({ rows: [{ tenant_id: 'tenant-kenya' }] });
    await expect(joinNewUserTenant(query, 'new-officer', { managerId: 'manager-1', creatorId: 'admin-1' })).resolves.toBe('tenant-kenya');
    const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(params).toEqual(['new-officer', ['manager-1', 'admin-1']]);
    expect(sql).toContain('ORDER BY array_position($2::uuid[], id)');
    // Never moves an account that already belongs to an organisation.
    expect(sql).toContain('u.tenant_id IS NULL');
  });

  it('uses whichever sources there are', async () => {
    const query = run({ rows: [{ tenant_id: 'tenant-admin' }] });
    await joinNewUserTenant(query, 'new-manager', { managerId: null, creatorId: 'admin-1' });
    expect((query.mock.calls[0] as unknown as [string, unknown[]])[1]).toEqual(['new-manager', ['admin-1']]);
  });

  it('does nothing without a source', async () => {
    const query = run({ rows: [] });
    await expect(joinNewUserTenant(query, 'self-signup-farmer', {})).resolves.toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it('says when no source belongs to an organisation', async () => {
    const query = run({ rows: [] });
    await expect(joinNewUserTenant(query, 'new-officer', { managerId: 'manager-without-org' })).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('an administrator must link it'));
  });

  it('never fails the account creation', async () => {
    const query = run(new Error('connection reset'));
    await expect(joinNewUserTenant(query, 'new-officer', { managerId: 'manager-1' })).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('could not be placed in an organisation'), expect.any(Error));
  });
});
