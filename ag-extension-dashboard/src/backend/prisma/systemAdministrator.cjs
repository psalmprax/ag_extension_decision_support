'use strict';

/**
 * The production system administrator: admin@agridemo.com (owner's decision).
 *
 * The seeds used to give this account the password "password123" and reset it on
 * every deploy. The repository is public, so that password is public. A system
 * administrator outranks every tenant admin, so this module only enables the
 * account once its password is private:
 *
 *   - If the account still has the public default and SYSTEM_ADMIN_INITIAL_PASSWORD
 *     is set in the server .env (at least 12 characters), the initial password is
 *     set from it, once. Existing sessions are revoked.
 *   - If the password is private (set from the env var, or changed in the app or by
 *     the reset-admin workflow), the account becomes a real (non-demo) account and
 *     holds the system-admin flag — unless a system administrator was deliberately
 *     moved to another real account, which is never undone.
 *   - If it still has the public default and no valid env var: the account is kept
 *     read-only (demo) and never holds the flag. Nothing is enabled by a public
 *     password.
 *
 * The password is never logged. Later runs never touch a private password, so the
 * owner can change it in the app at any time.
 */

const SYSTEM_ADMIN_EMAIL = 'admin@agridemo.com';
/** Published in this public repository by the old seeds; never left on a real admin. */
const PUBLIC_DEFAULT_PASSWORD = 'password123';
const INITIAL_PASSWORD_ENV = 'SYSTEM_ADMIN_INITIAL_PASSWORD';
const MIN_INITIAL_PASSWORD_LENGTH = 12;
const BCRYPT_ROUNDS = 12;

/** The env value if usable, otherwise null (with the reason logged, never the value). */
function readInitialPassword(env, log) {
  const value = env[INITIAL_PASSWORD_ENV];
  if (typeof value !== 'string' || value.trim() === '') return null;
  if (value.length < MIN_INITIAL_PASSWORD_LENGTH) {
    log.error(
      `${INITIAL_PASSWORD_ENV} is set but shorter than ${MIN_INITIAL_PASSWORD_LENGTH} characters; it was ignored.`
    );
    return null;
  }
  if (value === PUBLIC_DEFAULT_PASSWORD) {
    log.error(`${INITIAL_PASSWORD_ENV} must not be the public default password; it was ignored.`);
    return null;
  }
  return value;
}

/**
 * @param {{ prisma: any, bcrypt: { compare: Function, hash: Function }, env?: Record<string, string | undefined>, log?: Pick<Console, 'info' | 'warn' | 'error'> }} deps
 * @returns {Promise<'missing' | 'needs-password' | 'enabled' | 'kept-without-flag'>}
 */
async function ensureSystemAdministrator({ prisma, bcrypt, env = process.env, log = console }) {
  const account = await prisma.user.findUnique({
    where: { email: SYSTEM_ADMIN_EMAIL },
    select: { id: true, passwordHash: true, isDemo: true, isSystemAdmin: true },
  });
  if (!account) {
    log.warn(`System administrator ${SYSTEM_ADMIN_EMAIL} does not exist yet; nothing to enable.`);
    return 'missing';
  }

  const onPublicDefault = await bcrypt.compare(PUBLIC_DEFAULT_PASSWORD, account.passwordHash);
  const initialPassword = onPublicDefault ? readInitialPassword(env, log) : null;

  if (onPublicDefault && !initialPassword) {
    if (!account.isDemo || account.isSystemAdmin) {
      await prisma.user.update({ where: { id: account.id }, data: { isDemo: true, isSystemAdmin: false } });
    }
    log.error(
      `System administrator NOT enabled: ${SYSTEM_ADMIN_EMAIL} still has the public default password, ` +
        `so it stays read-only. Set ${INITIAL_PASSWORD_ENV} (at least ${MIN_INITIAL_PASSWORD_LENGTH} characters) ` +
        'in the server .env and redeploy.'
    );
    return 'needs-password';
  }

  const data = { isDemo: false };
  if (initialPassword) {
    data.passwordHash = await bcrypt.hash(initialPassword, BCRYPT_ROUNDS);
  }

  // Never undo a deliberate move of the flag to another real account.
  const otherSystemAdmins = await prisma.user.count({
    where: { isSystemAdmin: true, isDemo: false, id: { not: account.id } },
  });
  const holdsFlag = account.isSystemAdmin || otherSystemAdmins === 0;
  data.isSystemAdmin = holdsFlag;

  await prisma.user.update({ where: { id: account.id }, data });

  if (initialPassword) {
    // Anyone signed in with the public password must sign in again.
    await prisma.userSession.updateMany({ where: { userId: account.id, isRevoked: false }, data: { isRevoked: true } });
    log.info(
      `System administrator ${SYSTEM_ADMIN_EMAIL}: initial password set from ${INITIAL_PASSWORD_ENV}. ` +
        'Change it after signing in; later deploys never reset it.'
    );
  }

  if (!holdsFlag) {
    log.warn(`${SYSTEM_ADMIN_EMAIL} is a real admin, but another account holds the system-admin flag; left as is.`);
    return 'kept-without-flag';
  }
  log.info(`System administrator ${SYSTEM_ADMIN_EMAIL} is enabled.`);
  return 'enabled';
}

module.exports = {
  SYSTEM_ADMIN_EMAIL,
  PUBLIC_DEFAULT_PASSWORD,
  INITIAL_PASSWORD_ENV,
  MIN_INITIAL_PASSWORD_LENGTH,
  ensureSystemAdministrator,
};
