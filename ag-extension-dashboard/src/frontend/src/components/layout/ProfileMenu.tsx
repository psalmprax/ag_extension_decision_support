import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut } from 'lucide-react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { cn } from '@/lib/cn';
import { dropdownVariants } from '@/lib/animations';
import { useLanguage } from '@/lib/LanguageContext';
import { AVATAR_PRESETS } from '@/components/profileDefaults';

interface ProfileMenuProps {
  isProfileMenuOpen: boolean;
  setIsProfileMenuOpen: (open: boolean) => void;
  storeUser: { id?: string; firstName?: string; lastName?: string; email?: string; profileSettings?: { avatarId?: string } } | null;
  setShowProfileModal: (show: boolean) => void;
  handleLogout: () => void;
}

export const ProfileMenu: React.FC<ProfileMenuProps> = ({
  isProfileMenuOpen,
  setIsProfileMenuOpen,
  storeUser,
  setShowProfileModal,
  handleLogout,
}) => {
  const { subtextClass } = useThemeClasses();
  const { t } = useLanguage();
  const [avatarId, setAvatarId] = useState('');

  useEffect(() => {
    const updateAvatar = () => {
      try {
        // The account's avatar, else this browser's older copy.
        setAvatarId(storeUser?.profileSettings?.avatarId
          || (storeUser?.id ? localStorage.getItem(`gpexts_user_avatar:${storeUser.id}`) || '' : ''));
      } catch {
        setAvatarId('');
      }
    };
    window.addEventListener('gpexts:avatar-updated', updateAvatar);
    updateAvatar();
    return () => window.removeEventListener('gpexts:avatar-updated', updateAvatar);
  }, [storeUser?.id, storeUser?.profileSettings?.avatarId]);
  const AvatarIcon = AVATAR_PRESETS.find(preset => preset.id === avatarId)?.icon;

  return (
    <div className="relative">
      <button
        onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
        className="flex items-center gap-2 sm:gap-3 rounded-md p-1 hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06] transition-colors"
        aria-label="Open user profile menu"
      >
        <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-emerald-100 dark:bg-emerald-400/[0.15] shrink-0">
          {AvatarIcon ? (
            <AvatarIcon className="w-4 h-4 text-emerald-800 dark:text-emerald-200" strokeWidth={1.5} aria-label="Selected profile avatar" />
          ) : (
            <span className="text-xs text-emerald-800 dark:text-emerald-200 font-medium">
              {storeUser?.firstName?.[0]}
              {storeUser?.lastName?.[0]}
            </span>
          )}
        </div>
        <div className="hidden xl:block text-start">
          <p className="text-sm font-medium text-slate-900 dark:text-white leading-none">
            {storeUser?.firstName} {storeUser?.lastName}
          </p>
        </div>
      </button>

      <AnimatePresence>
        {isProfileMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsProfileMenuOpen(false)} />
            <motion.div
              variants={dropdownVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute end-0 mt-2 w-56 glass-panel rounded-xl shadow-2xl p-2 z-50"
            >
              <div className="p-3 mb-2 border-b border-white/10">
                <p
                  className={cn('text-xs mb-1', subtextClass)}
                >
                  {t('header_account_info', { defaultValue: 'Account info' })}
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {storeUser?.email}
                </p>
              </div>

              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  setShowProfileModal(true);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-slate-300"
              >
                <User className="w-4 h-4 text-primary-400" />
                <span className="text-xs font-bold  ">
                  {t('header_profile', { defaultValue: 'Profile' })}
                </span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-rose-500/10 text-rose-400"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-xs font-bold  ">
                  {t('header_sign_out', { defaultValue: 'Sign out' })}
                </span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
