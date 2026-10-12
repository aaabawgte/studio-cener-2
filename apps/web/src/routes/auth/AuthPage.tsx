import { Alert, Button, Card, Field, Input } from '@studio/ui';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { authClient } from '../../lib/auth-client';
import { joinStudioAsArtist } from '../../features/bookings/booking-api';

type AuthPageProps = { mode: 'sign-in' | 'sign-up' };

function safeNext(value: string | null): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export function AuthPage({ mode }: AuthPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isSignUp = mode === 'sign-up';
  const next = safeNext(searchParams.get('next'));
  const studioSlug = searchParams.get('studio')?.trim() || null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const result = isSignUp
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });

      if (result.error) {
        setError(result.error.message ?? 'Prijava nije uspjela. Pokušajte ponovno.');
        return;
      }
      if (studioSlug) {
        await joinStudioAsArtist(studioSlug);
      }
      await navigate(next, { replace: true });
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Prijava ili pridruživanje studiju nije uspjelo.');
    } finally {
      setSubmitting(false);
    }
  }

  const alternativeQuery = new URLSearchParams({ next });
  if (studioSlug) alternativeQuery.set('studio', studioSlug);
  const alternativePath = `${isSignUp ? '/prijava' : '/registracija'}?${alternativeQuery}`;

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 block text-center font-display text-2xl text-ink">
          Studio Cener
        </Link>
        <Card className="p-6 sm:p-8">
          <header className="mb-7">
            <p className="mb-2 text-xs font-medium tracking-[0.18em] text-accent-strong uppercase">
              {isSignUp ? 'Novi račun' : 'Dobro došli'}
            </p>
            <h1 className="font-display text-3xl text-ink">
              {isSignUp ? 'Kreirajte račun' : 'Prijavite se'}
            </h1>
          </header>

          {error ? <Alert tone="danger" title="Nije uspjelo" className="mb-5">{error}</Alert> : null}

          <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
            {isSignUp ? (
              <Field label="Ime i prezime" required>
                <Input
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  minLength={2}
                />
              </Field>
            ) : null}
            <Field label="E-mail" required>
              <Input
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field label="Lozinka" required hint={isSignUp ? 'Najmanje 10 znakova.' : undefined}>
              <Input
                type="password"
                name="password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={10}
              />
            </Field>
            <Button type="submit" fullWidth size="lg" loading={submitting} loadingLabel="Provjera podataka">
              {isSignUp ? 'Kreiraj račun' : 'Prijavi se'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-muted">
            {isSignUp ? 'Već imate račun?' : 'Nemate račun?'}{' '}
            <Link to={alternativePath} className="font-medium text-ink underline decoration-line-strong underline-offset-4">
              {isSignUp ? 'Prijavite se' : 'Registrirajte se'}
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}
