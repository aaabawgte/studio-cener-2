import type { Booking } from '@studio/contracts';
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, LoadingState, PageHeader, buttonStyles, useToast } from '@studio/ui';
import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router';
import { cancelBooking, fetchBookings, updateBookingStatus } from '../../features/bookings/booking-api';
import type { StudioViewerContext } from '../../features/studio/types';
import { useAsync } from '../../lib/useAsync';
import { usePageTitle } from '../../lib/usePageTitle';

const statusLabel = { confirmed: 'Potvrđen', cancelled: 'Otkazan', completed: 'Završen', no_show: 'Nije došao' } as const;
type StatusChange = { booking: Booking; status: 'completed' | 'no_show' };

export function BookingsPage() {
  usePageTitle('Rezervacije');
  const ctx = useOutletContext<StudioViewerContext>();
  const toast = useToast();
  const result = useAsync((signal) => fetchBookings(ctx.studio.slug, signal), [ctx.studio.slug]);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [statusChange, setStatusChange] = useState<StatusChange | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const formatter = useMemo(() => new Intl.DateTimeFormat('hr-HR', {
    timeZone: ctx.studio.timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }), [ctx.studio.timezone]);

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
      {result.status === 'loading' ? <LoadingState variant="rows" rows={4} /> : null}
      {result.status === 'error' ? <Alert tone="danger">Rezervacije trenutno nije moguće učitati.</Alert> : null}
      {result.data?.bookings.length === 0 ? <Card padded={false}><EmptyState size="compact" icon="bookings" title="Još nema rezervacija" /></Card> : null}
      <div className="space-y-3">
        {result.data?.bookings.map((booking) => {
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
