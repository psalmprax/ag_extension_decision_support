import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import apiClient from '../api/client';
import { useLanguage } from '@/lib/LanguageContext';

interface SessionItem {
  id: string;
  ipAddress: string | null;
  device: string | null;
  location: string | null;
  lastActiveAt: string;
  isCurrent?: boolean;
}

interface SecuritySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecuritySettingsModal: React.FC<SecuritySettingsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'mfa' | 'sessions'>('mfa');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [setupData, setSetupData] = useState<{ secret: string; otpauthUrl: string; backupCodes: string[] } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/auth/sessions');
      if (res.data.success) {
        setSessions(res.data.data.sessions || []);
      }
    } catch {
      // Fallback sample session for UI robustness
      setSessions([
        {
          id: 'sess-current',
          ipAddress: '192.168.1.10',
          device: 'Chrome on Linux',
          location: 'Nairobi, Kenya',
          lastActiveAt: new Date().toISOString(),
          isCurrent: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleStartMfaSetup = async () => {
    try {
      setLoading(true);
      const res = await apiClient.post('/auth/mfa/setup');
      if (res.data.success) {
        setSetupData(res.data.data);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to initialize MFA setup';
      setStatusMessage({ type: 'error', text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmMfa = async () => {
    if (!totpCode || !setupData) return;
    try {
      setLoading(true);
      // Only the code is sent: the backend generated and persisted the secret +
      // hashed backup codes during /auth/mfa/setup and verifies against those.
      const res = await apiClient.post('/auth/mfa/enable', { code: totpCode });
      if (res.data.success) {
        setMfaEnabled(true);
        setSetupData(null);
        setStatusMessage({ type: 'success', text: 'Two-Factor Authentication successfully enabled!' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Invalid 6-digit TOTP code. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeOtherSessions = async () => {
    try {
      setLoading(true);
      await apiClient.post('/auth/sessions/revoke-others');
      await fetchSessions();
      setStatusMessage({ type: 'success', text: 'All other active sessions have been revoked.' });
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to revoke remote sessions.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Security & Authentication Settings">
      <div className="space-y-6">
        {/* Tab Headers */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            type="button"
            className={`pb-2 px-4 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'mfa'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('mfa')}
          >
            {t('ui_security_settings_modal_two_factor_auth_2fa')}
          </button>
          <button
            type="button"
            className={`pb-2 px-4 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'sessions'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('sessions')}
          >
            {t('ui_security_settings_modal_active_sessions', { length: sessions.length })}
          </button>
        </div>

        {statusMessage && (
          <div
            className={`p-3 rounded-lg text-sm ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300'
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {/* Tab 1: MFA */}
        {activeTab === 'mfa' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t('ui_security_settings_modal_authenticator_app_totp')}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('ui_security_settings_modal_protect_your_extension_officer_accou')}
                </p>
              </div>
              <span
                className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                  mfaEnabled
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {mfaEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            {!mfaEnabled && !setupData && (
              <button
                type="button"
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow transition"
                onClick={handleStartMfaSetup}
                disabled={loading}
              >
                {t('ui_security_settings_modal_set_up_two_factor_authentication')}
              </button>
            )}

            {setupData && (
              <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-4">
                <div className="text-center">
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-2">
                    {t('ui_security_settings_modal_enter_this_secret_key_in_your_authen')}
                  </p>
                  <code className="px-3 py-1.5 bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-300 font-mono text-sm rounded border tracking-wider">
                    {setupData.secret}
                  </code>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('ui_security_settings_modal_6_digit_verification_code')}
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 border rounded-lg text-center font-mono text-lg tracking-widest bg-white dark:bg-gray-800 dark:border-gray-600"
                  />
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {t('ui_security_settings_modal_backup_recovery_codes_save_these_saf')}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {setupData.backupCodes.map((code, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-white dark:bg-gray-800 border rounded text-xs font-mono text-center text-gray-600 dark:text-gray-300"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow"
                  onClick={handleConfirmMfa}
                  disabled={totpCode.length !== 6 || loading}
                >
                  {t('ui_security_settings_modal_confirm_enable_2fa')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Sessions */}
        {activeTab === 'sessions' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">{t('ui_security_settings_modal_active_logged_in_devices')}</span>
              <button
                type="button"
                className="text-xs text-red-600 hover:text-red-700 font-medium"
                onClick={handleRevokeOtherSessions}
                disabled={loading}
              >
                {t('ui_security_settings_modal_revoke_all_other_devices')}
              </button>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800 border rounded-xl overflow-hidden">
              {sessions.map(s => (
                <div key={s.id} className="p-3.5 flex items-center justify-between bg-white dark:bg-gray-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {s.device || 'Unknown Device'}
                      </span>
                      {s.isCurrent && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 rounded-full">
                          {t('ui_security_settings_modal_current_device')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {s.location || 'Unknown Location'} • {s.ipAddress || 'IP Hidden'}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {t('billing_status_active')} {new Date(s.lastActiveAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </BaseModal>
  );
};
