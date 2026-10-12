import { Link } from 'react-router';
import { buttonStyles, EmptyState } from '@studio/ui';
import { usePageTitle } from '../lib/usePageTitle';

export function NotFound({ inline = false }: { inline?: boolean }) {
  usePageTitle('Stranica ne postoji');
  return (
    <div className={inline ? undefined : 'grid min-h-dvh place-items-center px-4'}>
      <EmptyState
        icon="search"
        title="Stranica ne postoji"
        description="Poveznica je možda zastarjela ili je adresa krivo upisana."
        action={
          <Link to="/" className={buttonStyles({ variant: 'secondary' })}>
            Na početnu
          </Link>
        }
      />
    </div>
  );
}
