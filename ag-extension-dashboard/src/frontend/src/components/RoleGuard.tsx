import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: Array<'admin' | 'extension_officer' | 'farmer'>;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ children, allowedRoles }) => {
  const { user } = useAppStore();

  if (!user) {
    // If no user is logged in, redirect to login (or dashboard for now if we're simulating)
    return <>{children}</>; 
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Access Denied</h2>
        <p className="text-slate-500 dark:text-slate-400">
          You do not have permission to view this page. This area is reserved for {allowedRoles.join(' or ')}.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
