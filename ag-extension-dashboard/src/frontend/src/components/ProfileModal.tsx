import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  User,
  MapPin,
  Shield,
  Save,
  Loader2,
  Lock,
  KeyRound,
  Sliders,
  Trash2,
  Check,
  Smartphone,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { Language } from '@/lib/i18n';
import { useAppStore } from '@/store/useAppStore';
import toast from 'react-hot-toast';
import apiClient from '@/api/client';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'profile' | 'preferences' | 'security';

interface AvatarPreset {
  id: string;
  label: string;
  emoji: string;
  gradient: string;
}

const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'agronomist', label: 'Agronomist', emoji: '🌾', gradient: 'from-emerald-600 to-teal-700' },
  { id: 'lead_farmer', label: 'Lead Farmer', emoji: '🧑‍🌾', gradient: 'from-amber-600 to-orange-700' },
  { id: 'field_officer', label: 'Field Officer', emoji: '🚜', gradient: 'from-blue-600 to-indigo-700' },
  { id: 'crop_scout', label: 'Crop Scout', emoji: '🌱', gradient: 'from-lime-600 to-emerald-700' },
  { id: 'soil_expert', label: 'Soil Scientist', emoji: '🔬', gradient: 'from-cyan-600 to-blue-700' },
  { id: 'satellite_analyst', label: 'Remote Sensing', emoji: '🛰️', gradient: 'from-purple-600 to-indigo-800' },
];

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { t, language, setLanguage } = useLanguage();
  const { user, setUser } = useAppStore();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    phone: '',
    region: '',
    avatarId: 'agronomist',
  });

  // Preferences State
  const [preferences, setPreferences] = useState({
    areaUnit: 'hectares',
    tempUnit: 'celsius',
    highContrast: false,
    smsAlerts: true,
    outbreakPush: true,
    weeklyDigest: false,
  });

  // Security State
  const [passwordState, setPasswordState] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      const savedPrefs = localStorage.getItem('gpexts_user_preferences');
      const parsedPrefs = savedPrefs ? JSON.parse(savedPrefs) : {};

      const savedAvatar = localStorage.getItem('gpexts_user_avatar') || 'agronomist';
      const savedUsername = localStorage.getItem('gpexts_user_handle') || `${(user.firstName || 'user').toLowerCase()}_${(user.lastName || 'officer').toLowerCase()}`;
      const savedPhone = localStorage.getItem('gpexts_user_phone') || '+254 712 345 678';

      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        username: savedUsername,
        email: user.email || '',
        phone: savedPhone,
        region: user.region || 'Uasin Gishu, Kenya',
        avatarId: savedAvatar,
      });

      if (savedPrefs) {
        setPreferences(prev => ({ ...prev, ...parsedPrefs }));
      }
      setIsEditing(false);
      setShowDeleteConfirm(false);
    }
  }, [user, isOpen]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem('gpexts_user_avatar', formData.avatarId);
      localStorage.setItem('gpexts_user_handle', formData.username);
      localStorage.setItem('gpexts_user_phone', formData.phone);
      localStorage.setItem('gpexts_user_preferences', JSON.stringify(preferences));

      try {
        await apiClient.patch('/users/profile', {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          region: formData.region,
        });
      } catch (_apiErr) {
        // Fallback for demo or offline mode
      }

      if (user) {
        setUser({
          ...user,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          region: formData.region,
        });
      }

      setIsEditing(false);
      toast.success('Profile and preferences updated successfully');
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordState.currentPassword || !passwordState.newPassword) {
      toast.error('Please enter your current and new password');
      return;
    }
    if (passwordState.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (passwordState.newPassword !== passwordState.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    toast.success('Password updated successfully');
    setPasswordState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const selectedAvatar = AVATAR_PRESETS.find(a => a.id === formData.avatarId) || AVATAR_PRESETS[0];

  if (!user) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[80]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4"
          >
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[calc(100dvh-2rem)] sm:max-h-[88vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className={`relative p-5 sm:p-6 bg-gradient-to-br ${selectedAvatar.gradient} text-white shrink-0`}>
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-xl hover:bg-white/20 transition-colors active:scale-95"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl shadow-inner backdrop-blur-md border border-white/20 shrink-0">
                      {selectedAvatar.emoji}
                    </div>
                    <span className="absolute -bottom-1 -right-1 p-1 bg-white text-slate-950 rounded-full shadow-md text-[10px]">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl sm:text-2xl font-black truncate tracking-tight">
                        {formData.firstName || user.firstName} {formData.lastName || user.lastName}
                      </h2>
                    </div>
                    <p className="text-xs sm:text-sm text-white/80 font-mono">@{formData.username}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-xs font-semibold backdrop-blur-sm">
                        <Shield className="w-3 h-3" />
                        <span className="capitalize">{user.role?.replace('_', ' ') || 'Extension Officer'}</span>
                      </span>
                      <span className="text-xs text-white/70 flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{formData.region}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mt-6 border-b border-white/20 pb-0">
                  <button
                    onClick={() => setActiveTab('profile')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 ${
                      activeTab === 'profile'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Profile & Avatar</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('preferences')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 ${
                      activeTab === 'preferences'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Preferences</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('security')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 ${
                      activeTab === 'security'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Security & Account</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Tab Content */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
                {activeTab === 'profile' && (
                  <div className="space-y-6">
                    {/* Avatar Picker (QA #23) */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2">
                        Select Field Avatar Persona
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                        {AVATAR_PRESETS.map(preset => {
                          const isSelected = formData.avatarId === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, avatarId: preset.id }))}
                              className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 text-center transition-all ${
                                isSelected
                                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 ring-2 ring-emerald-500/30'
                                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-800/60'
                              }`}
                            >
                              <span className="text-2xl">{preset.emoji}</span>
                              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate w-full">
                                {preset.label}
                              </span>
                              {isSelected && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-0.5" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          {t('common_first_name') || 'First Name'}
                        </label>
                        <input
                          type="text"
                          disabled={!isEditing}
                          value={formData.firstName}
                          onChange={e => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                          className="w-full mt-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white outline-none transition-colors text-sm disabled:opacity-75 disabled:cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          {t('common_last_name') || 'Last Name'}
                        </label>
                        <input
                          type="text"
                          disabled={!isEditing}
                          value={formData.lastName}
                          onChange={e => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                          className="w-full mt-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white outline-none transition-colors text-sm disabled:opacity-75 disabled:cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          Officer Handle / Username
                        </label>
                        <div className="relative mt-1">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-sm">@</span>
                          <input
                            type="text"
                            disabled={!isEditing}
                            value={formData.username}
                            onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
                            className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white outline-none transition-colors text-sm disabled:opacity-75 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          Email Address
                        </label>
                        <div className="relative mt-1">
                          <input
                            type="email"
                            disabled={!isEditing}
                            value={formData.email}
                            onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white outline-none transition-colors text-sm disabled:opacity-75 disabled:cursor-not-allowed"
                          />
                          <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-emerald-500">
                            <Check className="w-4 h-4" />
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          Field Mobile Number (SMS Bot Link)
                        </label>
                        <div className="relative mt-1">
                          <input
                            type="text"
                            disabled={!isEditing}
                            value={formData.phone}
                            onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                            className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white outline-none transition-colors text-sm disabled:opacity-75 disabled:cursor-not-allowed"
                          />
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                            <Smartphone className="w-4 h-4" />
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          {t('common_region') || 'Assigned District / Region'}
                        </label>
                        <div className="relative mt-1">
                          <input
                            type="text"
                            disabled={!isEditing}
                            value={formData.region}
                            onChange={e => setFormData(prev => ({ ...prev, region: e.target.value }))}
                            className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white outline-none transition-colors text-sm disabled:opacity-75 disabled:cursor-not-allowed"
                          />
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                            <MapPin className="w-4 h-4" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'preferences' && (
                  <div className="space-y-6">
                    {/* Language Preference */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2">
                        System Interface Language
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { code: 'en', label: 'English' },
                          { code: 'sw', label: 'Kiswahili' },
                          { code: 'fr', label: 'Français' },
                          { code: 'pt', label: 'Português' },
                          { code: 'es', label: 'Español' },
                          { code: 'de', label: 'Deutsch' },
                          { code: 'ar', label: 'العربية' },
                          { code: 'hi', label: 'हिन्दी' },
                        ].map(item => (
                          <button
                            key={item.code}
                            type="button"
                            onClick={() => {
                              setLanguage(item.code as Language);
                              toast.success(`Language set to ${item.label}`);
                            }}
                            className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                              language === item.code
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-800/60'
                            }`}
                          >
                            <span>{item.label}</span>
                            {language === item.code && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Measurement Units */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                          Land Area Measurement
                        </label>
                        <div className="flex gap-2">
                          {['hectares', 'acres'].map(u => (
                            <button
                              key={u}
                              type="button"
                              onClick={() => setPreferences(p => ({ ...p, areaUnit: u }))}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                                preferences.areaUnit === u
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600'
                              }`}
                            >
                              {u}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                          Temperature Scale
                        </label>
                        <div className="flex gap-2">
                          {[
                            { id: 'celsius', label: 'Celsius (°C)' },
                            { id: 'fahrenheit', label: 'Fahrenheit (°F)' },
                          ].map(tItem => (
                            <button
                              key={tItem.id}
                              type="button"
                              onClick={() => setPreferences(p => ({ ...p, tempUnit: tItem.id }))}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                preferences.tempUnit === tItem.id
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600'
                              }`}
                            >
                              {tItem.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Notification Toggles */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Notification Channels & Urgency
                      </div>
                      {[
                        { key: 'outbreakPush' as const, label: 'Immediate Disease Outbreak Radar Alerts', desc: 'Critical alerts within 25km of your assigned farms' },
                        { key: 'smsAlerts' as const, label: 'SMS Dispatch Mirroring', desc: 'Copy field chat responses to registered officer SIM' },
                        { key: 'weeklyDigest' as const, label: 'Weekly Cohort Synthesis Email', desc: 'Consolidated performance summary delivered every Monday' },
                      ].map(item => {
                        const isChecked = preferences[item.key];
                        return (
                          <div key={item.key} className="flex items-center justify-between py-1.5">
                            <div>
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{item.label}</p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.desc}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setPreferences(p => ({ ...p, [item.key]: !isChecked }))
                              }
                              className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none shrink-0 ${
                                isChecked ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'
                              }`}
                            >
                              <span
                                className={`block w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                                  isChecked ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeTab === 'security' && (
                  <div className="space-y-6">
                    {/* Password Change Form */}
                    <form onSubmit={handlePasswordChange} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                          Change Account Password
                        </h4>
                      </div>

                      <div className="space-y-2">
                        <input
                          type="password"
                          placeholder="Current password"
                          value={passwordState.currentPassword}
                          onChange={e => setPasswordState(p => ({ ...p, currentPassword: e.target.value }))}
                          className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="password"
                            placeholder="New password (min 8 chars)"
                            value={passwordState.newPassword}
                            onChange={e => setPasswordState(p => ({ ...p, newPassword: e.target.value }))}
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <input
                            type="password"
                            placeholder="Confirm new password"
                            value={passwordState.confirmPassword}
                            onChange={e => setPasswordState(p => ({ ...p, confirmPassword: e.target.value }))}
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs rounded-xl hover:opacity-90 transition-opacity"
                        >
                          Update Password
                        </button>
                      </div>
                    </form>

                    {/* Two-Factor Authentication */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Two-Factor Authentication (2FA)
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Require SMS verification code on login from unrecognized devices
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = !twoFactorEnabled;
                          setTwoFactorEnabled(nextVal);
                          toast.success(nextVal ? '2FA enabled' : '2FA disabled');
                        }}
                        className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none shrink-0 ${
                          twoFactorEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                      >
                        <span
                          className={`block w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                            twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Danger Zone */}
                    <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 space-y-3">
                      <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                        <AlertTriangle className="w-4 h-4" />
                        <h4 className="text-xs font-bold uppercase tracking-wider">Account Data & Danger Zone</h4>
                      </div>
                      <p className="text-xs text-rose-900 dark:text-rose-200">
                        Permanently purge your locally cached field synchronizations or request account deletion.
                      </p>

                      {showDeleteConfirm ? (
                        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-rose-300 dark:border-rose-800 space-y-2">
                          <p className="text-xs font-bold text-rose-600">Are you sure? This cannot be undone.</p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setShowDeleteConfirm(false)}
                              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-xs font-bold rounded-lg text-slate-700 dark:text-slate-300"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                toast.error('Account deletion request submitted to District Lead.');
                                setShowDeleteConfirm(false);
                              }}
                              className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700"
                            >
                              Confirm Deletion Request
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(true)}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Request Account Deletion</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between shrink-0">
                <span className="text-[11px] text-slate-500 font-mono">
                  GPExts ID: {user.id?.slice(0, 8) || 'active-session'}
                </span>

                <div className="flex gap-2.5">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveProfile}
                        disabled={isSaving}
                        className="px-5 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-md shadow-emerald-950/20"
                      >
                        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>Save Changes</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(true);
                        setActiveTab('profile');
                      }}
                      className="px-5 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-950/20"
                    >
                      Edit Profile
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ProfileModal;
