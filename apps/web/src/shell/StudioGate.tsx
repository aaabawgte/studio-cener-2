import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { buttonStyles, ErrorState, Skeleton } from '@studio/ui';
import { loginUrl } from '../features/auth/session-actions';
import type { StudioViewerContext } from '../features/studio/types';
import { useStudioAccent } from '../features/studio/useStudioAccent';
import { useStudioViewerContext } from '../features/studio/useStudioViewerContext';
import { ApiError } from '../lib/api/client';

/**
 * Učitava kontekst studija i korisnika prije prikaza shella.
 * UI provjera je samo UX — backend mora odbiti svaki neovlašteni poziv.
 */
export function StudioGate({ slug, children }: { slug: string; children: (ctx: StudioViewerContext) => ReactNode }) {
  const result = useStudioViewerContext(slug);
  useStudioAccent(result.data?.studio.branding.accentColor);
  const location = useLocation();

  if (result.status === 'error') {
    const status = result.error instanceof ApiError ? result.error.status : 0;
    if (status === 401) {
      return (
        <CenteredState>
          <ErrorState
            icon="user"
            title="Prijavite se za nastavak"
            description="Ova stranica dostupna je samo prijavljenim korisnicima."
            action={
              <a href={loginUrl(location.pathname)} className={buttonStyles()}>
                Prijava
              </a>
            }
          />
        </CenteredState>
      );
    }
    if (status === 403 || status === 404) {
      // Isti tekst za 403 i 404 — ne otkrivamo postoji li tuđi studio.
      return (
        <CenteredState>
          <ErrorState
            icon="search"
            title="Studio nije dostupan"
            description="Studio ne postoji ili nemate pristup. Provjerite adresu ili se prijavite drugim računom."
            action={
              <Link to="/" className={buttonStyles({ variant: 'secondary' })}>
                Na početnu
              </Link>
            }
          />
        </CenteredState>
      );
    }
    return (
      <CenteredState>
        <ErrorState onRetry={result.reload} />
      </CenteredState>
    );
  }

  if (result.status !== 'success' || !result.data) return <ShellSkeleton />;
  return <>{children(result.data)}</>;
}

function CenteredState({ children }: { children: ReactNode }) {
  return <div className="grid min-h-dvh place-items-center px-4">{children}</div>;
}

/** Skeleton koji prati raspored shella, da nema skakanja layouta. */
function ShellSkeleton() {
  return (
    <div role="status" aria-live="polite" className="min-h-dvh lg:pl-[var(--shell-sidebar-w)]">
      <span className="sr-only">Učitavanje studija</span>
      <div className="fixed inset-y-0 left-0 hidden w-[var(--shell-sidebar-w)] border-r border-line px-5 pt-7 lg:block">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-[0.75rem]" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
        </div>
        <div className="mt-10 space-y-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <div className="flex h-[var(--shell-topbar-h)] items-center gap-3 border-b border-line px-4 lg:hidden">
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:px-12 lg:pt-14">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-9 w-64 max-w-full" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-card" />
          ))}
        </div>
      </div>
    </div>
  );
}
