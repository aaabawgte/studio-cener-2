import { useEffect } from 'react';

export function usePageTitle(...parts: (string | undefined | null)[]) {
  const title = [...parts.filter(Boolean), 'Studio Cener'].join(' · ');
  useEffect(() => {
    document.title = title;
  }, [title]);
}
