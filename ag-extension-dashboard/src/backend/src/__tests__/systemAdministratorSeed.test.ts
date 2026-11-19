import bcrypt from 'bcryptjs';

// Plain CommonJS shared by prisma/seed.cjs (deployed) and prisma/seed.ts.
const seedModule = require('../../prisma/systemAdministrator.cjs') as {
  SYSTEM_ADMIN_EMAIL: string;
  PUBLIC_DEFAULT_PASSWORD: string;
  INITIAL_PASSWORD_ENV: string;
  ensureSystemAdministrator: (deps: {
    prisma: FakePrisma;
    bcrypt: typeof bcrypt;
    env?: Record<string, string | undefined>;
    log?: Pick<Console, 'info' | 'warn' | 'error'>;
  }) => Promise<'missing' | 'needs-password' | 'enabled' | 'kept-without-flag'>;
};
const { SYSTEM_ADMIN_EMAIL, PUBLIC_DEFAULT_PASSWORD, INITIAL_PASSWORD_ENV, ensureSystemAdministrator } = seedModule;

interface FakeUser {
  id: string;
  email: string;
  passwordHash: string;
  isDemo: boolean;
  isSystemAdmin: boolean;
}

interface FakeSession {
  userId: string;
  isRevoked: boolean;
}

/** The handful of Prisma calls the helper makes, over in-memory rows. */
class FakePrisma {
  constructor(public users: FakeUser[], public sessions: FakeSession[] = []) {}

  user = {
    findUnique: async ({ where }: { where: { email: string } }) => this.users.find(u => u.email === where.email) ?? null,
    count: async ({ where }: { where: { isSystemAdmin: boolean; isDemo: boolean; id: { not: string } } }) =>
      this.users.filter(u => u.isSystemAdmin === where.isSystemAdmin && u.isDemo === where.isDemo && u.id !== where.id.not)
        .length,
    update: async ({ where, data }: { where: { id: string }; data: Partial<FakeUser> }) => {
      const user = this.users.find(u => u.id === where.id);
      if (!user) throw new Error('no such user');
      Object.assign(user, data);
      return user;
    },
  };

  userSession = {
    updateMany: async ({ where, data }: { where: { userId: string; isRevoked: boolean }; data: { isRevoked: boolean } }) => {
      const hits = this.sessions.filter(s => s.userId === where.userId && s.isRevoked === where.isRevoked);
      hits.forEach(s => Object.assign(s, data));
      return { count: hits.length };
    },
  };
}

const silentLog = () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() });
const PRIVATE_PASSWORD = 'correct-horse-battery-staple';

async function adminWith(password: string, overrides: Partial<FakeUser> = {}): Promise<FakeUser> {
  return {
    id: 'sys-1',
    email: SYSTEM_ADMIN_EMAIL,
    passwordHash: await bcrypt.hash(password, 4),
    isDemo: true,
    isSystemAdmin: false,
    ...overrides,
  };
}

describe('ensureSystemAdministrator (admin@agridemo.com)', () => {
  it('sets the initial password from the env var once, enables the account and signs out old sessions', async () => {
    const admin = await adminWith(PUBLIC_DEFAULT_PASSWORD);
    const prisma = new FakePrisma([admin], [{ userId: 'sys-1', isRevoked: false }]);
    const log = silentLog();

    const result = await ensureSystemAdministrator({
      prisma, bcrypt, env: { [INITIAL_PASSWORD_ENV]: PRIVATE_PASSWORD }, log,
    });

    expect(result).toBe('enabled');
    expect(admin).toMatchObject({ isDemo: false, isSystemAdmin: true });
    expect(await bcrypt.compare(PRIVATE_PASSWORD, admin.passwordHash)).toBe(true);
    expect(await bcrypt.compare(PUBLIC_DEFAULT_PASSWORD, admin.passwordHash)).toBe(false);
    expect(prisma.sessions[0].isRevoked).toBe(true);
    // The password itself is never logged.
    const logged = JSON.stringify([log.info.mock.calls, log.warn.mock.calls, log.error.mock.calls]);
    expect(logged).not.toContain(PRIVATE_PASSWORD);
  });

  it('never resets a password the owner already changed, even with the env var still set', async () => {
    const admin = await adminWith('owner-chose-this-later', { isDemo: false, isSystemAdmin: true });
    const before = admin.passwordHash;
    const prisma = new FakePrisma([admin], [{ userId: 'sys-1', isRevoked: false }]);

    const result = await ensureSystemAdministrator({
      prisma, bcrypt, env: { [INITIAL_PASSWORD_ENV]: PRIVATE_PASSWORD }, log: silentLog(),
    });

    expect(result).toBe('enabled');
    expect(admin.passwordHash).toBe(before);
    expect(prisma.sessions[0].isRevoked).toBe(false);
  });

  it.each([
    ['unset', undefined],
    ['blank', '   '],
    ['too short', 'short1'],
    ['the public default', PUBLIC_DEFAULT_PASSWORD],
  ])('keeps the account read-only and without the flag when the env var is %s', async (_label, value) => {
    // Even if an older seed left it as a real admin, a public password enables nothing.
    const admin = await adminWith(PUBLIC_DEFAULT_PASSWORD, { isDemo: false, isSystemAdmin: true });
    const prisma = new FakePrisma([admin]);
    const log = silentLog();

    const result = await ensureSystemAdministrator({ prisma, bcrypt, env: { [INITIAL_PASSWORD_ENV]: value }, log });

    expect(result).toBe('needs-password');
    expect(admin).toMatchObject({ isDemo: true, isSystemAdmin: false });
    expect(await bcrypt.compare(PUBLIC_DEFAULT_PASSWORD, admin.passwordHash)).toBe(true);
    expect(log.error).toHaveBeenCalled();
  });

  it('does not take the flag back from another real system administrator chosen deliberately', async () => {
    const admin = await adminWith('private-password-123', { isDemo: false, isSystemAdmin: false });
    const other: FakeUser = { ...(await adminWith('x')), id: 'other', email: 'ops@example.org', isDemo: false, isSystemAdmin: true };
    const prisma = new FakePrisma([admin, other]);

    const result = await ensureSystemAdministrator({ prisma, bcrypt, env: {}, log: silentLog() });

    expect(result).toBe('kept-without-flag');
    expect(admin.isSystemAdmin).toBe(false);
    expect(other.isSystemAdmin).toBe(true);
  });

  it('a demo account holding a stale flag does not block enabling the real one', async () => {
    const admin = await adminWith(PUBLIC_DEFAULT_PASSWORD);
    const demo: FakeUser = { ...(await adminWith('x')), id: 'demo', email: 'demo@agridemo.com', isDemo: true, isSystemAdmin: true };
    const prisma = new FakePrisma([admin, demo]);

    const result = await ensureSystemAdministrator({
      prisma, bcrypt, env: { [INITIAL_PASSWORD_ENV]: PRIVATE_PASSWORD }, log: silentLog(),
    });

    expect(result).toBe('enabled');
    expect(admin.isSystemAdmin).toBe(true);
  });

  it('reports a missing account without failing the seed', async () => {
    const result = await ensureSystemAdministrator({ prisma: new FakePrisma([]), bcrypt, env: {}, log: silentLog() });
    expect(result).toBe('missing');
  });
});
