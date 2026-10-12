import { useEffect } from 'react';

let lockCount = 0;
let previousOverflow = '';
let previousPaddingRight = '';

/** Zaključava scroll dokumenta dok je barem jedan overlay otvoren (podržava ugniježđene). */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    if (lockCount === 0) {
      const scrollbar = window.innerWidth - html.clientWidth;
      previousOverflow = html.style.overflow;
      previousPaddingRight = html.style.paddingRight;
      html.style.overflow = 'hidden';
      if (scrollbar > 0) html.style.paddingRight = `${scrollbar}px`;
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        html.style.overflow = previousOverflow;
        html.style.paddingRight = previousPaddingRight;
      }
    };
  }, [active]);
}
