import { Alert, Button, Card, EmptyState, Field, Input, LoadingState, PageHeader, Select, useToast } from '@studio/ui';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router';
import { createBooking, fetchBookingAvailability } from '../../features/bookings/booking-api';
import { fetchPublicStudio } from '../../features/catalog/catalog-api';
import type { StudioViewerContext } from '../../features/studio/types';
import { useAsync } from '../../lib/useAsync';
import { usePageTitle } from '../../lib/usePageTitle';

function dateInTimezone(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts();
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function BookingPage() {
  usePageTitle('Rezerviraj');
  const ctx = useOutletContext<StudioViewerContext>();
  const navigate = useNavigate();
  const toast = useToast();
  const catalog = useAsync((signal) => fetchPublicStudio(ctx.studio.slug, signal), [ctx.studio.slug]);
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState(() => dateInTimezone(ctx.studio.timezone));
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!serviceId && catalog.data?.services[0]) setServiceId(catalog.data.services[0].id);
  }, [catalog.data, serviceId]);

  const availability = useAsync(
    (signal) => serviceId
      ? fetchBookingAvailability(ctx.studio.slug, serviceId, date, signal)
      : Promise.resolve({ date, timezone: ctx.studio.timezone, serviceId: '', durationMinutes: 0, slots: [] }),
    [ctx.studio.slug, serviceId, date],
  );
  const selectedService = catalog.data?.services.find((service) => service.id === serviceId);

  const timeFormatter = useMemo(() => new Intl.DateTimeFormat('hr-HR', {
    timeZone: ctx.studio.timezone,
    hour: '2-digit',
    minute: '2-digit',
  }), [ctx.studio.timezone]);

  async function confirm() {
    if (!selectedStart) return;
    setSubmitting(true);
    setError(null);
    try {
      await createBooking(ctx.studio.slug, { serviceId, startAtUtc: selectedStart }, crypto.randomUUID());
      toast.success('Termin je potvrđen.');
      await navigate(`/s/${ctx.studio.slug}/me/termini`);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Rezervacija nije uspjela.');
      availability.reload();
      setSelectedStart(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader title="Rezerviraj termin" description="Odaberite uslugu i jedan od trenutno slobodnih termina." />
      {error ? <Alert tone="danger" className="mb-5">{error}</Alert> : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Usluga" required>
              <Select value={serviceId} onChange={(event) => { setServiceId(event.target.value); setSelectedStart(null); }} disabled={catalog.status !== 'success'}>
                {catalog.data?.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
              </Select>
            </Field>
            <Field label="Datum" required>
              <Input type="date" min={dateInTimezone(ctx.studio.timezone)} value={date} onChange={(event) => { setDate(event.target.value); setSelectedStart(null); }} />
            </Field>
          </div>

          <h2 className="mt-8 text-xl">Slobodni termini</h2>
          {availability.status === 'loading' ? <LoadingState className="py-10" /> : null}
          {availability.status === 'error' ? <Alert tone="danger" className="mt-4">Termine trenutno nije moguće učitati.</Alert> : null}
          {availability.status === 'success' && availability.data?.slots.length === 0 ? (
            <EmptyState size="compact" icon="calendar" title="Nema slobodnih termina" description="Odaberite drugi datum." />
          ) : null}
          {availability.status === 'success' && availability.data?.slots.length ? (
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {availability.data.slots.map((slot) => (
                <button
                  key={slot.startAtUtc}
                  type="button"
                  onClick={() => setSelectedStart(slot.startAtUtc)}
                  aria-pressed={selectedStart === slot.startAtUtc}
                  className="h-11 rounded-control bg-surface text-sm tabular shadow-hairline transition-colors hover:bg-accent-soft aria-pressed:bg-ink aria-pressed:text-ink-inverse"
                >
                  {timeFormatter.format(new Date(slot.startAtUtc))}
                </button>
              ))}
            </div>
          ) : null}
        </Card>

        <Card className="h-fit lg:sticky lg:top-8">
          <p className="eyebrow">Sažetak</p>
          <h2 className="mt-3 text-xl">{selectedService?.name ?? 'Odaberite uslugu'}</h2>
          {selectedService ? (
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-ink-subtle">Trajanje</dt><dd>{selectedService.durationMinutes} min</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-subtle">Cijena</dt><dd>{new Intl.NumberFormat('hr-HR', { style: 'currency', currency: selectedService.currency }).format(selectedService.priceMinor / 100)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-subtle">Vrijeme</dt><dd>{selectedStart ? timeFormatter.format(new Date(selectedStart)) : '—'}</dd></div>
            </dl>
          ) : null}
          <Button fullWidth className="mt-6" disabled={!selectedStart} loading={submitting} onClick={() => void confirm()}>Potvrdi termin</Button>
          <p className="mt-3 text-xs text-ink-subtle">Termin se potvrđuje odmah. Nema online naplate.</p>
        </Card>
      </div>
    </>
  );
}
