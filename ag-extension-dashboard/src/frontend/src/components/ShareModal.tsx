import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Share2, 
  Link, 
  Copy, 
  Check, 
  Clock, 
  Shield, 
  Globe,
  Users,
  Calendar,
  AlertCircle,
  ExternalLink,
  RefreshCcw
} from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { createShare, ShareResponse } from '@/api/shareService';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
  entityName?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({ 
  isOpen, 
  onClose, 
  entityType, 
  entityId,
  entityName 
}) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [shareData, setShareData] = useState<ShareResponse['data'] | null>(null);
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState({
    accessType: 'restricted', // public, restricted, organization
    expiresIn: '7', // days
    allowExport: true
  });

  useEffect(() => {
    if (isOpen) {
      setShareData(null);
      setCopied(false);
    }
  }, [isOpen]);

  const handleCreateShare = async () => {
    setLoading(true);
    try {
      const result = await createShare({
        entityType,
        entityId,
        accessType: settings.accessType,
        expiresInDays: parseInt(settings.expiresIn),
        permissions: {
          canView: true,
          canExport: settings.allowExport
        }
      });
      if (result.success && result.data) {
        setShareData(result.data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (shareData?.shareUrl) {
      navigator.clipboard.writeText(shareData.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center">
                <Share2 className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                  Share {entityType}
                </h2>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {entityName || `Entity ID: ${entityId}`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-8">
          {!shareData ? (
            <div className="space-y-6">
              {/* Access Settings */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Access Level</label>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: 'restricted', label: 'Restricted', desc: 'Only specified users can access', icon: Shield },
                    { id: 'organization', label: 'Organization', desc: 'Anyone in your org with the link', icon: Users },
                    { id: 'public', label: 'Public', desc: 'Anyone with the link can view', icon: Globe },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setSettings({ ...settings, accessType: option.id })}
                      className={`flex items-start gap-4 p-4 rounded-2xl border transition-all text-left ${
                        settings.accessType === option.id
                          ? 'bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800 ring-2 ring-primary-500/20'
                          : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
                      }`}
                    >
                      <option.icon className={`w-5 h-5 mt-0.5 ${settings.accessType === option.id ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`} />
                      <div>
                        <p className={`text-sm font-bold ${settings.accessType === option.id ? 'text-primary-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                          {option.label}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{option.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Expiration Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> Expiration
                  </label>
                  <select
                    value={settings.expiresIn}
                    onChange={(e) => setSettings({ ...settings, expiresIn: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500/20"
                  >
                    <option value="1">24 Hours</option>
                    <option value="7">7 Days</option>
                    <option value="30">30 Days</option>
                    <option value="0">Never</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" /> Permissions
                  </label>
                  <button
                    onClick={() => setSettings({ ...settings, allowExport: !settings.allowExport })}
                    className={`w-full px-4 py-3 rounded-xl border text-sm font-bold transition-all ${
                      settings.allowExport
                        ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-800 text-gray-400'
                    }`}
                  >
                    Allow Export
                  </button>
                </div>
              </div>

              <button
                onClick={handleCreateShare}
                disabled={loading}
                className="w-full py-4 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-black rounded-2xl shadow-xl shadow-primary-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <RefreshCcw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Link className="w-5 h-5" />
                    GENERATE SECURE LINK
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-6 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-3xl text-center">
                <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                  <Check className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-emerald-900 dark:text-emerald-400 uppercase italic">Link Ready!</h3>
                <p className="text-sm text-emerald-700 dark:text-emerald-500 mt-1">This link is encrypted and active.</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Shareable URL</label>
                <div className="relative">
                  <input
                    readOnly
                    value={shareData.shareUrl}
                    className="w-full px-4 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 text-sm font-mono pr-12 focus:outline-none"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-all"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-800 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-500 leading-relaxed font-medium">
                  This link will expire on <strong>{new Date(shareData.expiresAt || '').toLocaleDateString()}</strong>. 
                  Access is logged for security auditing.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShareData(null)}
                  className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-2xl transition-all"
                >
                  Regenerate
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-4 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-2xl shadow-lg shadow-primary-500/10 transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
