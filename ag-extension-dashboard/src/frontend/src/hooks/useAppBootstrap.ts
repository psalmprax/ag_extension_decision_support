import { useEffect, useRef, useState } from 'react';
import { subscribeUserToPush } from '@/api/pushNotificationService';
import { registerServiceWorker } from '@/lib/swRegistration';
import { EncryptedStorageService } from '@/services/encryptedStorageService';

export const useAppBootstrap = (storeUser: unknown, setActiveTab: (tab: string) => void) => {
  const [weatherLocation, setWeatherLocation] = useState<string>(
    (storeUser as { region?: string })?.region || 'Nairobi, KE'
  );

  // Service Worker Registration
  const swRegistrationAttempted = useRef(false);
  useEffect(() => {
    if (swRegistrationAttempted.current) return;
    swRegistrationAttempted.current = true;
    try {
      registerServiceWorker();
    } catch (err) {
      console.warn(
        '[SW] Failed to register service worker gracefully:',
        err instanceof Error ? err.message : err
      );
    }
  }, []);

  // Encrypted storage: derive AES-256-GCM key from user identity on login.
  const keyInitAttempted = useRef(false);
  useEffect(() => {
    if (!storeUser || keyInitAttempted.current) return;
    const user = storeUser as { id?: string; email?: string };
    const secret = user.id || user.email || '';
    if (!secret) return;
    keyInitAttempted.current = true;
    EncryptedStorageService.deriveKeyFromSecret(secret).catch(err => {
      console.warn('[EncryptedStorage] Key derivation failed:', err instanceof Error ? err.message : err);
    });
  }, [storeUser]);

  // Push Notification Subscription
  useEffect(() => {
    if (storeUser) {
      subscribeUserToPush().catch(err => {
        console.warn('Push subscription failed:', err);
      });
    }
  }, [storeUser]);

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async position => {
          const { latitude, longitude } = position.coords;
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
            );
            const data = await response.json();
            const location =
              data.address?.city ||
              data.address?.town ||
              data.address?.village ||
              data.address?.county ||
              'Unknown';
            const country = data.address?.country || '';
            setWeatherLocation(location + (country ? `, ${country}` : ''));
          } catch {
            setWeatherLocation(`${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
          }
        },
        () => {
          setWeatherLocation((storeUser as { region?: string })?.region || 'Kenya');
        }
      );
    } else {
      setWeatherLocation((storeUser as { region?: string })?.region || 'Kenya');
    }
  }, [storeUser]);

  // Handle billing success/cancel URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setActiveTab('billing');
    } else if (params.get('canceled') === 'true') {
      setActiveTab('billing');
    }
  }, [setActiveTab]);

  return { weatherLocation, setWeatherLocation };
};
