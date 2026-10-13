import type { Booking, BookingListFilters, BookingStatus } from '@studio/contracts';
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, LoadingState, PageHeader, Select, buttonStyles, useToast } from '@studio/ui';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useOutletContext } from 'react-router';
import { cancelBooking, fetchBookings, updateBookingStatus } from '../../features/bookings/booking-api';
import type { StudioViewerContext } from '../../features/studio/types';
import { useAsync } from '../../lib/useAsync';
import { usePageTitle } from '../../lib/usePageTitle';

const statusLabel = { confirmed: 'Potvrđen', cancelled: 'Otkazan', completed: 'Završen', no_show: 'Nije došao' } as const;
type StatusChange = { booking: Booking; status: 'completed' | 'no_show' };
type Filters = Omit<BookingListFilters, 'cursor'>;

export function BookingsPage() {
  usePageTitle('Rezervacije');
  const ctx = useOutletContext<StudioViewerContext>();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | BookingStatus>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filters, setFilters] = useState<Filters>({});
  const result = useAsync((signal) => fetchBookings(ctx.studio.slug, filters, signal), [ctx.studio.slug, filters]);
  const [additionalBookings, setAdditionalBookings] = useState<Booking[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [statusChange, setStatusChange] = useState<StatusChange | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const formatter = useMemo(() => new Intl.DateTimeFormat('hr-HR', {
    timeZone: ctx.studio.timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }), [ctx.studio.timezone]);
  const bookings = [...(result.data?.bookings ?? []), ...additionalBookings];

  useEffect(() => {
    setAdditionalBookings([]);
    setNextCursor(result.data?.nextCursor ?? null);
  }, [result.data]);

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setFilters({
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(status ? { status } : {}),
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {}),
    });
  }

  function resetFilters() {
    setSearch(''); setStatus(''); setFromDate(''); setToDate(''); setFilters({});
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await fetchBookings(ctx.studio.slug, { ...filters, cursor: nextCursor });
      setAdditionalBookings((current) => [...current, ...page.bookings]);
      setNextCursor(page.nextCursor);
    } catch (caught: unknown) {
      toast.error('Dodatne rezervacije nije moguće učitati', caught instanceof Error ? caught.message : undefined);
    } finally {
      setLoadingMore(false);
    }
  }

  async function cancel(booking: Booking) {
    setCancelling(booking.id);
    try {
      await cancelBooking(ctx.studio.slug, booking.id);
      toast.success('Termin je otkazan.');
      result.reload();
    } catch (caught: unknown) {
      toast.error('Otkazivanje nije uspjelo', caught instanceof Error ? caught.message : undefined);
    } finally {
      setCancelling(null);
    }
  }

  async function confirmStatusChange() {
    if (!statusChange) return;
    setUpdatingStatus(true);
    try {
      await updateBookingStatus(ctx.studio.slug, statusChange.booking.id, statusChange.status);
      toast.success(statusChange.status === 'completed' ? 'Termin je označen kao završen.' : 'Termin je označen kao nedolazak.');
      setStatusChange(null);
      result.reload();
    } catch (caught: unknown) {
      toast.error('Promjena statusa nije uspjela', caught instanceof Error ? caught.message : undefined);
    } finally {
      setUpdatingStatus(false);
    }
  }

  return (
    <>
      <PageHeader title={ctx.membership.role === 'artist' ? 'Moji termini' : 'Rezervacije'} description="Potvrđeni, završeni i otkazani termini studija." actions={ctx.membership.role !== 'artist' ? <Link className={buttonStyles()} to={`/app/${ctx.studio.slug}/termini/nova`}>Nova rezervacija</Link> : undefined} />
      <Card className="mb-5">
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(12rem,1fr)_11rem_10rem_10rem_auto] xl:items-end" onSubmit={applyFilters}>
          <Field label={ctx.membership.role === 'artist' ? 'Pretraži uslugu' : 'Artist ili usluga'}><Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={ctx.membership.role === 'artist' ? 'Snimanje, mix…' : 'Ime, e-mail, usluga…'} maxLength={100} /></Field>
          <Field label="Status"><Select value={status} onChange={(event) => setStatus(event.target.value as '' | BookingStatus)}><option value="">Svi statusi</option><option value="confirmed">Potvrđeni</option><option value="completed">Završeni</option><option value="cancelled">Otkazani</option><option value="no_show">Nije došao</option></Select></Field>
          <Field label="Od datuma"><Input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} /></Field>
          <Field label="Do datuma"><Input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} /></Field>
          <div className="flex gap-2"><Button type="submit">Filtriraj</Button><Button variant="ghost" onClick={resetFilters}>Očisti</Button></div>
        </form>
      </Card>
      {result.status === 'loading' && !result.data ? <LoadingState variant="rows" rows={4} /> : null}
      {result.status === 'error' ? <Alert tone="danger">Rezervacije trenutno nije moguće učitati.</Alert> : null}
      {result.status === 'success' && bookings.length === 0 ? <Card padded={false}><EmptyState size="compact" icon="bookings" title="Nema rezervacija za odabrane filtre" /></Card> : null}
      <div className="space-y-3">
        {bookings.map((booking) => {
          const canManage = ctx.membership.role === 'owner' || ctx.membership.role === 'manager';
          const now = Date.now();
          const hasStarted = new Date(booking.startAtUtc).getTime() <= now;
          const hasEnded = new Date(booking.endAtUtc).getTime() <= now;
          return (
          <Card key={booking.id} className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg">{booking.serviceName}</h2><Badge tone={booking.status === 'confirmed' ? 'success' : 'neutral'}>{statusLabel[booking.status]}</Badge></div>
              <p className="mt-2 text-sm text-ink-muted">{formatter.format(new Date(booking.startAtUtc))} · {booking.durationMinutes} min</p>
              <p className="mt-1 text-sm text-ink-subtle">{new Intl.NumberFormat('hr-HR', { style: 'currency', currency: booking.currency }).format(booking.priceMinor / 100)}</p>
              {ctx.membership.role !== 'artist' && booking.artistName ? <p className="mt-1 text-xs text-ink-subtle">{booking.artistName} · {booking.artistEmail}</p> : null}
            </div>
            {canManage || booking.status === 'confirmed' ? <div className="flex flex-wrap gap-2">
              {canManage ? <Link className={buttonStyles({ variant: 'secondary' })} to={`/app/${ctx.studio.slug}/termini/${booking.id}`}>Detalji</Link> : null}
              {canManage && hasEnded ? <Button onClick={() => setStatusChange({ booking, status: 'completed' })}>Završen</Button> : null}
              {canManage && hasStarted ? <Button variant="secondary" onClick={() => setStatusChange({ booking, status: 'no_show' })}>Nije došao</Button> : null}
              {booking.status === 'confirmed' ? <Button variant="secondary" loading={cancelling === booking.id} onClick={() => void cancel(booking)}>Otkaži termin</Button> : null}
            </div> : null}
          </Card>
          );
        })}
      </div>
      {nextCursor ? <div className="mt-6 flex justify-center"><Button variant="secondary" loading={loadingMore} onClick={() => void loadMore()}>Učitaj još</Button></div> : null}
      <ConfirmDialog
        open={statusChange !== null}
        onClose={() => setStatusChange(null)}
        onConfirm={() => void confirmStatusChange()}
        loading={updatingStatus}
        title={statusChange?.status === 'completed' ? 'Označiti termin kao završen?' : 'Označiti da artist nije došao?'}
        description="Promjena će biti trajno zabilježena u povijesti termina."
        confirmLabel="Potvrdi status"
      />
    </>
  );
}
