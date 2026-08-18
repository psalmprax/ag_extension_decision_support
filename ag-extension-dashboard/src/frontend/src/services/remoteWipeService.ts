import { EncryptedStorageService } from './encryptedStorageService';

export interface WipeExecutionReport {
  timestamp: string;
  clearedLocalStorage: boolean;
  clearedSessionStorage: boolean;
  zeroizedCryptographicKeys: boolean;
  purgedDatabases: string[];
  success: boolean;
}

export interface WipeSignalPayload {
  error?: string;
  wipeSignal?: boolean;
  [key: string]: unknown;
}

/**
 * Remote Wipe & Device Loss Protocol
 * Responds to admin revocation signals to instantly purge all offline databases,
 * cached farmer PII, encrypted blobs, and authentication credentials from a lost/stolen field smartphone.
 */
export class RemoteWipeService {
  private static readonly KNOWN_DATABASES = [
    'ag-extension-db',
    'ag-offline-sync-queue',
    'ag-crop-photos-cache',
    'ag-farmer-registry',
  ];

  /**
   * Executes a full, irrecoverable wipe of all local client state and caches.
   */
  static async executeRemoteWipe(): Promise<WipeExecutionReport> {
    const report: WipeExecutionReport = {
      timestamp: new Date().toISOString(),
      clearedLocalStorage: false,
      clearedSessionStorage: false,
      zeroizedCryptographicKeys: false,
      purgedDatabases: [],
      success: false,
    };

    try {
      // 1. Zero out crypto keys in memory
      EncryptedStorageService.zeroizeKey();
      report.zeroizedCryptographicKeys = true;

      // 2. Clear web storage
      if (typeof window !== 'undefined') {
        localStorage.clear();
        report.clearedLocalStorage = true;

        sessionStorage.clear();
        report.clearedSessionStorage = true;
      }

      // 3. Delete IndexedDB databases
      if (typeof window !== 'undefined' && window.indexedDB && window.indexedDB.deleteDatabase) {
        for (const dbName of this.KNOWN_DATABASES) {
          try {
            window.indexedDB.deleteDatabase(dbName);
            report.purgedDatabases.push(dbName);
          } catch {
            // Best effort deletion
          }
        }
      }

      report.success = true;
    } catch {
      report.success = false;
    }

    return report;
  }

  /**
   * Evaluates an incoming API response or heartbeat signal to trigger remote wipe if commanded.
   */
  static async evaluateSignal(responsePayload: WipeSignalPayload | null, statusCode?: number): Promise<boolean> {
    if (
      statusCode === 403 &&
      (responsePayload?.error === 'ACCOUNT_REVOKED_WIPE_DEVICE' || responsePayload?.wipeSignal === true)
    ) {
      await this.executeRemoteWipe();
      return true;
    }
    return false;
  }
}
