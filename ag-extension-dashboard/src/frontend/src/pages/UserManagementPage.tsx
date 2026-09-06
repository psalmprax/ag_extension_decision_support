import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserPlus,
  Shield,
  X,
  Loader2,
  ChevronDown,
  Search,
  Mail,
  MapPin,
  Phone,
  Radio,
  CheckCircle2,
  AlertCircle,
  History,
  Laptop,
  KeyRound,
} from 'lucide-react';
import apiClient from '@/api/client';
import { useDemoMode, DEMO_USERS } from '@/demo';
import { fetchLoginHistory, fetchLoginStats } from '@/api/authService';
import {
  SUPPORTED_COUNTRIES,
  CONTINENT_ORDER,
  getCountryFlag,
  getCountryConfig,
} from '@/lib/countries';
import { useLanguage } from '@/lib/LanguageContext';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  region: string;
  country?: string;
  phone: string;
  lastLoginAt?: string | null;
}

const ROLES = [
  {
    value: 'admin',
    label: 'Admin',
    labelKey: 'users_role_admin',
    color: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  },
  {
    value: 'regional_manager',
    label: 'Regional Manager',
    labelKey: 'users_role_regional_manager',
    color: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  },
  {
    value: 'extension_officer',
    label: 'Extension Officer',
    labelKey: 'users_role_extension_officer',
    color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  {
    value: 'farmer',
    label: 'Farmer',
    labelKey: 'users_role_farmer',
    color: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  },
];

const getRoleBadge = (role: string) => ROLES.find(r => r.value === role) || ROLES[2];

// eslint-disable-next-line sonarjs/cognitive-complexity
export function UserManagementPage() {
  const { t } = useLanguage();
  const { isDemo } = useDemoMode();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUserForHistory, setSelectedUserForHistory] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'extension_officer',
    region: '',
    country: 'Kenya',
    phone: '',
  });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const activeCountryConfig = getCountryConfig(formData.country);
  const availableRegions = activeCountryConfig?.regions || [];

  const handleCountryChange = (countryName: string) => {
    setFormData(prev => ({
      ...prev,
      country: countryName,
      region: '',
    }));
  };

  const { data: loginHistoryData, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['login-history', selectedUserForHistory?.id],
    queryFn: () => fetchLoginHistory({ userId: selectedUserForHistory?.id, limit: 25 }),
    enabled: !!selectedUserForHistory,
  });

  const { data: loginStatsData } = useQuery({
    queryKey: ['login-stats', selectedUserForHistory?.id],
    queryFn: () => fetchLoginStats(selectedUserForHistory?.id),
    enabled: !!selectedUserForHistory,
  });

  // Fetch users
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users', roleFilter, isDemo],
    queryFn: async () => {
      if (isDemo) {
        return DEMO_USERS.filter(u => !roleFilter || u.role === roleFilter) as User[];
      }
      const params = roleFilter ? `?role=${roleFilter}` : '';
      const res = await apiClient.get(`/users${params}`);
      const raw = res.data?.data;
      return (Array.isArray(raw) ? raw : raw?.users || []) as User[];
    },
  });

  // Create user mutation
  const createUser = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (isDemo) {
        await new Promise((resolve) => setTimeout(resolve, 600));
        return {
          success: true,
          data: {
            id: `demo-user-${Date.now()}`,
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            role: data.role,
            region: data.region || 'Eastern',
            country: data.country || 'Kenya',
            phone: data.phone || '+254 700 000000',
            isActive: true,
            createdAt: new Date().toISOString(),
          },
        };
      }
      const res = await apiClient.post('/users', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setFormSuccess(t('users_create_success', 'User created successfully'));
      setFormError('');
      setTimeout(() => {
        setShowCreateModal(false);
        setFormSuccess('');
      }, 1500);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: 'extension_officer',
        region: '',
        country: 'Kenya',
        phone: '',
      });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      setFormError(e?.response?.data?.error || t('users_create_error_failed', 'Failed to create user'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      setFormError(t('users_create_error_required', 'All required fields must be filled'));
      return;
    }
    createUser.mutate(formData);
  };

  const usersList = usersData || [];
  const filteredUsers = usersList.filter(u => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      u.firstName?.toLowerCase().includes(term) ||
      u.lastName?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.region?.toLowerCase().includes(term) ||
      u.country?.toLowerCase().includes(term)
    );
  });

  const officersCount = usersList.filter(u => u.role === 'extension_officer').length;
  const uniqueRegions = new Set(usersList.map(u => u.region).filter(Boolean)).size;
  const uniqueCountries = new Set(usersList.map(u => u.country).filter(Boolean)).size || (usersList.length > 0 ? 1 : 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24">
      {/* ── Top Bento Banner: Staff Directory & Access Control ── */}
      <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-950/40">
              <Users className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-white">{t('users_directory_title', 'Staff & Officer Directory')}</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xxs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                  {t('users_rbac_active', 'RBAC Active')}
                </span>
              </div>
              <p className="text-xs text-white/60 mt-0.5">
                {t('users_directory_desc', 'Manage extension officers, regional supervisors, and administrative credentials.')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end flex-wrap">
            {/* KPI Telemetry Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex items-center gap-2 w-full sm:w-auto">
              <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-center sm:text-left">
                <span className="text-xxs font-semibold text-white/40 uppercase block">{t('users_stat_total_staff', 'Total Staff')}</span>
                <strong className="text-sm font-bold text-white font-mono">{usersList.length}</strong>
              </div>
              <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-center sm:text-left">
                <span className="text-xxs font-semibold text-white/40 uppercase block">{t('users_stat_officers', 'Officers')}</span>
                <strong className="text-sm font-bold text-emerald-400 font-mono">{officersCount}</strong>
              </div>
              <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-center sm:text-left">
                <span className="text-xxs font-semibold text-white/40 uppercase block">{t('users_stat_countries', 'Countries')}</span>
                <strong className="text-sm font-bold text-sky-400 font-mono">{uniqueCountries}</strong>
              </div>
              <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-center sm:text-left">
                <span className="text-xxs font-semibold text-white/40 uppercase block">{t('users_stat_regions', 'Regions')}</span>
                <strong className="text-sm font-bold text-purple-400 font-mono">{uniqueRegions}</strong>
              </div>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>{t('users_btn_create_user', 'Create User')}</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 mt-5 border-t border-white/5">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder={t('users_search_placeholder', 'Search by name, email, country, or region...')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-white/10 bg-white/[0.02] text-white placeholder-white/30 focus:ring-1 focus:ring-emerald-400 outline-none"
            />
          </div>

          <div className="relative w-full sm:w-48">
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="w-full appearance-none pl-3.5 pr-9 py-2 text-xs rounded-xl border border-white/10 bg-slate-900 text-white focus:ring-1 focus:ring-emerald-400 outline-none"
            >
              <option value="">{t('users_all_roles', 'All Roles ({count})', { count: usersList.length })}</option>
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>
                  {t(r.labelKey, r.label)}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── User Cards Grid ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        </div>
      ) : filteredUsers.length === 0 ? (
        /* Empty State with Seed Action */
        <div className="backdrop-blur-xl bg-slate-900/40 border border-white/10 rounded-xl p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/40">
            <Users className="w-8 h-8 opacity-70" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">{t('users_empty_title', 'No Users Found')}</h3>
            <p className="text-xs text-white/50 max-w-sm mx-auto">
              {searchTerm || roleFilter
                ? t('users_empty_desc_filtered', 'No staff members match the active search or role filters.')
                : t('users_empty_desc_all', 'No users registered yet. Add your first field officer or admin.')}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('users_btn_add_first', 'Add Extension Officer')}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map(user => {
            const roleBadge = getRoleBadge(user.role);
            return (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="backdrop-blur-xl bg-slate-900/60 border border-white/10 hover:border-emerald-500/30 rounded-xl p-5 shadow-lg space-y-4 transition-all duration-300 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/30 to-teal-500/30 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-bold text-sm shadow-md">
                      {(user.firstName?.[0] || '?').toUpperCase()}
                      {(user.lastName?.[0] || '').toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                        {user.firstName} {user.lastName}
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xxs font-bold uppercase tracking-wider border mt-1 ${roleBadge.color}`}
                      >
                        <Shield className="w-2.5 h-2.5" />
                        {t(roleBadge.labelKey, roleBadge.label)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contact & Region Details */}
                <div className="space-y-2 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs">
                  <div className="flex items-center gap-2 text-white/70">
                    <Mail className="w-3.5 h-3.5 text-white/40 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/70">
                    <span className="text-xs shrink-0">{getCountryFlag(user.country)}</span>
                    <span className="font-medium text-white/80">{user.country || 'Kenya'}</span>
                    <span className="text-white/30">•</span>
                    <span>{user.region || t('users_unassigned_region', 'Unassigned Region')}</span>
                  </div>
                  {user.phone && (
                    <div className="flex items-center gap-2 text-white/70">
                      <Phone className="w-3.5 h-3.5 text-sky-400/70 shrink-0" />
                      <span className="font-mono">{user.phone}</span>
                    </div>
                  )}

                  <div className="pt-2 mt-2 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-white/40 font-mono truncate max-w-[150px]">
                      {user.lastLoginAt
                        ? t('users_last_login', 'Last: {date}', { date: new Date(user.lastLoginAt).toLocaleDateString() })
                        : t('users_no_recent_login', 'No recent login')}
                    </span>
                    <button
                      onClick={() => setSelectedUserForHistory(user)}
                      className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 shrink-0"
                    >
                      <History className="w-3 h-3" />
                      <span>{t('users_btn_history', 'History')}</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Create User Modal ── */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="backdrop-blur-2xl bg-slate-900/95 border border-white/10 rounded-xl shadow-2xl w-full max-w-lg max-h-[90dvh] overflow-y-auto custom-scrollbar p-6 sm:p-8 space-y-6 text-white"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{t('users_modal_register_title', 'Register New User')}</h2>
                    <p className="text-xs text-white/50">{t('users_modal_register_desc', 'Add extension officer or admin account')}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 text-white/40 hover:text-white rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-white/60">{t('users_form_first_name', 'First Name *')}</label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                      placeholder="e.g. Kiprono"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-white text-xs outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-white/60">{t('users_form_last_name', 'Last Name *')}</label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                      placeholder="e.g. Rotich"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-white text-xs outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-white/60">{t('users_form_work_email', 'Work Email *')}</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="officer@extension.gov"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-white text-xs outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-white/60">{t('users_form_password', 'Password *')}</label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-white text-xs outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-white/60">{t('users_form_role', 'System Role')}</label>
                    <select
                      value={formData.role}
                      onChange={e => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-slate-900 text-white text-xs outline-none focus:ring-1 focus:ring-emerald-400"
                    >
                      {ROLES.map(r => (
                        <option key={r.value} value={r.value}>
                          {t(r.labelKey, r.label)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-white/60">{t('users_form_phone', 'Phone Number')}</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+254 712 345 678"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-white text-xs outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-white/60">{t('users_form_country', 'Country *')}</label>
                    <select
                      required
                      value={formData.country}
                      onChange={e => handleCountryChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-slate-900 text-white text-xs outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
                    >
                      {CONTINENT_ORDER.map(continent => {
                        const countries = SUPPORTED_COUNTRIES.filter(c => c.continent === continent);
                        if (countries.length === 0) return null;
                        return (
                          <optgroup key={continent} label={continent} className="bg-slate-900 text-emerald-400 font-bold">
                            {countries.map(c => (
                              <option key={c.name} value={c.name} className="bg-slate-900 text-white font-normal">
                                {c.flag} {c.name}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-white/60">
                      {t('users_form_region', 'Assigned Region / Territory')}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        list="user-region-suggestions"
                        value={formData.region}
                        onChange={e => setFormData({ ...formData, region: e.target.value })}
                        placeholder={availableRegions.length > 0 ? `e.g. ${availableRegions[0]}` : t('users_form_region_placeholder', 'e.g. District / Province')}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-white text-xs outline-none focus:ring-1 focus:ring-emerald-400"
                      />
                      <datalist id="user-region-suggestions">
                        {availableRegions.map(reg => (
                          <option key={reg} value={reg} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-white/60 hover:text-white transition-colors"
                  >
                    {t('common_cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={createUser.isPending}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-950/40 disabled:opacity-50"
                  >
                    {createUser.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{createUser.isPending ? t('users_btn_registering', 'Registering...') : t('users_btn_create_account', 'Create Account')}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Login History Modal ── */}
      <AnimatePresence>
        {selectedUserForHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
            onClick={() => setSelectedUserForHistory(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="backdrop-blur-2xl bg-slate-900/95 border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90dvh] overflow-y-auto custom-scrollbar p-6 sm:p-8 space-y-6 text-white"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{t('users_history_title', 'Login & Access History')}</h2>
                    <p className="text-xs text-white/50">
                      {selectedUserForHistory.firstName} {selectedUserForHistory.lastName} ({selectedUserForHistory.email})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUserForHistory(null)}
                  className="p-1.5 text-white/40 hover:text-white rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Telemetry Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-xxs font-bold text-white/40 uppercase tracking-wider block">{t('users_history_total_logins', 'Total Logins')}</span>
                  <strong className="text-base font-bold text-white font-mono">{loginStatsData?.totalLogins ?? 0}</strong>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-xxs font-bold text-white/40 uppercase tracking-wider block">{t('users_history_failed_24h', 'Failed (24h)')}</span>
                  <strong className="text-base font-bold text-rose-400 font-mono">{loginStatsData?.failedAttempts24h ?? 0}</strong>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-xxs font-bold text-white/40 uppercase tracking-wider block">{t('users_history_last_ip', 'Last IP')}</span>
                  <strong className="text-xs font-bold text-emerald-400 font-mono truncate block">{loginStatsData?.lastLoginIp || '—'}</strong>
                </div>
              </div>

              {/* Table of Attempts */}
              <div className="max-h-[300px] overflow-y-auto rounded-xl border border-white/10 bg-slate-950/60 divide-y divide-white/5">
                {isLoadingHistory ? (
                  <div className="p-12 text-center text-white/50 text-xs flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                    <span>{t('users_history_loading', 'Loading access history...')}</span>
                  </div>
                ) : !loginHistoryData?.items || loginHistoryData.items.length === 0 ? (
                  <div className="p-12 text-center text-white/50 text-xs space-y-2">
                    <KeyRound className="w-6 h-6 text-white/20 mx-auto" />
                    <p>{t('users_history_empty', 'No login audit records found for this account.')}</p>
                  </div>
                ) : (
                  loginHistoryData.items.map(entry => (
                    <div key={entry.id} className="p-3.5 flex items-center justify-between gap-4 text-xs hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-xxs font-bold uppercase tracking-wider border ${
                            entry.status === 'success'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {entry.status}
                        </span>
                        <div>
                          <div className="font-medium text-white flex items-center gap-2">
                            <Laptop className="w-3 h-3 text-white/40" />
                            <span>{entry.device || t('users_history_unknown_device', 'Unknown Device')}</span>
                          </div>
                          {entry.failureReason && (
                            <p className="text-xxs text-rose-400 font-mono mt-0.5">{t('users_history_reason', 'Reason: {reason}', { reason: entry.failureReason })}</p>
                          )}
                        </div>
                      </div>

                      <div className="text-right font-mono text-xxs text-white/50 space-y-0.5">
                        <div className="text-white/80">{new Date(entry.createdAt).toLocaleString()}</div>
                        {entry.location && (
                          <div className="flex items-center justify-end gap-1 text-white/70">
                            <MapPin className="w-2.5 h-2.5 text-emerald-400/80 shrink-0" />
                            <span className="truncate max-w-[160px]">{entry.location}</span>
                          </div>
                        )}
                        <div>IP: {entry.ipAddress || '—'}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedUserForHistory(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold transition-all text-white"
                >
                  {t('common_close', 'Close')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default UserManagementPage;
