import { useEffect } from 'react';
import { createAccentTheme } from '@studio/ui';

/**
 * Primjenjuje brand akcent studija na <html>, da vrijedi i za portale (modali, toastovi).
 * Boja bez dovoljnog kontrasta se ignorira (ostaje zadani topli akcent).
 */
export function useStudioAccent(accentColor: string | null | undefined) {
  useEffect(() => {
    const { style, applied } = createAccentTheme(accentColor);
    if (!applied) return;
    const root = document.documentElement;
    const entries = Object.entries(style as Record<string, string>);
    entries.forEach(([key, value]) => root.style.setProperty(key, value));
    return () => entries.forEach(([key]) => root.style.removeProperty(key));
  }, [accentColor]);
}
