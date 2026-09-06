import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut } from 'lucide-react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { cn } from '@/lib/cn';
import { dropdownVariants } from '@/lib/animations';
import { useLanguage } from '@/lib/LanguageContext';

interface ProfileMenuProps {
  isProfileMenuOpen: boolean;
  setIsProfileMenuOpen: (open: boolean) => void;
  storeUser: { firstName?: string; lastName?: string; email?: string } | null;
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

  return (
    <div className="relative">
      <button
        onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
        className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-white/10 hover:opacity-80 transition-opacity"
        aria-label="Open user profile menu"
      >
        <div className="w-8 h-8 rounded-full border border-primary-400/30 overflow-hidden ring-2 ring-primary-400/10 flex items-center justify-center bg-slate-800 shrink-0">
          <span className="text-xxs text-primary-400 font-bold">
            {storeUser?.firstName?.[0]}
            {storeUser?.lastName?.[0]}
          </span>
        </div>
        <div className="hidden xl:block text-left">
          <p className="text-xs font-bold text-gray-900 dark:text-white leading-none">
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
              className="absolute right-0 mt-2 w-56 glass-panel rounded-xl shadow-2xl p-2 z-50"
            >
              <div className="p-3 mb-2 border-b border-white/10">
                <p
                  className={cn('text-xxs font-bold uppercase tracking-widest mb-1', subtextClass)}
                >
                  {t('header_account_info', { defaultValue: 'Account Info' })}
                </p>
                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
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
                <span className="text-xs font-bold uppercase tracking-widest">
                  {t('header_profile', { defaultValue: 'Profile' })}
                </span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-rose-500/10 text-rose-400"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">
                  {t('header_sign_out', { defaultValue: 'Sign Out' })}
                </span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
