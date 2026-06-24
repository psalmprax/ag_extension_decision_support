import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, UserPlus, Shield, X, Loader2,
    ChevronDown, Search, Mail, MapPin, Phone
} from 'lucide-react';
import apiClient from '@/api/client';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useLanguage } from '@/lib/LanguageContext';

interface User {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    region: string;
    phone: string;
}

const ROLES = [
    { value: 'admin', label: 'Admin', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    { value: 'regional_manager', label: 'Regional Manager', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    { value: 'extension_officer', label: 'Extension Officer', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    { value: 'farmer', label: 'Farmer', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
];

const getRoleBadge = (role: string) => ROLES.find(r => r.value === role) || ROLES[2];

export function UserManagementPage() {
    const { t: _t } = useLanguage();
    const { isModern, radiusClass, btnClass, headingClass } = useThemeClasses();
    const queryClient = useQueryClient();

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [formData, setFormData] = useState({
        firstName: '', lastName: '', email: '', password: '',
        role: 'extension_officer', region: '', phone: '',
    });
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');

    // Fetch users
    const { data: usersData, isLoading } = useQuery({
        queryKey: ['users', roleFilter],
        queryFn: async () => {
            const params = roleFilter ? `?role=${roleFilter}` : '';
            const res = await apiClient.get(`/users${params}`);
            return res.data.data.users as User[];
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
            setTimeout(() => { setShowCreateModal(false); setFormSuccess(''); }, 1500);
            setFormData({ firstName: '', lastName: '', email: '', password: '', role: 'extension_officer', region: '', phone: '' });
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

    const filteredUsers = (usersData || []).filter(u => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return u.firstName?.toLowerCase().includes(term) ||
               u.lastName?.toLowerCase().includes(term) ||
               u.email?.toLowerCase().includes(term) ||
               u.region?.toLowerCase().includes(term);
    });

    return (
        <div>
            {/* Header */}
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className={`text-3xl ${headingClass}`}>User Management</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Manage system users and their roles</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className={`px-6 py-3 ${isModern ? 'bg-primary-600 hover:bg-primary-700 shadow-primary-500/20 shadow-lg' : 'bg-white dark:bg-slate-900 border-2 border-slate-800 dark:border-slate-200 text-slate-900 dark:text-white'} ${btnClass} transition-all flex items-center gap-2`}
                >
                    <UserPlus className="w-4 h-4" />
                    Create User
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name, email, or region..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className={`w-full pl-10 pr-4 py-2.5 ${radiusClass} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
                    />
                </div>
                <div className="relative">
                    <select
                        value={roleFilter}
                        onChange={e => setRoleFilter(e.target.value)}
                        className={`appearance-none pl-4 pr-10 py-2.5 ${radiusClass} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500`}
                    >
                        <option value="">All Roles</option>
                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
            </div>

            {/* Users Table */}
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                </div>
            ) : (
                <div className={`${isModern ? 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl' : 'bg-white dark:bg-gray-800'} rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden`}>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Region</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                {filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                                            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                            <p>No users found</p>
                                        </td>
                                    </tr>
                                ) : filteredUsers.map(user => {
                                    const roleBadge = getRoleBadge(user.role);
                                    return (
                                        <motion.tr
                                            key={user.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-bold">
                                                        {(user.firstName?.[0] || '?').toUpperCase()}{(user.lastName?.[0] || '').toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{user.firstName} {user.lastName}</p>
                                                        <p className="text-xs text-gray-500 flex items-center gap-1"><Mail className="w-3 h-3" />{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${roleBadge.color}`}>
                                                    <Shield className="w-3 h-3" />
                                                    {roleBadge.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1">
                                                    <MapPin className="w-3 h-3 text-gray-400" />
                                                    {user.region || '—'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1">
                                                    <Phone className="w-3 h-3 text-gray-400" />
                                                    {user.phone || '—'}
                                                </span>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500">
                        {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found
                    </div>
                </div>
            )}

            {/* Create User Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                        onClick={() => setShowCreateModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className={`bg-white dark:bg-gray-800 ${radiusClass} shadow-2xl w-full max-w-lg p-6`}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <UserPlus className="w-5 h-5 text-primary-500" />
                                    Create New User
                                </h2>
                                <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                                    <X className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>

                            {formError && (
                                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                                    {formError}
                                </div>
                            )}
                            {formSuccess && (
                                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-600 dark:text-green-400">
                                    {formSuccess}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name *</label>
                                        <input
                                            type="text" value={formData.firstName}
                                            onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                            className={`w-full px-4 py-2.5 ${radiusClass} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500`}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name *</label>
                                        <input
                                            type="text" value={formData.lastName}
                                            onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                            className={`w-full px-4 py-2.5 ${radiusClass} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500`}
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
                                    <input
                                        type="email" value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className={`w-full px-4 py-2.5 ${radiusClass} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500`}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password *</label>
                                    <input
                                        type="password" value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        className={`w-full px-4 py-2.5 ${radiusClass} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500`}
                                        placeholder="Min 8 chars, uppercase, lowercase, number"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                                    <select
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                                        className={`w-full px-4 py-2.5 ${radiusClass} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500`}
                                    >
                                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Region</label>
                                        <input
                                            type="text" value={formData.region}
                                            onChange={e => setFormData({ ...formData, region: e.target.value })}
                                            className={`w-full px-4 py-2.5 ${radiusClass} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500`}
                                            placeholder="e.g., Lilongwe"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                                        <input
                                            type="text" value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            className={`w-full px-4 py-2.5 ${radiusClass} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500`}
                                            placeholder="+265..."
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        className={`flex-1 py-2.5 ${radiusClass} border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors`}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={createUser.isPending}
                                        className={`flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white ${radiusClass} transition-colors flex items-center justify-center gap-2`}
                                    >
                                        {createUser.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                        {createUser.isPending ? 'Creating...' : 'Create User'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default UserManagementPage;
