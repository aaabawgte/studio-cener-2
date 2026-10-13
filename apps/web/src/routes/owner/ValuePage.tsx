import type { ArtistValueAccount, HourPackage, ValueArtist } from '@studio/contracts';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, LoadingState, PageHeader, Select, Textarea, useToast } from '@studio/ui';
import { useEffect, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router';
import type { StudioViewerContext } from '../../features/studio/types';
import { addCreditEntry, addPackageEntry, createHourPackage, fetchHourPackages, fetchValueAccount, fetchValueArtists, grantPackage } from '../../features/value/value-api';
import { useAsync } from '../../lib/useAsync';
import { usePageTitle } from '../../lib/usePageTitle';

const money = (minor: number, currency: string) => new Intl.NumberFormat('hr-HR', { style: 'currency', currency }).format(minor / 100);
const hours = (minutes: number) => `${Math.floor(Math.abs(minutes) / 60)} h ${Math.abs(minutes) % 60} min`;

export function ValuePage() {
  usePageTitle('Paketi i krediti');
  const ctx = useOutletContext<StudioViewerContext>();
  const packages = useAsync((signal) => fetchHourPackages(ctx.studio.slug, signal), [ctx.studio.slug]);
  const artists = useAsync((signal) => fetchValueArtists(ctx.studio.slug, signal), [ctx.studio.slug]);
  const [selected, setSelected] = useState('');
  useEffect(() => { if (!selected && artists.data?.artists[0]) setSelected(artists.data.artists[0].userId); }, [artists.data, selected]);
  return <>
    <PageHeader title="Paketi i krediti" description="Ručno dodijelite sate ili prepaid kredit. Svaka promjena ostaje trajno zabilježena." />
    <div className="grid gap-8 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <PackagePanel slug={ctx.studio.slug} currency={ctx.studio.currency} packages={packages.data?.packages ?? []} reload={packages.reload} />
      <section>
        <Field label="Artist"><Select value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Odaberite artista</option>{artists.data?.artists.map((artist) => <option key={artist.userId} value={artist.userId}>{artist.name} · {artist.email}</option>)}</Select></Field>
        {artists.status === 'loading' ? <LoadingState /> : selected ? <ArtistAccount key={selected} slug={ctx.studio.slug} artist={artists.data!.artists.find((item) => item.userId === selected)!} packages={packages.data?.packages.filter((item) => item.status === 'active') ?? []} /> : <Card className="mt-5" padded={false}><EmptyState size="compact" icon="user" title="Još nema artista" description="Artist će se pojaviti nakon registracije u studio." /></Card>}
      </section>
    </div>
  </>;
}

function PackagePanel({ slug, currency, packages, reload }: { slug: string; currency: string; packages: HourPackage[]; reload: () => void }) {
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false); const toast = useToast();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setSaving(true);
    try { await createHourPackage(slug, { name: String(data.get('name')), description: String(data.get('description')) || null,
      includedMinutes: Number(data.get('hours')) * 60, priceMinor: Math.round(Number(String(data.get('price')).replace(',', '.')) * 100),
      validityDays: data.get('validity') ? Number(data.get('validity')) : null });
      event.currentTarget.reset(); setOpen(false); reload(); toast.success('Paket je dodan.');
    } catch (error) { toast.error('Paket nije spremljen', error instanceof Error ? error.message : undefined); } finally { setSaving(false); }
  }
  return <aside><div className="mb-4 flex items-center justify-between"><h2 className="text-xl">Paketi sati</h2><Button size="sm" variant="secondary" onClick={() => setOpen(!open)}>{open ? 'Zatvori' : 'Novi paket'}</Button></div>
    {open ? <Card className="mb-4"><form className="space-y-4" onSubmit={(event) => void submit(event)}><Field label="Naziv" required><Input name="name" required minLength={2} /></Field><Field label="Opis"><Textarea name="description" rows={2} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Sati" required><Input name="hours" type="number" min="0.25" step="0.25" required /></Field><Field label={`Cijena (${currency})`} required><Input name="price" inputMode="decimal" required /></Field></div><Field label="Vrijedi dana" hint="Prazno znači bez isteka."><Input name="validity" type="number" min="1" max="3650" /></Field><Button type="submit" fullWidth loading={saving}>Spremi paket</Button></form></Card> : null}
    <div className="space-y-3">{packages.map((item) => <Card key={item.id}><div className="flex items-start justify-between gap-3"><div><h3 className="font-medium">{item.name}</h3><p className="mt-1 text-sm text-ink-subtle">{hours(item.includedMinutes)} · {money(item.priceMinor, item.currency)}</p>{item.validityDays ? <p className="mt-1 text-xs text-ink-subtle">Vrijedi {item.validityDays} dana</p> : null}</div><Badge tone={item.status === 'active' ? 'success' : 'neutral'}>{item.status === 'active' ? 'Aktivan' : 'Arhiviran'}</Badge></div></Card>)}</div>
  </aside>;
}

function ArtistAccount({ slug, artist, packages }: { slug: string; artist: ValueArtist; packages: HourPackage[] }) {
  const account = useAsync((signal) => fetchValueAccount(slug, artist.userId, signal), [slug, artist.userId]);
  if (account.status === 'loading') return <LoadingState />;
  if (account.status === 'error' || !account.data) return <Alert tone="danger" className="mt-5">Stanje nije moguće učitati.</Alert>;
  return <AccountContent slug={slug} account={account.data} packages={packages} reload={account.reload} />;
}

function AccountContent({ slug, account, packages, reload }: { slug: string; account: ArtistValueAccount; packages: HourPackage[]; reload: () => void }) {
  const [saving, setSaving] = useState(false); const toast = useToast();
  async function mutate(task: () => Promise<unknown>, success: string) { setSaving(true); try { await task(); reload(); toast.success(success); } catch (error) { toast.error('Promjena nije spremljena', error instanceof Error ? error.message : undefined); } finally { setSaving(false); } }
  async function submitGrant(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); await mutate(() => grantPackage(slug, { userId: account.artist.userId, packageId: String(data.get('packageId')), reason: String(data.get('reason')) }), 'Paket je dodijeljen.'); event.currentTarget.reset(); }
  async function submitCredit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); const kind = String(data.get('kind')) as 'grant'|'use'|'refund'|'adjustment'; const raw = Math.round(Number(String(data.get('amount')).replace(',', '.')) * 100); const amountMinor = kind === 'use' ? -Math.abs(raw) : raw; await mutate(() => addCreditEntry(slug, { userId: account.artist.userId, amountMinor, kind, reason: String(data.get('reason')) }), 'Kredit je promijenjen.'); event.currentTarget.reset(); }
  return <div className="mt-5 space-y-6"><Card><p className="eyebrow">Prepaid kredit</p><p className="mt-2 font-display text-4xl">{money(account.creditBalanceMinor, account.currency)}</p></Card>
    <div className="grid gap-4 lg:grid-cols-2"><Card><h3 className="text-lg">Dodijeli paket</h3><form className="mt-4 space-y-3" onSubmit={(e) => void submitGrant(e)}><Field label="Paket"><Select name="packageId" required><option value="">Odaberite</option>{packages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field><Field label="Razlog" required><Input name="reason" required minLength={2} placeholder="Plaćeno u studiju" /></Field><Button type="submit" fullWidth loading={saving}>Dodijeli paket</Button></form></Card>
      <Card><h3 className="text-lg">Promijeni kredit</h3><form className="mt-4 space-y-3" onSubmit={(e) => void submitCredit(e)}><div className="grid grid-cols-2 gap-3"><Field label="Vrsta"><Select name="kind"><option value="grant">Dodjela</option><option value="use">Potrošnja</option><option value="refund">Povrat</option><option value="adjustment">Korekcija</option></Select></Field><Field label={`Iznos (${account.currency})`}><Input name="amount" required inputMode="decimal" /></Field></div><Field label="Razlog" required><Input name="reason" required minLength={2} /></Field><Button type="submit" fullWidth loading={saving}>Zapiši promjenu</Button></form></Card></div>
    <section><h2 className="mb-3 text-xl">Aktivni paketi</h2>{account.packageBalances.length ? <div className="space-y-3">{account.packageBalances.map((balance) => <PackageBalanceCard key={balance.id} slug={slug} balance={balance} saving={saving} mutate={mutate} />)}</div> : <Card padded={false}><EmptyState size="compact" icon="wallet" title="Nema paketa" /></Card>}</section>
    <section><h2 className="mb-3 text-xl">Povijest kredita</h2><LedgerRows rows={account.creditLedger.map((entry) => ({ id: entry.id, amount: money(entry.amountMinor, entry.currency), positive: entry.amountMinor > 0, reason: entry.reason, actor: entry.actorName, date: entry.createdAt }))} /></section>
  </div>;
}

function PackageBalanceCard({ slug, balance, saving, mutate }: { slug: string; balance: ArtistValueAccount['packageBalances'][number]; saving: boolean; mutate: (task: () => Promise<unknown>, success: string) => Promise<void> }) {
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); const kind = String(data.get('kind')) as 'use'|'refund'|'adjustment'; const raw = Number(data.get('minutes')); const amountMinutes = kind === 'use' ? -Math.abs(raw) : raw; await mutate(() => addPackageEntry(slug, balance.id, { amountMinutes, kind, reason: String(data.get('reason')) }), 'Minute su promijenjene.'); event.currentTarget.reset(); }
  return <Card><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-medium">{balance.packageName}</h3><p className="mt-1 text-sm text-ink-subtle">Preostalo {hours(balance.remainingMinutes)} od {hours(balance.grantedMinutes)}</p></div><Badge tone={balance.status === 'active' ? 'success' : 'neutral'}>{balance.status === 'active' ? 'Aktivan' : balance.status === 'expired' ? 'Istekao' : 'Iskorišten'}</Badge></div>{balance.status !== 'expired' ? <form className="mt-4 grid gap-3 sm:grid-cols-[8rem_7rem_1fr_auto]" onSubmit={(e) => void submit(e)}><Select name="kind" aria-label="Vrsta promjene"><option value="use">Potrošnja</option><option value="refund">Povrat</option><option value="adjustment">Korekcija</option></Select><Input name="minutes" type="number" min="15" step="15" required aria-label="Minute" /><Input name="reason" required minLength={2} placeholder="Razlog" aria-label="Razlog" /><Button type="submit" size="sm" loading={saving}>Zapiši</Button></form> : null}</Card>;
}

function LedgerRows({ rows }: { rows: { id: string; amount: string; positive: boolean; reason: string; actor: string; date: string }[] }) {
  return rows.length ? <Card className="divide-y divide-line" padded={false}>{rows.map((row) => <div key={row.id} className="flex items-start justify-between gap-4 px-5 py-4"><div><p className="font-medium">{row.reason}</p><p className="mt-1 text-xs text-ink-subtle">{row.actor} · {new Intl.DateTimeFormat('hr-HR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(row.date))}</p></div><span className={row.positive ? 'text-success' : 'text-ink'}>{row.positive ? '+' : '−'}{row.amount.replace('-', '')}</span></div>)}</Card> : <Card padded={false}><EmptyState size="compact" title="Nema promjena" /></Card>;
}
