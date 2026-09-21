import { useEffect } from 'react';

/**
 * Hook to set `--app-height` CSS custom property on documentElement
 * from window.visualViewport.height to smoothly handle virtual keyboards on iOS.
 */
export function useVisualViewportHeight(): void {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const updateHeight = () => {
      if (window.visualViewport) {
        const height = window.visualViewport.height;
        document.documentElement.style.setProperty('--app-height', `${height}px`);
      }
    };

    updateHeight();
    const vv = window.visualViewport;
    vv.addEventListener('resize', updateHeight);
    vv.addEventListener('scroll', updateHeight);

    return () => {
      vv.removeEventListener('resize', updateHeight);
      vv.removeEventListener('scroll', updateHeight);
      document.documentElement.style.removeProperty('--app-height');
    };
  }, []);
}
