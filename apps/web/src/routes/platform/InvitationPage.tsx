import { Alert, Card, ErrorState, LoadingState, buttonStyles } from '@studio/ui';
import { Link, useSearchParams } from 'react-router';
import { acceptInvitation } from '../../features/platform/platform-api';
import { ApiError } from '../../lib/api/client';
import { useAsync } from '../../lib/useAsync';
import { usePageTitle } from '../../lib/usePageTitle';

export function InvitationPage() {
  usePageTitle('Owner pozivnica');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const result = useAsync(() => token ? acceptInvitation(token) : Promise.reject(new Error('Pozivnica nije valjana.')), [token]);
  const next = encodeURIComponent(`/pozivnica?token=${encodeURIComponent(token)}`);

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-5 py-10">
      <Card className="w-full max-w-md text-center">
        <Link to="/" className="font-display text-2xl">Studio Cener</Link>
        {result.status === 'loading' ? <LoadingState label="Aktivacija pristupa" /> : null}
        {result.status === 'error' ? (
          result.error instanceof ApiError && result.error.status === 401
            ? <div className="mt-7"><h1 className="text-3xl">Owner pozivnica</h1><p className="mt-3 text-sm text-ink-muted">Prijavi se ili kreiraj račun koristeći e-mail na koji je pozivnica izdana.</p><div className="mt-6 flex flex-col gap-2"><Link className={buttonStyles()} to={`/prijava?next=${next}`}>Prijava</Link><Link className={buttonStyles({ variant: 'secondary' })} to={`/registracija?next=${next}`}>Kreiraj račun</Link></div></div>
            : <ErrorState size="compact" title="Pozivnicu nije moguće prihvatiti" description={result.error instanceof Error ? result.error.message : undefined} />
        ) : null}
        {result.data ? <div className="mt-7"><Alert tone="success" title="Studio je spreman">Dodijeljena ti je uloga vlasnika studija.</Alert><Link className={buttonStyles({ size: 'lg', fullWidth: true, className: 'mt-5' })} to={`/app/${result.data.studioSlug}`}>Otvori dashboard</Link></div> : null}
      </Card>
    </main>
  );
}
