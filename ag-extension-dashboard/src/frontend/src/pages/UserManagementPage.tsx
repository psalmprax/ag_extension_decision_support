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
  Globe,
} from 'lucide-react';
import apiClient from '@/api/client';
import { useDemoMode, DEMO_USERS } from '@/demo';
import { fetchLoginHistory, fetchLoginStats } from '@/api/authService';

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
    color: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  },
  {
    value: 'regional_manager',
    label: 'Regional Manager',
    color: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  },
  {
    value: 'extension_officer',
    label: 'Extension Officer',
    color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  {
    value: 'farmer',
    label: 'Farmer',
    color: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  },
];

const getRoleBadge = (role: string) => ROLES.find(r => r.value === role) || ROLES[2];

export function UserManagementPage() {
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
      const res = await apiClient.post('/users', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setFormSuccess('User created successfully');
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
      setFormError(e?.response?.data?.error || 'Failed to create user');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      setFormError('All required fields must be filled');
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
                <h1 className="text-2xl font-bold tracking-tight text-white">Staff & Officer Directory</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xxs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                  RBAC Active
                </span>
              </div>
              <p className="text-xs text-white/60 mt-0.5">
                Manage extension officers, regional supervisors, and administrative credentials.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end flex-wrap">
            {/* KPI Telemetry Chips */}
            <div className="grid grid-cols-4 sm:flex items-center gap-2 w-full sm:w-auto">
              <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-center sm:text-left">
                <span className="text-xxs font-semibold text-white/40 uppercase block">Total Staff</span>
                <strong className="text-sm font-bold text-white font-mono">{usersList.length}</strong>
              </div>
              <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-center sm:text-left">
                <span className="text-xxs font-semibold text-white/40 uppercase block">Officers</span>
                <strong className="text-sm font-bold text-emerald-400 font-mono">{officersCount}</strong>
              </div>
              <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-center sm:text-left">
                <span className="text-xxs font-semibold text-white/40 uppercase block">Countries</span>
                <strong className="text-sm font-bold text-sky-400 font-mono">{uniqueCountries}</strong>
              </div>
              <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-center sm:text-left">
                <span className="text-xxs font-semibold text-white/40 uppercase block">Regions</span>
                <strong className="text-sm font-bold text-purple-400 font-mono">{uniqueRegions}</strong>
              </div>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create User</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 mt-5 border-t border-white/5">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Search by name, email, country, or region..."
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
              <option value="">All Roles ({usersList.length})</option>
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>
                  {r.label}
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
            <h3 className="text-base font-bold text-white">No Users Found</h3>
            <p className="text-xs text-white/50 max-w-sm mx-auto">
              {searchTerm || roleFilter
                ? 'No staff members match the active search or role filters.'
                : 'No users registered yet. Add your first field officer or admin.'}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Extension Officer</span>
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
                        {roleBadge.label}
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
                    <Globe className="w-3.5 h-3.5 text-sky-400/80 shrink-0" />
                    <span className="font-medium text-white/80">{user.country || 'Kenya'}</span>
                    <span className="text-white/30">•</span>
                    <span>{user.region || 'Unassigned Region'}</span>
                  </div>
                  {user.phone && (
                    <div className="flex items-center gap-2 text-white/70">
                      <Phone className="w-3.5 h-3.5 text-sky-400/70 shrink-0" />
                      <span className="font-mono">{user.phone}</span>
                    </div>
                  )}

                  <div className="pt-2 mt-2 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-white/40 font-mono truncate max-w-[150px]">
                      {user.lastLoginAt ? `Last: ${new Date(user.lastLoginAt).toLocaleDateString()}` : 'No recent login'}
                    </span>
                    <button
                      onClick={() => setSelectedUserForHistory(user)}
                      className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 shrink-0"
                    >
                      <History className="w-3 h-3" />
                      <span>History</span>
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
              className="backdrop-blur-2xl bg-slate-900/95 border border-white/10 rounded-xl shadow-2xl w-full max-w-lg p-6 sm:p-8 space-y-6 text-white"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Register New User</h2>
                    <p className="text-xs text-white/50">Add extension officer or admin account</p>
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
                    <label className="text-xxs font-bold uppercase tracking-wider text-white/60">First Name *</label>
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
                    <label className="text-xxs font-bold uppercase tracking-wider text-white/60">Last Name *</label>
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
                  <label className="text-xxs font-bold uppercase tracking-wider text-white/60">Work Email *</label>
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
                  <label className="text-xxs font-bold uppercase tracking-wider text-white/60">Password *</label>
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
                    <label className="text-xxs font-bold uppercase tracking-wider text-white/60">System Role</label>
                    <select
                      value={formData.role}
                      onChange={e => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-slate-900 text-white text-xs outline-none focus:ring-1 focus:ring-emerald-400"
                    >
                      {ROLES.map(r => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-white/60">Phone Number</label>
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
                    <label className="text-xxs font-bold uppercase tracking-wider text-white/60">Country *</label>
                    <input
                      type="text"
                      required
                      value={formData.country}
                      onChange={e => setFormData({ ...formData, country: e.target.value })}
                      placeholder="e.g. Kenya"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-white text-xs outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-white/60">Assigned Region</label>
                    <input
                      type="text"
                      value={formData.region}
                      onChange={e => setFormData({ ...formData, region: e.target.value })}
                      placeholder="e.g. Rift Valley"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-white text-xs outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-white/60 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createUser.isPending}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-950/40 disabled:opacity-50"
                  >
                    {createUser.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{createUser.isPending ? 'Registering...' : 'Create Account'}</span>
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
              className="backdrop-blur-2xl bg-slate-900/95 border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl p-6 sm:p-8 space-y-6 text-white"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Login & Access History</h2>
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
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-xxs font-bold text-white/40 uppercase tracking-wider block">Total Logins</span>
                  <strong className="text-base font-bold text-white font-mono">{loginStatsData?.totalLogins ?? 0}</strong>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-xxs font-bold text-white/40 uppercase tracking-wider block">Failed (24h)</span>
                  <strong className="text-base font-bold text-rose-400 font-mono">{loginStatsData?.failedAttempts24h ?? 0}</strong>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-xxs font-bold text-white/40 uppercase tracking-wider block">Last IP</span>
                  <strong className="text-xs font-bold text-emerald-400 font-mono truncate block">{loginStatsData?.lastLoginIp || '—'}</strong>
                </div>
              </div>

              {/* Table of Attempts */}
              <div className="max-h-[300px] overflow-y-auto rounded-xl border border-white/10 bg-slate-950/60 divide-y divide-white/5">
                {isLoadingHistory ? (
                  <div className="p-12 text-center text-white/50 text-xs flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                    <span>Loading access history...</span>
                  </div>
                ) : !loginHistoryData?.items || loginHistoryData.items.length === 0 ? (
                  <div className="p-12 text-center text-white/50 text-xs space-y-2">
                    <KeyRound className="w-6 h-6 text-white/20 mx-auto" />
                    <p>No login audit records found for this account.</p>
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
                            <span>{entry.device || 'Unknown Device'}</span>
                          </div>
                          {entry.failureReason && (
                            <p className="text-xxs text-rose-400 font-mono mt-0.5">Reason: {entry.failureReason}</p>
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
                  Close
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
