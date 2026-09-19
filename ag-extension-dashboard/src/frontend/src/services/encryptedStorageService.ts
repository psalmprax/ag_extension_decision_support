/**
 * Client-Side Encrypted Storage Service (AES-256-GCM / Web Crypto API)
 * Protects offline farmer PII, GPS coordinates, and cached records if a field smartphone is stolen.
 */

export class EncryptedStorageService {
  private static masterKey: CryptoKey | null = null;

  /**
   * Retrieves or provisions a cryptographically random device-bound salt to prevent
   * precomputed rainbow table attacks against field officer PINs.
   */
  static getOrCreateDeviceSalt(): string {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        let salt = window.localStorage.getItem('ag_ext_device_salt');
        if (!salt) {
          const randomBytes = crypto.getRandomValues(new Uint8Array(16));
          salt = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
          window.localStorage.setItem('ag_ext_device_salt', salt);
        }
        return salt;
      }
    } catch {
      // Best effort fallback if storage is restricted
    }
    // Storage-restricted devices: derive a device-scoped fallback salt from
    // the UA/platform instead of a single hardcoded constant shared by every
    // device (a constant salt adds zero entropy to the PBKDF2 stretch).
    const scope = typeof navigator !== 'undefined'
      ? `${navigator.userAgent}|${navigator.platform || ''}`
      : 'no-navigator';
    let hash = 2166136261;
    for (let i = 0; i < scope.length; i++) {
      hash ^= scope.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `fallback_${(hash >>> 0).toString(16)}`;
  }

  /**
   * Initializes or derives a persistent cryptographic key from a device PIN / user session.
   */
  static async deriveKeyFromSecret(secret: string, salt?: string): Promise<CryptoKey> {
    const effectiveSalt = salt || this.getOrCreateDeviceSalt();
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(effectiveSalt),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    this.masterKey = derivedKey;
    return derivedKey;
  }

  /**
   * Encrypts a plaintext payload using AES-GCM 256 with a unique random IV.
   */
  static async encrypt(plainText: string, key?: CryptoKey): Promise<string> {
    const activeKey = key || this.masterKey;
    if (!activeKey) {
      throw new Error('EncryptedStorage: Master key not initialized');
    }

    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
    const encoded = encoder.encode(plainText);

    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      activeKey,
      encoded
    );

    const ivHex = Array.from(iv).map((b) => b.toString(16).padStart(2, '0')).join('');
    const cipherHex = Array.from(new Uint8Array(cipherBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return `${ivHex}:${cipherHex}`;
  }

  /**
   * Decrypts an AES-GCM ciphertext string with authentication tag verification.
   */
  static async decrypt(encryptedPayload: string, key?: CryptoKey): Promise<string> {
    const activeKey = key || this.masterKey;
    if (!activeKey) {
      throw new Error('EncryptedStorage: Master key not initialized');
    }

    const parts = encryptedPayload.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted payload format');
    }

    const ivBytes = new Uint8Array(
      parts[0].match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );
    const cipherBytes = new Uint8Array(
      parts[1].match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      activeKey,
      cipherBytes
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  }

  /**
   * Clears key material in memory during session destruction or device wipe.
   */
  static zeroizeKey(): void {
    this.masterKey = null;
  }
}
