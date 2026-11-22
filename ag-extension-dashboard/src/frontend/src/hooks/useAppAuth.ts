import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchUserProfile, ProfileResponse } from '@/api/authService';
import { getCsrfToken } from '@/api/client';
import { safeStorage } from '@/lib/safeStorage';

/** True when the backend has issued a session (readable ag_csrf cookie present). */
export const hasAuthSession = (): boolean => !!getCsrfToken();

export const useAppAuth = (
  storeUser: unknown,
  setUser: (user: Record<string, unknown> | null) => void
) => {
  const hasSession = hasAuthSession();
  const cachedUserId = storeUser && typeof storeUser === 'object' && 'id' in storeUser
    ? storeUser.id : undefined;

  const { data: userResponse, error: userError } = useQuery<ProfileResponse>({
    queryKey: ['user-profile', cachedUserId],
    queryFn: fetchUserProfile,
    enabled: !!storeUser && hasSession,
  });

  useEffect(() => {
    if (userResponse?.data) setUser(userResponse.data);
  }, [userResponse?.data, setUser]);

  // Clear invalid user session only on 401 errors
  useEffect(() => {
    if (userError && storeUser) {
      const error = userError as { response?: { status?: number } };
      if (error?.response?.status === 401) {
        setUser(null);
        safeStorage.remove('user');
      }
    }
  }, [userError, storeUser, setUser]);

  // Handle the custom auth-unauthorized event
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      safeStorage.remove('user');
    };
    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', handleUnauthorized);
  }, [setUser]);

  const user = userResponse?.data;
  const isOfficer = user?.role === 'extension_officer';

  return { user, isOfficer };
};
