import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut } from 'lucide-react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { cn } from '@/lib/cn';
import { dropdownVariants } from '@/lib/animations';
import { useLanguage } from '@/lib/LanguageContext';
import { AVATAR_PRESETS } from '@/components/profileDefaults';
import { safeStorage } from '@/lib/safeStorage';

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
          || (storeUser?.id ? safeStorage.get(`gpexts_user_avatar:${storeUser.id}`) || '' : ''));
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
        aria-expanded={isProfileMenuOpen}
        aria-haspopup="menu"
      >
        <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-emerald-100 dark:bg-emerald-400/[0.15] shrink-0">
          {AvatarIcon ? (
            <AvatarIcon className="w-4 h-4 text-emerald-800 dark:text-emerald-200" strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <span className="text-xs text-emerald-800 dark:text-emerald-200 font-medium" aria-hidden="true">
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
        <span className="sr-only">Profile menu</span>
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
              role="menu"
              aria-label={t('header_account_info', { defaultValue: 'Account info' })}
              className="absolute end-0 mt-2 w-56 popover-surface rounded-xl p-2 z-50"
            >
              <div className="p-3 mb-2 border-b border-slate-900/[0.08] dark:border-white/[0.08]">
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
                role="menuitem"
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  setShowProfileModal(true);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06] text-slate-800 dark:text-theme-text-secondary"
              >
                <User className="w-4 h-4 text-primary-700 dark:text-primary-400" aria-hidden="true" />
                <span className="text-xs font-medium  ">
                  {t('header_profile', { defaultValue: 'Profile' })}
                </span>
              </button>
              <button
                role="menuitem"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-rose-500/10 text-rose-700 dark:text-rose-400"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span className="text-xs font-medium  ">
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
