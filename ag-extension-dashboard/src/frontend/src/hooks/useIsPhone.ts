import { useEffect, useState } from 'react';

const PHONE_QUERY = '(max-width: 767px)';
const matches = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches;

/** True below the md breakpoint, where the app uses its phone layout. */
export function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(PHONE_QUERY);
    const onChange = () => setIsPhone(media.matches);
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);
  return isPhone;
}
