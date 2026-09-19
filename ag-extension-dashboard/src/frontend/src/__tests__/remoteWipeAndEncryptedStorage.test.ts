import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EncryptedStorageService } from '../services/encryptedStorageService';
import { RemoteWipeService } from '../services/remoteWipeService';

describe('Deep-Tier Stolen Device Security — Client AES-256-GCM & Remote Wipe Protocol', () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    EncryptedStorageService.zeroizeKey();
  });

  describe('1. Web Crypto AES-256-GCM Encryption', () => {
    it('should encrypt sensitive farmer PII and decrypt accurately with the derived key', async () => {
      const pinSecret = '9876_officer_pin';
      await EncryptedStorageService.deriveKeyFromSecret(pinSecret);

      const farmerPii = JSON.stringify({
        nationalId: 'ID_987654321',
        gpsLocation: { lat: -1.286389, lng: 36.817223 },
        farmYieldKg: 4500,
      });

      const encrypted = await EncryptedStorageService.encrypt(farmerPii);

      // Verify format is IV:Ciphertext
      expect(encrypted).toContain(':');
      expect(encrypted).not.toContain('ID_987654321');

      const decrypted = await EncryptedStorageService.decrypt(encrypted);
      expect(decrypted).toBe(farmerPii);
    });

    it('should reject decryption when cryptographic key is zeroized', async () => {
      await EncryptedStorageService.deriveKeyFromSecret('some_pin');
      const cipher = await EncryptedStorageService.encrypt('sensitive data');

      EncryptedStorageService.zeroizeKey();

      await expect(EncryptedStorageService.decrypt(cipher)).rejects.toThrow(
        /Master key not initialized/
      );
    });
  });

  describe('2. Remote Device Wipe Protocol', () => {
    it('removes private API responses left by previous service workers', async () => {
      const remove = vi.fn().mockResolvedValue(true);
      vi.stubGlobal('caches', { delete: remove });
      const result = await RemoteWipeService.executeRemoteWipe();
      expect(remove).toHaveBeenCalledWith('api-cache');
      expect(result.success).toBe(true);
    });

    it('continues deleting databases but reports failure if private cache removal fails', async () => {
      const deleteDatabase = vi.fn();
      vi.stubGlobal('indexedDB', { deleteDatabase });
      vi.stubGlobal('caches', { delete: vi.fn().mockRejectedValue(new Error('Cache unavailable')) });
      const result = await RemoteWipeService.executeRemoteWipe();
      expect(result.success).toBe(false);
      expect(deleteDatabase.mock.calls.map(([name]) => name)).toEqual([
        'ag-extension-db',
        'ag-offline-sync-queue',
        'ag-crop-photos-cache',
        'ag-farmer-registry',
      ]);
    });

    it('should execute full local wipe and key zeroization upon remote wipe command', async () => {
      localStorage.setItem('auth_token', 'secret_token_123');
      localStorage.setItem('cached_farmers', JSON.stringify([{ name: 'Jane' }]));
      sessionStorage.setItem('active_session', 'sess_abc');

      const wipeReport = await RemoteWipeService.executeRemoteWipe();

      expect(wipeReport.success).toBe(true);
      expect(wipeReport.clearedLocalStorage).toBe(true);
      expect(wipeReport.clearedSessionStorage).toBe(true);
      expect(wipeReport.zeroizedCryptographicKeys).toBe(true);

      // Verify storage is completely empty
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('cached_farmers')).toBeNull();
      expect(sessionStorage.getItem('active_session')).toBeNull();
    });

    it('should trigger remote wipe automatically when evaluating a 403 revoke signal', async () => {
      localStorage.setItem('cached_farmers', JSON.stringify([{ name: 'Bob' }]));

      const triggered = await RemoteWipeService.evaluateSignal(
        { error: 'ACCOUNT_REVOKED_WIPE_DEVICE' },
        403
      );

      expect(triggered).toBe(true);
      expect(localStorage.getItem('cached_farmers')).toBeNull();
    });
  });
});
