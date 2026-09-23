import { useState, useEffect } from 'react';

/**
 * Returns the CSS `bottom` value (in pixels) that a fixed element should use
 * so it sits directly above the on-screen keyboard on mobile.
 *
 * When the virtual keyboard is closed this returns 0 (plus safe-area via CSS).
 * When the keyboard is open it returns the gap between the bottom of the
 * visual viewport and the bottom of the layout viewport, i.e. the keyboard height.
 *
 * Usage:
 *   const keyboardBottom = useKeyboardAwareBottom();
 *   <div style={{ bottom: keyboardBottom }} />
 *
 * The component is still responsible for adding safe-area-inset-bottom on top
 * of this value via CSS (use padding-bottom: env(safe-area-inset-bottom, 0px)).
 */
export function useKeyboardAwareBottom(): number {
  const [bottom, setBottom] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const update = () => {
      const vv = window.visualViewport!;
      // Keyboard height = difference between the full layout viewport height
      // and the visible visual viewport height, adjusted for any scroll offset.
      // On desktop / no keyboard: this is 0.
      const keyboardHeight = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop,
      );
      setBottom(keyboardHeight);
    };

    update();
    const vv = window.visualViewport!;
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return bottom;
}
