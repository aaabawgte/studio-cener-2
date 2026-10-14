import { Badge, Button, Card, EmptyState, PageHeader, buttonStyles } from '@studio/ui';
import { Link, useOutletContext } from 'react-router';
import { fetchArtistOverview } from '../../features/artist/artist-api';
import type { StudioViewerContext } from '../../features/studio/types';
import { useAsync } from '../../lib/useAsync';
import { usePageTitle } from '../../lib/usePageTitle';

export function ArtistHomePage() {
  usePageTitle('Početna');
  const ctx = useOutletContext<StudioViewerContext>();
  const state = useAsync((signal) => fetchArtistOverview(ctx.studio.slug, signal), [ctx.studio.slug]);
  const base = `/s/${ctx.studio.slug}/me`;
  const dateTime = new Intl.DateTimeFormat('hr-HR', { timeZone: ctx.studio.timezone, dateStyle: 'full', timeStyle: 'short' });
  const money = new Intl.NumberFormat('hr-HR', { style: 'currency', currency: ctx.studio.currency });

  if (state.status === 'error') return <EmptyState icon="alert" title="Početnu stranicu nije moguće učitati" action={<Button variant="secondary" onClick={state.reload}>Pokušaj ponovno</Button>} />;
  if (!state.data) return <p className="text-sm text-ink-subtle">Učitavanje…</p>;
  const data = state.data;
  return <>
    <PageHeader eyebrow={`Bok, ${ctx.viewer.name.split(' ')[0]}`} title="Tvoj studio na jednom mjestu" description="Pregled termina, kredita i obavijesti." actions={<Link className={buttonStyles()} to={`${base}/rezerviraj`}>Rezerviraj termin</Link>} />
    <section>
      <p className="eyebrow">Sljedeći termin</p>
      {data.nextBooking ? <Card className="mt-3"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-2xl">{data.nextBooking.serviceName}</h2><p className="mt-2 text-sm text-ink-muted">{dateTime.format(new Date(data.nextBooking.startAtUtc))} · {data.nextBooking.durationMinutes} min</p></div><Link className={buttonStyles({ variant: 'secondary' })} to={`${base}/termini`}>Moji termini</Link></div></Card> : <Card className="mt-3" padded={false}><EmptyState size="compact" icon="calendar" title="Nema nadolazećih termina" action={<Link className={buttonStyles({ variant: 'secondary' })} to={`${base}/rezerviraj`}>Pronađi termin</Link>} /></Card>}
    </section>
    <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard label="Prepaid kredit" value={money.format(data.creditBalanceMinor / 100)} href={`${base}/krediti`} />
      <SummaryCard label="Paketi" value={`${data.packageMinutesRemaining} min`} hint={`${data.activePackageCount} aktivno`} href={`${base}/krediti`} />
      <SummaryCard label="Nove obavijesti" value={String(data.unreadNotifications)} href={`${base}/obavijesti`} />
      <SummaryCard label="Lista čekanja" value={String(data.activeWaitlistEntries)} href={`${base}/lista-cekanja`} />
    </section>
    <section className="mt-8"><div className="mb-3 flex items-end justify-between"><div><p className="eyebrow">Najnovije</p><h2 className="mt-1 text-xl">Obavijesti</h2></div><Link className="text-sm underline underline-offset-4" to={`${base}/obavijesti`}>Prikaži sve</Link></div>
      {data.recentNotifications.length ? <div className="space-y-3">{data.recentNotifications.map((item) => <Card key={item.id}><div className="flex items-center gap-2"><h3 className="font-medium">{item.title}</h3>{!item.readAt ? <Badge tone="accent">Novo</Badge> : null}</div><p className="mt-2 text-sm text-ink-subtle">{item.body}</p></Card>)}</div> : <Card padded={false}><EmptyState size="compact" icon="bell" title="Nema novih obavijesti" /></Card>}
    </section>
  </>;
}

function SummaryCard({ label, value, hint, href }: { label: string; value: string; hint?: string; href: string }) {
  return <Link to={href} className="block"><Card className="h-full transition-transform hover:-translate-y-0.5"><p className="eyebrow">{label}</p><p className="mt-2 font-display text-3xl">{value}</p>{hint ? <p className="mt-1 text-xs text-ink-subtle">{hint}</p> : null}</Card></Link>;
}
