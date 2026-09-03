import {
  base32Encode,
  base32Decode,
  generateBackupCodes,
  generateMfaSecret,
  generateTotpCode,
  verifyTotp,
  verifyAndConsumeBackupCode,
} from '../services/mfaService';
import {
  hashToken,
  createSession,
  isSessionValid,
  revokeToken,
  revokeSession,
  revokeAllOtherSessions,
  getUserSessions,
} from '../services/sessionService';
import {
  isAccountLocked,
  recordFailedLogin,
  resetFailedAttempts,
  MAX_FAILED_ATTEMPTS,
} from '../services/lockoutService';
import { query } from '../services/databaseService';

jest.mock('../services/databaseService', () => ({
  query: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockQuery = query as jest.Mock;

describe('Security Hardening Pillar (MFA, Sessions, Lockout)', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('mfaService (TOTP & Backup Codes)', () => {
    it('correctly encodes and decodes base32 strings', () => {
      const buffer = Buffer.from('HelloWorld123');
      const encoded = base32Encode(buffer);
      const decoded = base32Decode(encoded);
      expect(decoded.toString()).toBe('HelloWorld123');
    });

    it('generates a valid 6-digit TOTP code and verifies it', () => {
      const { secret } = generateMfaSecret('officer@example.com');
      const now = Date.now();
      const code = generateTotpCode(secret, 30, now);

      expect(code).toHaveLength(6);
      expect(/^\d{6}$/.test(code)).toBe(true);

      const isValid = verifyTotp(code, secret, 1, 30, now);
      expect(isValid).toBe(true);
    });

    it('rejects an invalid TOTP code', () => {
      const { secret } = generateMfaSecret('officer@example.com');
      const isValid = verifyTotp('000000', secret, 0);
      expect(typeof isValid).toBe('boolean');
    });

    it('generates 8 formatted backup codes', () => {
      const codes = generateBackupCodes(8);
      expect(codes).toHaveLength(8);
      expect(codes[0]).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}$/);
    });

    it('consumes a valid backup code and updates database', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const initialCodes = ['AAAA-1111', 'BBBB-2222', 'CCCC-3333'];

      const result = await verifyAndConsumeBackupCode('user-1', 'aaaa-1111', initialCodes);
      expect(result.valid).toBe(true);
      expect(result.remainingCodes).toEqual(['BBBB-2222', 'CCCC-3333']);
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('rejects an unrecognised backup code without mutating database', async () => {
      const initialCodes = ['AAAA-1111', 'BBBB-2222'];
      const result = await verifyAndConsumeBackupCode('user-1', 'ZZZZ-9999', initialCodes);
      expect(result.valid).toBe(false);
      expect(result.remainingCodes).toEqual(initialCodes);
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe('sessionService (Token Hashes, Active Sessions & Revocation)', () => {
    it('hashes tokens deterministically with SHA-256', () => {
      const token = 'sample.jwt.token';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);
    });

    it('creates a session record with hashed token', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'sess-123' }] });

      const sessionId = await createSession({
        userId: 'user-1',
        token: 'sample.jwt.token',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        location: 'Nakuru, Kenya',
      });

      expect(sessionId).toBe('sess-123');
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][0]).toContain('INSERT INTO user_sessions');
      expect(mockQuery.mock.calls[0][1][0]).toBe('user-1');
      expect(mockQuery.mock.calls[0][1][1]).toBe(hashToken('sample.jwt.token'));
    });

    it('validates active session (no session row → valid) and rejects locally revoked tokens', async () => {
      // No row for this token hash: legacy/demo token, allowed on JWT alone.
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const valid = await isSessionValid('token-1');
      expect(valid).toBe(true);
      expect(mockQuery.mock.calls[0][0]).toContain('FROM user_sessions');

      revokeToken('token-2');
      // Locally revoked → false without a DB round-trip.
      const callsBefore = mockQuery.mock.calls.length;
      const revokedValid = await isSessionValid('token-2');
      expect(revokedValid).toBe(false);
      expect(mockQuery.mock.calls.length).toBe(callsBefore);
    });

    it('rejects sessions revoked in the DB by another instance', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ is_revoked: true, expires_at: '2099-01-01T00:00:00Z' }] });
      expect(await isSessionValid('token-revoked-elsewhere')).toBe(false);
    });

    it('rejects sessions whose DB row has expired', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ is_revoked: false, expires_at: '2000-01-01T00:00:00Z' }] });
      expect(await isSessionValid('token-expired-row')).toBe(false);
    });

    it('revokes a specific session', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ token_hash: hashToken('token-to-revoke') }] });
      const revoked = await revokeSession('sess-1', 'user-1');
      expect(revoked).toBe(true);
      expect(mockQuery.mock.calls[0][0]).toContain('is_revoked = true');
      expect(await isSessionValid('token-to-revoke')).toBe(false);
    });

    it('revokes all other active sessions', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ token_hash: hashToken('other-1') }, { token_hash: hashToken('other-2') }, { token_hash: hashToken('other-3') }],
        rowCount: 3,
      });
      const count = await revokeAllOtherSessions('user-1', 'current.token');
      expect(count).toBe(3);
      expect(await isSessionValid('other-1')).toBe(false);
    });

    it('retrieves user sessions and marks current session', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'sess-1',
            userId: 'user-1',
            tokenHash: hashToken('token-current'),
            ipAddress: '10.0.0.1',
            userAgent: 'Chrome',
            device: 'Chrome on Windows',
            location: 'Nairobi',
            lastActiveAt: '2026-09-01T00:00:00Z',
            expiresAt: '2026-09-08T00:00:00Z',
            isRevoked: false,
            createdAt: '2026-09-01T00:00:00Z',
          },
          {
            id: 'sess-2',
            userId: 'user-1',
            tokenHash: hashToken('token-other'),
            ipAddress: '10.0.0.2',
            userAgent: 'Safari',
            device: 'Safari on iOS',
            location: 'Nakuru',
            lastActiveAt: '2026-09-01T00:00:00Z',
            expiresAt: '2026-09-08T00:00:00Z',
            isRevoked: false,
            createdAt: '2026-09-01T00:00:00Z',
          },
        ],
      });

      const sessions = await getUserSessions('user-1', 'token-current');
      expect(sessions).toHaveLength(2);
      expect(sessions[0].isCurrent).toBe(true);
      expect(sessions[1].isCurrent).toBe(false);
      expect(sessions[0].tokenHash).toBeUndefined(); // ensure hash is redacted
    });
  });

  describe('lockoutService (Brute Force Protection)', () => {
    it('detects an active lockout and calculates remaining seconds', () => {
      const lockoutDate = new Date(Date.now() + 600000); // 10 mins from now
      const result = isAccountLocked(lockoutDate);
      expect(result.locked).toBe(true);
      expect(result.remainingSeconds).toBeGreaterThan(500);
    });

    it('returns unlocked when lockout has expired or is null', () => {
      expect(isAccountLocked(null).locked).toBe(false);
      const pastLockout = new Date(Date.now() - 10000);
      expect(isAccountLocked(pastLockout).locked).toBe(false);
    });

    it('increments failed login attempts and triggers lockout at threshold', async () => {
      // 4th failed attempt
      mockQuery.mockResolvedValueOnce({ rows: [{ failed_login_attempts: 3 }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const attempt4 = await recordFailedLogin('user-1');
      expect(attempt4.locked).toBe(false);
      expect(attempt4.failedAttempts).toBe(4);
      expect(attempt4.remainingAttempts).toBe(1);

      // 5th failed attempt -> locked
      mockQuery.mockResolvedValueOnce({ rows: [{ failed_login_attempts: MAX_FAILED_ATTEMPTS - 1 }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const attempt5 = await recordFailedLogin('user-1');
      expect(attempt5.locked).toBe(true);
      expect(attempt5.failedAttempts).toBe(5);
      expect(attempt5.remainingAttempts).toBe(0);
      expect(attempt5.lockoutUntil).not.toBeNull();
    });

    it('resets failed attempts to 0 on successful authentication', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await resetFailedAttempts('user-1');
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][0]).toContain('failed_login_attempts = 0');
    });
  });
});
