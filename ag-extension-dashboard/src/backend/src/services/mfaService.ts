import crypto from 'crypto';
import { query } from './databaseService';
import { logger } from '../utils/logger';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// fallow-ignore-next-line unused-export
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

// fallow-ignore-next-line unused-export
export function base32Decode(input: string): Buffer {
  const cleanInput = input.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleanInput.length; i++) {
    const index = BASE32_ALPHABET.indexOf(cleanInput[i]);
    if (index === -1) continue;

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

// fallow-ignore-next-line unused-export
export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  return codes;
}

export function generateMfaSecret(
  email: string,
  issuer: string = 'AgriExtension'
): { secret: string; otpauthUrl: string; backupCodes: string[] } {
  const randomBytes = crypto.randomBytes(20);
  const secret = base32Encode(randomBytes);
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedEmail = encodeURIComponent(email);
  const otpauthUrl = `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
  const backupCodes = generateBackupCodes(8);

  return { secret, otpauthUrl, backupCodes };
}

// fallow-ignore-next-line unused-export
export function generateTotpCode(secret: string, timeStep: number = 30, timestampMs: number = Date.now()): string {
  const key = base32Decode(secret);
  const counter = Math.floor(timestampMs / 1000 / timeStep);

  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key);
  hmac.update(counterBuffer);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0xf;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Returns the 30-second time-step that the token matched, or null.
 * Callers persist the step (users.last_totp_step) and reject any token whose step
 * is <= the stored one, so an intercepted code cannot be replayed inside its window.
 */
export function matchTotpStep(
  token: string,
  secret: string,
  window: number = 1,
  timeStep: number = 30,
  currentTimestampMs: number = Date.now()
): number | null {
  if (!token || !secret) return null;
  const cleanToken = token.trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanToken)) return null;

  for (let offset = -window; offset <= window; offset++) {
    const timestampToCheck = currentTimestampMs + offset * timeStep * 1000;
    const expected = generateTotpCode(secret, timeStep, timestampToCheck);
    const a = Buffer.from(expected);
    const b = Buffer.from(cleanToken);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return Math.floor(timestampToCheck / (timeStep * 1000));
    }
  }
  return null;
}

export function verifyTotp(
  token: string,
  secret: string,
  window: number = 1,
  timeStep: number = 30,
  currentTimestampMs: number = Date.now()
): boolean {
  if (!token || !secret) return false;
  const cleanToken = token.trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanToken)) return false;

  for (let offset = -window; offset <= window; offset++) {
    const timestampToCheck = currentTimestampMs + offset * timeStep * 1000;
    const generatedCode = generateTotpCode(secret, timeStep, timestampToCheck);

    if (crypto.timingSafeEqual(Buffer.from(cleanToken), Buffer.from(generatedCode))) {
      return true;
    }
  }

  return false;
}

const HASH_PREFIX = 'sha256:';

function normalizeBackupCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** One-way hash used for at-rest storage of backup codes. */
export function hashBackupCode(code: string): string {
  return HASH_PREFIX + crypto.createHash('sha256').update(normalizeBackupCode(code)).digest('hex');
}

/** Hash a freshly generated set of backup codes for storage. */
export function hashBackupCodes(codes: string[]): string[] {
  return codes.map(hashBackupCode);
}

function backupCodeMatches(stored: string, candidateNormalized: string): boolean {
  if (stored.startsWith(HASH_PREFIX)) {
    const expected = Buffer.from(stored.slice(HASH_PREFIX.length), 'hex');
    const actual = crypto.createHash('sha256').update(candidateNormalized).digest();
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }
  // Legacy plaintext rows (pre-hashing). Constant-time compare on normalized form.
  const a = Buffer.from(normalizeBackupCode(stored));
  const b = Buffer.from(candidateNormalized);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function verifyAndConsumeBackupCode(
  userId: string,
  candidateCode: string,
  storedBackupCodes: string[]
): Promise<{ valid: boolean; remainingCodes: string[] }> {
  const normalizedCandidate = normalizeBackupCode(candidateCode);
  if (!normalizedCandidate) return { valid: false, remainingCodes: storedBackupCodes };

  // Evaluate every entry (no early exit) to keep timing uniform across positions.
  let matchedIndex = -1;
  storedBackupCodes.forEach((code, idx) => {
    if (backupCodeMatches(code, normalizedCandidate) && matchedIndex === -1) matchedIndex = idx;
  });

  if (matchedIndex === -1) {
    return { valid: false, remainingCodes: storedBackupCodes };
  }

  const remainingCodes = storedBackupCodes.filter((_, idx) => idx !== matchedIndex);

  try {
    await query(
      `
      UPDATE users
      SET mfa_backup_codes = $1
      WHERE id = $2
    `,
      [remainingCodes, userId]
    );
  } catch (error) {
    logger.error('Failed to consume backup code:', error);
  }

  return { valid: true, remainingCodes };
}
