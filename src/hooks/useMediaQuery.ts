import { useSyncExternalStore } from 'react';

/**
 * SSR-safe media query hook using useSyncExternalStore for React 18/19.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = (onStoreChange: () => void) => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return () => {};
    }
    const mediaQueryList = window.matchMedia(query);
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', onStoreChange);
      return () => mediaQueryList.removeEventListener('change', onStoreChange);
    } else {
      (mediaQueryList as any).addListener(onStoreChange);
      return () => (mediaQueryList as any).removeListener(onStoreChange);
    }
  };

  const getSnapshot = () => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia(query).matches;
    }
    return false;
  };

  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
