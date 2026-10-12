import { Link } from 'react-router';
import { buttonStyles } from '@studio/ui';
import { usePageTitle } from '../lib/usePageTitle';

/** Privremena početna. Javni studio profil živi na /s/:slug (sljedeća grana). */
export function Home() {
  usePageTitle();
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-16">
      <p className="eyebrow">Platforma za recording studije</p>
      <h1 className="mt-4 text-[2.75rem] leading-[1.05] sm:text-6xl">Studio Cener</h1>
      <p className="mt-5 max-w-lg text-lg text-ink-subtle">Rezervacije, tim i portfolio studija na jednom mirnom mjestu.</p>
      {import.meta.env.DEV ? (
        <div className="mt-10 flex flex-col gap-2 sm:flex-row">
          <Link to="/app/demo" className={buttonStyles()}>
            Owner shell (demo)
          </Link>
          <Link to="/s/demo/me" className={buttonStyles({ variant: 'secondary' })}>
            Artist portal (demo)
          </Link>
          <Link to="/_ui" className={buttonStyles({ variant: 'ghost' })}>
            UI kit
          </Link>
        </div>
      ) : null}
    </main>
  );
}
