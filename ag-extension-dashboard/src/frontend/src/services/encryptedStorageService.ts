/**
 * Client-Side Encrypted Storage Service (AES-256-GCM / Web Crypto API)
 * Protects offline farmer PII, GPS coordinates, and cached records if a field smartphone is stolen.
 */

export class EncryptedStorageService {
  private static masterKey: CryptoKey | null = null;

  /**
   * Initializes or derives a persistent cryptographic key from a device PIN / user session.
   */
  static async deriveKeyFromSecret(secret: string, salt = 'ag_ext_salt_2026'): Promise<CryptoKey> {
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
        salt: encoder.encode(salt),
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
