import type { Booking, BookingTimelineEntry } from '@studio/contracts';
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, LoadingState, PageHeader, Textarea, buttonStyles, useToast } from '@studio/ui';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useOutletContext, useParams } from 'react-router';
import { createBookingNote, fetchBookingDetail, fetchBookingRescheduleAvailability, rescheduleBooking } from '../../features/bookings/booking-api';
import type { StudioViewerContext } from '../../features/studio/types';
import { useAsync } from '../../lib/useAsync';
import { usePageTitle } from '../../lib/usePageTitle';

const statusLabel = { confirmed: 'Potvrđen', cancelled: 'Otkazan', completed: 'Završen', no_show: 'Nije došao' } as const;
const eventLabel = { created: 'Termin je kreiran', cancelled: 'Termin je otkazan', completed: 'Termin je završen', no_show: 'Artist nije došao', rescheduled: 'Termin je pomaknut' } as const;

function localDate(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function BookingDetailPage() {
  usePageTitle('Detalji termina');
  const ctx = useOutletContext<StudioViewerContext>();
  const { bookingId = '' } = useParams();
  const toast = useToast();
  const result = useAsync((signal) => fetchBookingDetail(ctx.studio.slug, bookingId, signal), [ctx.studio.slug, bookingId]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const dateTime = useMemo(() => new Intl.DateTimeFormat('hr-HR', {
    timeZone: ctx.studio.timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }), [ctx.studio.timezone]);
  const money = useMemo(() => new Intl.NumberFormat('hr-HR', {
    style: 'currency',
    currency: ctx.studio.currency,
  }), [ctx.studio.currency]);

  async function submitNote(event: FormEvent) {
    event.preventDefault();
    const body = note.trim();
    if (!body) return;
    setSaving(true);
    try {
      await createBookingNote(ctx.studio.slug, bookingId, body);
      setNote('');
      toast.success('Interna bilješka je spremljena.');
      result.reload();
    } catch (caught: unknown) {
      toast.error('Bilješka nije spremljena', caught instanceof Error ? caught.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  if (result.status === 'loading' && !result.data) return <LoadingState variant="rows" rows={4} />;
  if (result.status === 'error' || !result.data) return <EmptyState icon="alert" title="Termin nije moguće učitati" action={<Link className={buttonStyles({ variant: 'secondary' })} to={`/app/${ctx.studio.slug}/termini`}>Natrag na rezervacije</Link>} />;
  const { booking, timeline } = result.data;
  return <>
    <PageHeader eyebrow="Detalji termina" title={booking.serviceName} description={`${dateTime.format(new Date(booking.startAtUtc))} · ${booking.durationMinutes} min`} actions={<Link className={buttonStyles({ variant: 'secondary' })} to={`/app/${ctx.studio.slug}/termini`}>Natrag</Link>} />
    {result.status === 'loading' ? <Alert className="mb-4">Osvježavanje povijesti…</Alert> : null}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Artist</p><h2 className="mt-1 text-xl">{booking.artistName}</h2><p className="mt-1 text-sm text-ink-subtle">{booking.artistEmail}</p></div><Badge tone={booking.status === 'confirmed' ? 'success' : 'neutral'}>{statusLabel[booking.status]}</Badge></div>
          <dl className="mt-6 grid gap-4 border-t border-line pt-5 sm:grid-cols-3"><Detail label="Početak" value={dateTime.format(new Date(booking.startAtUtc))} /><Detail label="Završetak" value={dateTime.format(new Date(booking.endAtUtc))} /><Detail label="Cijena" value={money.format(booking.priceMinor / 100)} /></dl>
          {booking.promoCode ? <p className="mt-4 text-sm text-ink-subtle">Promo kod: <span className="font-medium text-ink">{booking.promoCode}</span> · popust {money.format(booking.discountMinor / 100)}</p> : null}
        </Card>
        {booking.status === 'confirmed' ? <ReschedulePanel booking={booking} ctx={ctx} onSaved={result.reload} /> : null}
        <Card>
          <h2 className="text-xl">Interna bilješka</h2><p className="mt-1 text-sm text-ink-subtle">Vidljiva je samo owneru i managerima studija.</p>
          <form className="mt-5" onSubmit={(event) => void submitNote(event)}><Field label="Nova bilješka" required><Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={4} /></Field><div className="mt-3 flex justify-end"><Button type="submit" loading={saving} disabled={!note.trim()}>Spremi bilješku</Button></div></form>
        </Card>
      </div>
      <Card><p className="eyebrow">Povijest</p><h2 className="mt-1 text-xl">Aktivnosti termina</h2><Timeline entries={timeline} format={dateTime} /></Card>
    </div>
  </>;
}

function ReschedulePanel({ booking, ctx, onSaved }: { booking: Booking; ctx: StudioViewerContext; onSaved: () => void }) {
  const toast = useToast();
  const today = localDate(new Date(), ctx.studio.timezone);
  const currentDate = localDate(new Date(booking.startAtUtc), ctx.studio.timezone);
  const [date, setDate] = useState(currentDate >= today ? currentDate : today);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const availability = useAsync((signal) => fetchBookingRescheduleAvailability(ctx.studio.slug, booking.id, date, signal), [ctx.studio.slug, booking.id, date]);
  const time = useMemo(() => new Intl.DateTimeFormat('hr-HR', { timeZone: ctx.studio.timezone, hour: '2-digit', minute: '2-digit' }), [ctx.studio.timezone]);
  const slots = availability.data?.slots.filter((slot) => slot.startAtUtc !== booking.startAtUtc) ?? [];

  async function confirm() {
    if (!selectedStart) return;
    setSaving(true);
    try {
      await rescheduleBooking(ctx.studio.slug, booking.id, selectedStart);
      toast.success('Termin je pomaknut.');
      setConfirming(false);
      setSelectedStart(null);
      onSaved();
    } catch (caught: unknown) {
      toast.error('Termin nije pomaknut', caught instanceof Error ? caught.message : undefined);
      setConfirming(false);
      setSelectedStart(null);
      availability.reload();
    } finally {
      setSaving(false);
    }
  }

  return <Card>
    <h2 className="text-xl">Pomakni termin</h2><p className="mt-1 text-sm text-ink-subtle">Odaberi novi slobodan termin. Trajanje, cijena i promo kod ostaju isti.</p>
    <div className="mt-5 max-w-xs"><Field label="Novi datum" required><Input type="date" min={today} value={date} onChange={(event) => { setDate(event.target.value); setSelectedStart(null); }} /></Field></div>
    {availability.status === 'loading' ? <LoadingState className="py-8" /> : null}
    {availability.status === 'error' ? <Alert tone="danger" className="mt-4">Slobodne termine trenutno nije moguće učitati.</Alert> : null}
    {availability.status === 'success' && !slots.length ? <EmptyState size="compact" icon="calendar" title="Nema drugih slobodnih termina" /> : null}
    {slots.length ? <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{slots.map((slot) => <button key={slot.startAtUtc} type="button" aria-pressed={selectedStart === slot.startAtUtc} onClick={() => setSelectedStart(slot.startAtUtc)} className="h-11 rounded-control bg-surface text-sm shadow-hairline hover:bg-accent-soft aria-pressed:bg-ink aria-pressed:text-ink-inverse">{time.format(new Date(slot.startAtUtc))}</button>)}</div> : null}
    <div className="mt-5 flex justify-end"><Button disabled={!selectedStart} onClick={() => setConfirming(true)}>Pomakni termin</Button></div>
    <ConfirmDialog open={confirming} onClose={() => setConfirming(false)} onConfirm={() => void confirm()} loading={saving} title="Potvrditi novi termin?" description={selectedStart ? `Novi početak: ${new Intl.DateTimeFormat('hr-HR', { timeZone: ctx.studio.timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(selectedStart))}.` : undefined} confirmLabel="Potvrdi pomicanje" />
  </Card>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs uppercase tracking-wide text-ink-subtle">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>;
}

function Timeline({ entries, format }: { entries: BookingTimelineEntry[]; format: Intl.DateTimeFormat }) {
  if (!entries.length) return <p className="mt-5 text-sm text-ink-subtle">Nema zabilježenih aktivnosti.</p>;
  return <ol className="mt-5 space-y-5 border-l border-line pl-5">{[...entries].reverse().map((entry) => <li key={entry.id} className="relative before:absolute before:-left-[1.43rem] before:top-1.5 before:size-2 before:rounded-full before:bg-accent">
    <p className="text-sm font-medium">{entry.kind === 'event' ? eventLabel[entry.eventType] : 'Interna bilješka'}</p>
    {entry.kind === 'note' ? <p className="mt-2 whitespace-pre-wrap text-sm text-ink-muted">{entry.body}</p> : null}
    <p className="mt-1 text-xs text-ink-subtle">{entry.actorName ?? 'Sustav'} · {format.format(new Date(entry.createdAt))}</p>
  </li>)}</ol>;
}
