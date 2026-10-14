import type { LicensePlan, PlatformStudio, PlatformStudioCreate } from './types';
import { Alert, Badge, Button, Card, EmptyState, ErrorState, Field, Input, LoadingState, Select, buttonStyles, useToast } from '@studio/ui';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { createPlatformStudio, fetchPlatformStudios, setStudioDomain, updateStudioLicense, verifyStudioDomain } from '../../features/platform/platform-api';
import { ApiError } from '../../lib/api/client';
import { useAsync } from '../../lib/useAsync';
import { usePageTitle } from '../../lib/usePageTitle';

function dateOneYearFromNow() {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

const initialForm = (): PlatformStudioCreate => ({
  name: '', slug: '', ownerEmail: '', timezone: 'Europe/Zagreb', currency: 'EUR', plan: 'pro',
  expiresAt: `${dateOneYearFromNow()}T23:59:59.000Z`, hostname: '',
});

export function PlatformPage() {
  usePageTitle('Platform admin');
  const result = useAsync(fetchPlatformStudios, []);

  if (result.status === 'loading') return <main className="min-h-dvh bg-canvas"><LoadingState /></main>;
  if (result.status === 'error') {
    const error = result.error;
    const unauthenticated = error instanceof ApiError && error.status === 401;
    const forbidden = error instanceof ApiError && error.status === 403;
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-5">
        <ErrorState
          title={unauthenticated ? 'Prijavite se kao platform admin' : forbidden ? 'Nemaš platform admin ovlasti' : 'Admin podatke nije moguće učitati'}
          description={unauthenticated ? 'Nakon prijave vratit ćemo te na upravljanje studijima.' : undefined}
          action={unauthenticated ? <Link className={buttonStyles()} to="/prijava?next=%2Fplatform">Prijava</Link> : undefined}
          onRetry={!unauthenticated && !forbidden ? result.reload : undefined}
        />
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8"><Link to="/" className="font-display text-xl">Studio Cener</Link><Badge tone="accent">Platform admin</Badge></div></header>
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-10"><p className="eyebrow">Komercijalno upravljanje</p><h1 className="mt-3 text-4xl sm:text-5xl">Studiji i licence</h1><p className="mt-3 max-w-2xl text-ink-muted">Kreiraj tenant, licencu, željenu domenu i sigurnu owner pozivnicu.</p></div>
        <div className="grid gap-8 lg:grid-cols-[23rem_minmax(0,1fr)]">
          <StudioForm onCreated={result.reload} />
          <StudioList studios={result.data?.studios ?? []} onUpdated={result.reload} />
        </div>
      </div>
    </main>
  );
}

function StudioForm({ onCreated }: { onCreated: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  function update<K extends keyof PlatformStudioCreate>(key: K, value: PlatformStudioCreate[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function updateName(name: string) {
    setForm((current) => ({ ...current, name, slug: current.slug || name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(null); setInviteUrl(null);
    try {
      const created = await createPlatformStudio({ ...form, hostname: form.hostname || undefined });
      const url = `${window.location.origin}/pozivnica?token=${encodeURIComponent(created.invitationToken)}`;
      setInviteUrl(url); setForm(initialForm()); onCreated(); toast.success('Studio i licenca su kreirani.');
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Studio nije moguće kreirati.'); }
    finally { setSaving(false); }
  }
  return (
    <Card className="h-fit">
      <h2 className="text-xl">Novi studio</h2>
      {error ? <Alert tone="danger" className="mt-4">{error}</Alert> : null}
      {inviteUrl ? <Alert tone="success" title="Owner pozivnica" className="mt-4"><a className="break-all underline" href={inviteUrl}>{inviteUrl}</a></Alert> : null}
      <form className="mt-5 space-y-4" onSubmit={(event) => void submit(event)}>
        <Field label="Naziv" required><Input value={form.name} onChange={(event) => updateName(event.target.value)} /></Field>
        <Field label="Slug" required><Input value={form.slug} onChange={(event) => update('slug', event.target.value.toLowerCase())} /></Field>
        <Field label="Owner e-mail" required><Input type="email" value={form.ownerEmail} onChange={(event) => update('ownerEmail', event.target.value)} /></Field>
        <Field label="Željena domena" hint="Primjer: booking.studio.hr"><Input value={form.hostname ?? ''} onChange={(event) => update('hostname', event.target.value.toLowerCase())} /></Field>
        <Field label="Paket"><Select value={form.plan} onChange={(event) => update('plan', event.target.value as LicensePlan)}><option value="starter">Starter</option><option value="pro">Pro</option><option value="custom">Custom</option></Select></Field>
        <Field label="Licenca vrijedi do"><Input type="date" value={form.expiresAt.slice(0, 10)} onChange={(event) => update('expiresAt', `${event.target.value}T23:59:59.000Z`)} /></Field>
        <Button type="submit" fullWidth loading={saving}>Kreiraj studio</Button>
      </form>
    </Card>
  );
}

function StudioList({ studios, onUpdated }: { studios: PlatformStudio[]; onUpdated: () => void }) {
  const toast = useToast();
  const [updating, setUpdating] = useState<string | null>(null);
  async function extend(studio: PlatformStudio) {
    setUpdating(studio.id);
    try {
      const expiry = new Date(Math.max(Date.now(), Date.parse(studio.license.expiresAt)));
      expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
      await updateStudioLicense(studio.id, { plan: studio.license.plan, status: 'active', expiresAt: expiry.toISOString() });
      toast.success('Licenca je produžena za godinu dana.'); onUpdated();
    } catch (caught: unknown) { toast.error('Produženje nije uspjelo', caught instanceof Error ? caught.message : undefined); }
    finally { setUpdating(null); }
  }
  if (!studios.length) return <Card padded={false}><EmptyState size="compact" icon="services" title="Još nema studija" /></Card>;
  return <div className="space-y-3">{studios.map((studio) => (
    <Card key={studio.id}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl">{studio.name}</h2><Badge tone={studio.license.status === 'active' ? 'success' : 'warning'}>{studio.license.status}</Badge></div>
          <p className="mt-2 text-sm text-ink-muted">{studio.ownerEmail ?? 'Owner nije dodijeljen'}</p>
          <p className="mt-1 text-sm text-ink-subtle">/{studio.slug} · {studio.license.plan} · do {new Intl.DateTimeFormat('hr-HR').format(new Date(studio.license.expiresAt))}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" loading={updating === studio.id} onClick={() => void extend(studio)}>+ 1 godina</Button>
          {studio.domain?.status === 'active'
            ? <a className={buttonStyles({ variant: 'secondary', size: 'sm' })} href={`https://${studio.domain.hostname}`} target="_blank" rel="noreferrer">Javna stranica</a>
            : <Link className={buttonStyles({ variant: 'secondary', size: 'sm' })} to={`/s/${studio.slug}`}>Javna stranica</Link>}
        </div>
      </div>
      <DomainControl studio={studio} onUpdated={onUpdated} />
    </Card>
  ))}</div>;
}

const domainStatusLabel = { pending: 'Čeka povezivanje', active: 'Aktivna', failed: 'Provjera nije uspjela' } as const;

function DomainControl({ studio, onUpdated }: { studio: PlatformStudio; onUpdated: () => void }) {
  const toast = useToast();
  const [hostname, setHostname] = useState(studio.domain?.hostname ?? '');
  const [action, setAction] = useState<'save' | 'verify' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setAction('save'); setError(null);
    try {
      await setStudioDomain(studio.id, { hostname: hostname.trim().toLowerCase() });
      toast.success('Domena je spremljena.'); onUpdated();
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Domenu nije moguće spremiti.'); }
    finally { setAction(null); }
  }

  async function verify() {
    setAction('verify'); setError(null);
    try {
      await verifyStudioDomain(studio.id);
      toast.success('Domena je aktivna i spremna.'); onUpdated();
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Domenu nije moguće provjeriti.'); onUpdated(); }
    finally { setAction(null); }
  }

  const savedHostname = studio.domain?.hostname ?? '';
  return (
    <div className="mt-5 border-t border-line pt-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">Vlastita domena</h3>
        {studio.domain ? <Badge tone={studio.domain.status === 'active' ? 'success' : studio.domain.status === 'failed' ? 'warning' : 'neutral'}>{domainStatusLabel[studio.domain.status]}</Badge> : null}
      </div>
      <p className="mt-2 text-sm text-ink-subtle">Dodaj domenu u Cloudflare Pages projekt “studio-cener-2”, zatim ovdje pokreni provjeru.</p>
      {error ? <Alert tone="danger" className="mt-3">{error}</Alert> : null}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Input aria-label={`Domena za ${studio.name}`} placeholder="booking.studio.hr" value={hostname} onChange={(event) => setHostname(event.target.value.toLowerCase())} />
        <Button variant="secondary" loading={action === 'save'} disabled={!hostname.trim() || action !== null} onClick={() => void save()}>Spremi</Button>
        <Button loading={action === 'verify'} disabled={!savedHostname || hostname.trim() !== savedHostname || action !== null} onClick={() => void verify()}>Provjeri</Button>
      </div>
      {studio.domain?.status === 'active' ? <p className="mt-3 text-sm text-success">https://{studio.domain.hostname} je spreman za artiste.</p> : null}
    </div>
  );
}
