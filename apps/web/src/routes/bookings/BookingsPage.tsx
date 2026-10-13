import type { Booking } from '@studio/contracts';
import { Alert, Badge, Button, Card, EmptyState, LoadingState, PageHeader, buttonStyles, useToast } from '@studio/ui';
import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router';
import { cancelBooking, fetchBookings } from '../../features/bookings/booking-api';
import type { StudioViewerContext } from '../../features/studio/types';
import { useAsync } from '../../lib/useAsync';
import { usePageTitle } from '../../lib/usePageTitle';

const statusLabel = { confirmed: 'Potvrđen', cancelled: 'Otkazan', completed: 'Završen', no_show: 'Nije došao' } as const;

export function BookingsPage() {
  usePageTitle('Rezervacije');
  const ctx = useOutletContext<StudioViewerContext>();
  const toast = useToast();
  const result = useAsync((signal) => fetchBookings(ctx.studio.slug, signal), [ctx.studio.slug]);
  const [cancelling, setCancelling] = useState<string | null>(null);
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

  return (
    <>
      <PageHeader title={ctx.membership.role === 'artist' ? 'Moji termini' : 'Rezervacije'} description="Potvrđeni, završeni i otkazani termini studija." actions={ctx.membership.role !== 'artist' ? <Link className={buttonStyles()} to={`/app/${ctx.studio.slug}/termini/nova`}>Nova rezervacija</Link> : undefined} />
      {result.status === 'loading' ? <LoadingState variant="rows" rows={4} /> : null}
      {result.status === 'error' ? <Alert tone="danger">Rezervacije trenutno nije moguće učitati.</Alert> : null}
      {result.data?.bookings.length === 0 ? <Card padded={false}><EmptyState size="compact" icon="bookings" title="Još nema rezervacija" /></Card> : null}
      <div className="space-y-3">
        {result.data?.bookings.map((booking) => (
          <Card key={booking.id} className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg">{booking.serviceName}</h2><Badge tone={booking.status === 'confirmed' ? 'success' : 'neutral'}>{statusLabel[booking.status]}</Badge></div>
              <p className="mt-2 text-sm text-ink-muted">{formatter.format(new Date(booking.startAtUtc))} · {booking.durationMinutes} min</p>
              <p className="mt-1 text-sm text-ink-subtle">{new Intl.NumberFormat('hr-HR', { style: 'currency', currency: booking.currency }).format(booking.priceMinor / 100)}</p>
              {ctx.membership.role !== 'artist' && booking.artistName ? <p className="mt-1 text-xs text-ink-subtle">{booking.artistName} · {booking.artistEmail}</p> : null}
            </div>
            {booking.status === 'confirmed' ? <Button variant="secondary" loading={cancelling === booking.id} onClick={() => void cancel(booking)}>Otkaži termin</Button> : null}
          </Card>
        ))}
      </div>
    </>
  );
}
