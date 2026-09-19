import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchUserProfile, ProfileResponse } from '@/api/authService';
import { getCsrfToken } from '@/api/client';

/** True when the backend has issued a session (readable ag_csrf cookie present). */
export const hasAuthSession = (): boolean => !!getCsrfToken();

export const useAppAuth = (
  storeUser: unknown,
  setUser: (user: Record<string, unknown> | null) => void
) => {
  const hasSession = hasAuthSession();

  const { data: userResponse, error: userError } = useQuery<ProfileResponse>({
    queryKey: ['user-profile'],
    queryFn: fetchUserProfile,
    enabled: !!storeUser && hasSession,
  });

  // Clear invalid user session only on 401 errors
  useEffect(() => {
    if (userError && storeUser) {
      const error = userError as { response?: { status?: number } };
      if (error?.response?.status === 401) {
        setUser(null);
        localStorage.removeItem('user');
      }
    }
  }, [userError, storeUser, setUser]);

  // Handle the custom auth-unauthorized event
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      localStorage.removeItem('user');
    };
    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', handleUnauthorized);
  }, [setUser]);

  const user = userResponse?.data;
  const isOfficer = user?.role === 'extension_officer';

  return { user, isOfficer };
};
