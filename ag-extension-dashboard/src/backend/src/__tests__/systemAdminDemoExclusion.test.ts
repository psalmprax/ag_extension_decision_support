import { query } from '@/services/databaseService';
import { countActiveSystemAdmins, isSystemAdminUser, reportedSystemAdmin } from '@/services/systemAdminService';

jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));

const mockQuery = query as jest.Mock;

/**
 * Demo accounts are read-only and share a public password. They must never hold the
 * system-administrator credential: if one did, no real admin could create or promote
 * admins, and only the demo session guard would stand between a public password and
 * the top privilege.
 */
describe('system administrator flag excludes demo accounts', () => {
  beforeEach(() => mockQuery.mockReset());

  it('reads the flag only from non-demo rows', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await expect(isSystemAdminUser('demo-admin')).resolves.toBe(false);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/COALESCE\(is_demo, false\) = false/);
    expect(params).toEqual(['demo-admin']);
  });

  it('still recognises a real system administrator', async () => {
    mockQuery.mockResolvedValue({ rows: [{ is_system_admin: true }] });
    await expect(isSystemAdminUser('real-admin')).resolves.toBe(true);
  });

  it('does not count demo accounts toward the last-system-admin guard', async () => {
    mockQuery.mockResolvedValue({ rows: [{ total: 1 }] });
    await expect(countActiveSystemAdmins()).resolves.toBe(1);
    expect(mockQuery.mock.calls[0][0]).toMatch(/COALESCE\(is_demo, false\) = false/);
  });

  it.each([
    [{ is_system_admin: true, is_demo: true, email: 'admin@agridemo.com' }, false],
    [{ is_system_admin: true, is_demo: false, email: 'admin@agridemo.com' }, false],
    [{ is_system_admin: true, is_demo: false, email: 'ops@example.org' }, true],
    [{ is_system_admin: false, is_demo: false, email: 'ops@example.org' }, false],
    [{ is_system_admin: null, is_demo: null, email: null }, false],
  ])('reports %o to clients as %s', (row, expected) => {
    expect(reportedSystemAdmin(row)).toBe(expected);
  });
});
