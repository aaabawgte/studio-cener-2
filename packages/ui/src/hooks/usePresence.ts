import { useEffect, useState } from 'react';

/**
 * Drži element montiranim dok traje izlazna animacija.
 * `mounted` = treba li renderirati, `visible` = treba li biti u "open" stanju.
 */
export function usePresence(open: boolean, exitMs = 200) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timeout = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(timeout);
  }, [open, exitMs]);

  return { mounted, visible };
}
