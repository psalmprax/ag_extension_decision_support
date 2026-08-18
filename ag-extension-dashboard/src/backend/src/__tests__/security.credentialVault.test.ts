import { credentialVault } from '@/services/security/credentialVault';

describe('Cybersecurity Suite — CredentialVault AES-256-GCM Encryption & Key Lifecycle', () => {
  const testCategory = 'test_api_keys';
  const testName = 'weather_service_token';
  const secretValue = 'sec_token_9f823a7b4c91d8e20f';

  afterEach(() => {
    credentialVault.revokeCredential(testName, testCategory);
    credentialVault.revokeCredential('rotated_key', testCategory);
    credentialVault.revokeCredential('expiring_key', testCategory);
  });

  describe('1. Authenticated Encryption & Decryption (AES-256-GCM)', () => {
    it('should securely encrypt and store credentials, and decrypt accurately', () => {
      const id = credentialVault.storeCredential(testName, testCategory, secretValue, 30);
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');

      const retrieved = credentialVault.getCredential(testName, testCategory);
      expect(retrieved).toBe(secretValue);
    });

    it('should not store credentials in plaintext', () => {
      credentialVault.storeCredential(testName, testCategory, secretValue, 30);
      const summary = credentialVault.getAllCredentialsSummary();
      const stored = summary.find((s) => s.name === testName && s.category === testCategory);

      expect(stored).toBeDefined();
      // Verify raw value is not exposed in public summary
      expect(JSON.stringify(stored)).not.toContain(secretValue);
    });
  });

  describe('2. Credential Rotation & Revocation', () => {
    it('should rotate existing credentials and return the new decrypted value', () => {
      credentialVault.storeCredential('rotated_key', testCategory, 'initial_secret_123', 60);
      expect(credentialVault.getCredential('rotated_key', testCategory)).toBe('initial_secret_123');

      const rotated = credentialVault.rotateCredential('rotated_key', testCategory, 'new_rotated_secret_456');
      expect(rotated).toBe(true);

      expect(credentialVault.getCredential('rotated_key', testCategory)).toBe('new_rotated_secret_456');
    });

    it('should fail rotation gracefully if credential does not exist', () => {
      const result = credentialVault.rotateCredential('non_existent_key', testCategory, 'dummy_val');
      expect(result).toBe(false);
    });

    it('should revoke credentials and return null on subsequent access', () => {
      credentialVault.storeCredential(testName, testCategory, secretValue, 30);
      expect(credentialVault.getCredential(testName, testCategory)).toBe(secretValue);

      const revoked = credentialVault.revokeCredential(testName, testCategory);
      expect(revoked).toBe(true);

      const postRevoke = credentialVault.getCredential(testName, testCategory);
      expect(postRevoke).toBeNull();
    });
  });

  describe('3. Expiration Tracking & Access Auditing', () => {
    it('should identify credentials nearing expiration within threshold', () => {
      // Store a credential with 3-day rotation (within 7-day threshold)
      credentialVault.storeCredential('expiring_key', testCategory, 'short_lived_token', 3);

      const expiring = credentialVault.getExpiringCredentials(7);
      expect(expiring.some((c) => c.name === 'expiring_key')).toBe(true);
    });

    it('should maintain an access audit log with timestamps and caller records', () => {
      credentialVault.storeCredential(testName, testCategory, secretValue, 30);

      // Access twice
      credentialVault.getCredential(testName, testCategory);
      credentialVault.getCredential(testName, testCategory);

      const targetId = `${testCategory}:${testName}`.toLowerCase().replace(/[^a-z0-9:]/g, '_');
      const logs = credentialVault.getAccessLog(targetId);

      expect(logs.length).toBeGreaterThanOrEqual(2);
      expect(logs[0].accessor).toBe('system');
      expect(logs[0].accessedAt).toBeDefined();
    });
  });
});
