import type { AnalyticsRange, StudioAnalytics } from '@studio/contracts';
import { Card, EmptyState, PageHeader, Select, Stat } from '@studio/ui';
import { useState } from 'react';
import { useOutletContext } from 'react-router';
import { fetchStudioAnalytics } from '../../features/analytics/analytics-api';
import type { StudioViewerContext } from '../../features/studio/types';
import { useAsync } from '../../lib/useAsync';
import { usePageTitle } from '../../lib/usePageTitle';

export function AnalyticsPage() {
  usePageTitle('Analitika'); const ctx = useOutletContext<StudioViewerContext>(); const [range, setRange] = useState<AnalyticsRange>('30d');
  const state = useAsync((signal) => fetchStudioAnalytics(ctx.studio.slug, range, signal), [ctx.studio.slug, range]);
  return <><PageHeader title="Analitika" description="Pregled rezervacija, vrijednosti i iskorištenosti radnog vremena." actions={<label className="block"><span className="sr-only">Razdoblje</span><Select value={range} onChange={(event) => setRange(event.target.value as AnalyticsRange)}><option value="30d">Zadnjih 30 dana</option><option value="90d">Zadnjih 90 dana</option><option value="365d">Zadnjih 365 dana</option></Select></label>} />
    {state.data ? <AnalyticsContent data={state.data} /> : state.status === 'error' ? <EmptyState icon="alert" title="Analitiku nije moguće učitati" /> : <p className="text-sm text-ink-subtle">Učitavanje…</p>}
  </>;
}

function AnalyticsContent({ data }: { data: StudioAnalytics }) {
  const money = (minor: number) => new Intl.NumberFormat('hr-HR', { style: 'currency', currency: data.currency, maximumFractionDigits: 0 }).format(minor / 100);
  return <div className="space-y-7"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Card><Stat label="Rezervacije" value={data.summary.totalBookings} hint={`${data.summary.cancelledBookings} otkazano`} /></Card><Card><Stat label="Vrijednost rezervacija" value={money(data.summary.bookingValueMinor)} hint="Bez online naplate" /></Card><Card><Stat label="Popunjenost" value={`${formatNumber(data.summary.utilizationPercent)}%`} hint={`${formatHours(data.summary.bookedMinutes)} od ${formatHours(data.summary.availableMinutes)}`} /></Card><Card><Stat label="Povratni artisti" value={data.summary.returningArtists} hint={`${data.summary.uniqueArtists} jedinstvenih artista`} /></Card></div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]"><TrendChart data={data} /><TopServices data={data} money={money} /></div>
    <Card><h2 className="text-xl">Status rezervacija</h2><div className="mt-5 grid grid-cols-3 gap-4"><Stat label="Potvrđene" value={data.summary.confirmedBookings} /><Stat label="Završene" value={data.summary.completedBookings} /><Stat label="Otkazane" value={data.summary.cancelledBookings} /></div></Card>
  </div>;
}

function TrendChart({ data }: { data: StudioAnalytics }) {
  const points = data.daily.slice(-30); const max = Math.max(1, ...points.map((item) => item.bookedMinutes));
  return <Card><div className="flex items-end justify-between gap-4"><div><p className="eyebrow">Dnevni trend</p><h2 className="mt-1 text-xl">Rezervirani sati</h2></div><p className="text-xs text-ink-subtle">Zadnjih {points.length} dana</p></div><div className="mt-7 flex h-52 items-end gap-1" role="img" aria-label="Stupčasti prikaz rezerviranih sati po danu">{points.map((point) => <div key={point.date} className="group relative flex h-full min-w-0 flex-1 items-end"><div className="w-full rounded-t-sm bg-accent/70 transition-colors group-hover:bg-accent" style={{ height: `${Math.max(point.bookedMinutes ? 4 : 1, point.bookedMinutes / max * 100)}%` }} /><span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-2 py-1 text-xs text-ink-inverse group-hover:block">{new Intl.DateTimeFormat('hr-HR', { day: 'numeric', month: 'short' }).format(new Date(`${point.date}T12:00:00`))}: {formatHours(point.bookedMinutes)}</span></div>)}</div><div className="mt-3 flex justify-between text-xs text-ink-subtle"><span>{shortDate(points[0]?.date)}</span><span>{shortDate(points.at(-1)?.date)}</span></div></Card>;
}

function TopServices({ data, money }: { data: StudioAnalytics; money: (minor: number) => string }) {
  const max = Math.max(1, ...data.topServices.map((item) => item.bookings));
  return <Card><p className="eyebrow">Usluge</p><h2 className="mt-1 text-xl">Najtraženije</h2>{data.topServices.length ? <div className="mt-6 space-y-5">{data.topServices.map((item) => <div key={item.serviceId}><div className="mb-2 flex justify-between gap-4 text-sm"><span className="truncate font-medium">{item.serviceName}</span><span className="shrink-0 text-ink-subtle">{item.bookings} · {money(item.valueMinor)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-accent" style={{ width: `${item.bookings / max * 100}%` }} /></div></div>)}</div> : <EmptyState size="compact" icon="chart" title="Još nema rezervacija" />}</Card>;
}

function formatHours(minutes: number) { return `${new Intl.NumberFormat('hr-HR', { maximumFractionDigits: 1 }).format(minutes / 60)} h`; }
function formatNumber(value: number) { return new Intl.NumberFormat('hr-HR', { maximumFractionDigits: 1 }).format(value); }
function shortDate(value?: string) { return value ? new Intl.DateTimeFormat('hr-HR', { day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`)) : ''; }
