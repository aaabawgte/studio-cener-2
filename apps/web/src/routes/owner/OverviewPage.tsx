import type { StudioOverview } from '@studio/contracts';
import { Badge, Card, EmptyState, PageHeader, Stat, buttonStyles } from '@studio/ui';
import { Link, useOutletContext } from 'react-router';
import { fetchStudioOverview } from '../../features/overview/overview-api';
import type { StudioPermission, StudioViewerContext } from '../../features/studio/types';
import { useAsync } from '../../lib/useAsync';
import { usePageTitle } from '../../lib/usePageTitle';

export function OverviewPage() {
  usePageTitle('Pregled'); const ctx = useOutletContext<StudioViewerContext>();
  const state = useAsync((signal) => fetchStudioOverview(ctx.studio.slug, signal), [ctx.studio.slug]);
  return <>{state.data ? <Overview data={state.data} ctx={ctx} /> : state.status === 'error' ? <EmptyState icon="alert" title="Pregled nije moguće učitati" /> : <p className="text-sm text-ink-subtle">Učitavanje…</p>}</>;
}

function Overview({ data, ctx }: { data: StudioOverview; ctx: StudioViewerContext }) {
  const base = `/app/${ctx.studio.slug}`;
  const money = new Intl.NumberFormat('hr-HR', { style: 'currency', currency: data.currency, maximumFractionDigits: 0 });
  const date = new Intl.DateTimeFormat('hr-HR', { timeZone: data.timezone, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${data.date}T12:00:00`));
  const needsAttention = !data.attention.hasActiveServices || !data.attention.hasAvailabilityRules || data.attention.activeWaitlistEntries > 0;
  return <><PageHeader eyebrow={date} title={`Dobro došli, ${ctx.viewer.name.split(' ')[0]}`} description="Današnji raspored i stvari koje traže pažnju." actions={<Link className={buttonStyles()} to={`${base}/termini/nova`}>Nova rezervacija</Link>} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Card><Stat label="Danas" value={data.summary.todayBookings} hint="aktivnih termina" /></Card><Card><Stat label="Vrijednost danas" value={money.format(data.summary.todayBookingValueMinor / 100)} hint="vrijednost rezervacija" /></Card><Card><Stat label="Idućih 7 dana" value={data.summary.nextSevenDaysBookings} hint="potvrđenih termina" /></Card><Card><Stat label="Lista čekanja" value={data.summary.activeWaitlistEntries} hint="aktivnih prijava" /></Card></div>
    {needsAttention ? <section className="mt-8"><h2 className="mb-4 text-xl">Traži pažnju</h2><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{!data.attention.hasActiveServices ? <Attention title="Nema aktivnih usluga" body="Dodajte barem jednu uslugu prije primanja rezervacija." href={`${base}/usluge`} label="Uredi usluge" /> : null}{!data.attention.hasAvailabilityRules ? <Attention title="Radno vrijeme nije postavljeno" body="Bez radnog vremena artisti ne mogu pronaći slobodan termin." href={`${base}/radno-vrijeme`} label="Postavi radno vrijeme" /> : null}{data.attention.activeWaitlistEntries ? <Attention title={`${data.attention.activeWaitlistEntries} na listi čekanja`} body="Provjerite tražene datume i moguće slobodne termine." href={`${base}/lista-cekanja`} label="Otvori listu" /> : null}</div></section> : null}
    <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,.6fr)]"><TodaySchedule data={data} /><QuickActions base={base} permissions={ctx.membership.permissions} /></div>
  </>;
}

function TodaySchedule({ data }: { data: StudioOverview }) {
  const time = new Intl.DateTimeFormat('hr-HR', { timeZone: data.timezone, hour: '2-digit', minute: '2-digit' });
  return <section><div className="mb-4 flex items-end justify-between gap-4"><div><p className="eyebrow">Raspored</p><h2 className="mt-1 text-xl">Današnji termini</h2></div></div>{data.today.length ? <Card padded={false}><div className="divide-y divide-line">{data.today.map((booking) => <div key={booking.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[7rem_1fr_auto] sm:items-center"><div><p className="font-display text-xl tabular">{time.format(new Date(booking.startAtUtc))}</p><p className="text-xs text-ink-subtle">do {time.format(new Date(booking.endAtUtc))}</p></div><div><p className="font-medium">{booking.serviceName}</p><p className="mt-1 text-sm text-ink-subtle">{booking.artistName} · {booking.artistEmail}</p></div><Badge tone={booking.status === 'confirmed' ? 'success' : booking.status === 'cancelled' ? 'neutral' : 'accent'}>{statusLabel(booking.status)}</Badge></div>)}</div></Card> : <Card padded={false}><EmptyState size="compact" icon="calendar" title="Danas nema termina" description="Raspored je slobodan." /></Card>}</section>;
}

function QuickActions({ base, permissions }: { base: string; permissions: StudioViewerContext['membership']['permissions'] }) {
  const allLinks = [
    { label: 'Nova rezervacija', href: `${base}/termini/nova`, permission: 'bookings.manage' },
    { label: 'Otvori kalendar', href: `${base}/kalendar`, permission: 'bookings.view' },
    { label: 'Uredi usluge', href: `${base}/usluge`, permission: 'services.manage' },
    { label: 'Blokiraj termin', href: `${base}/kalendar`, permission: 'calendar.manage' },
    { label: 'Paketi i krediti', href: `${base}/paketi-krediti`, permission: 'credits.manage' },
    { label: 'Promo kodovi', href: `${base}/promo-kodovi`, permission: 'promos.manage' },
    { label: 'Postavke studija', href: `${base}/postavke`, permission: 'studio.settings.manage' },
  ] satisfies { label: string; href: string; permission: StudioPermission }[];
  const links = allLinks.filter((item) => permissions.includes(item.permission));
  return <section><p className="eyebrow">Prečaci</p><h2 className="mt-1 text-xl">Brze radnje</h2><Card className="mt-4" padded={false}><div className="divide-y divide-line">{links.map((item) => <Link key={item.label} to={item.href} className="flex min-h-12 items-center justify-between px-5 py-3 text-sm font-medium transition-colors hover:bg-surface">{item.label}<span aria-hidden="true">→</span></Link>)}</div></Card></section>;
}

function Attention({ title, body, href, label }: { title: string; body: string; href: string; label: string }) {
  return <Card variant="outline"><h3 className="font-medium">{title}</h3><p className="mt-2 text-sm text-ink-subtle">{body}</p><Link to={href} className="mt-4 inline-block text-sm font-medium text-accent-strong">{label} →</Link></Card>;
}

function statusLabel(status: 'confirmed'|'cancelled'|'completed'|'no_show') { return { confirmed: 'Potvrđen', cancelled: 'Otkazan', completed: 'Završen', no_show: 'Nije došao' }[status]; }
