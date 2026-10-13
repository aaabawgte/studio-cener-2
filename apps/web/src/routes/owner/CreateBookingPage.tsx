import { Alert, Button, Card, EmptyState, Field, Input, LoadingState, PageHeader, Select, useToast } from '@studio/ui';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router';
import { createManagedBooking, fetchBookingArtists, fetchBookingAvailability } from '../../features/bookings/booking-api';
import { fetchPublicStudio } from '../../features/catalog/catalog-api';
import { fetchValueAccount } from '../../features/value/value-api';
import type { StudioViewerContext } from '../../features/studio/types';
import { useAsync } from '../../lib/useAsync';
import { usePageTitle } from '../../lib/usePageTitle';

function localDate(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts();
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function CreateBookingPage() {
  usePageTitle('Nova rezervacija'); const ctx = useOutletContext<StudioViewerContext>(); const toast = useToast(); const navigate = useNavigate();
  const catalog = useAsync((signal) => fetchPublicStudio(ctx.studio.slug, signal), [ctx.studio.slug]);
  const artists = useAsync((signal) => fetchBookingArtists(ctx.studio.slug, signal), [ctx.studio.slug]);
  const [artistUserId, setArtistUserId] = useState(''); const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState(() => localDate(ctx.studio.timezone)); const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  const [paymentChoice, setPaymentChoice] = useState('none');
  useEffect(() => { if (!artistUserId && artists.data?.artists[0]) setArtistUserId(artists.data.artists[0].userId); }, [artistUserId, artists.data]);
  useEffect(() => { if (!serviceId && catalog.data?.services[0]) setServiceId(catalog.data.services[0].id); }, [serviceId, catalog.data]);
  const availability = useAsync((signal) => serviceId ? fetchBookingAvailability(ctx.studio.slug, serviceId, date, signal)
    : Promise.resolve({ date, timezone: ctx.studio.timezone, serviceId: '', durationMinutes: 0, slots: [] }), [ctx.studio.slug, serviceId, date]);
  const valueAccount = useAsync((signal) => artistUserId ? fetchValueAccount(ctx.studio.slug, artistUserId, signal) : Promise.resolve(null), [ctx.studio.slug, artistUserId]);
  const service = catalog.data?.services.find((item) => item.id === serviceId);
  const time = useMemo(() => new Intl.DateTimeFormat('hr-HR', { timeZone: ctx.studio.timezone, hour: '2-digit', minute: '2-digit' }), [ctx.studio.timezone]);
  async function submit() {
    if (!artistUserId || !serviceId || !selectedStart) return; setSaving(true); setError(null);
    try { const packageBalanceId = paymentChoice.startsWith('package:') ? paymentChoice.slice('package:'.length) : undefined; await createManagedBooking(ctx.studio.slug, { artistUserId, serviceId, startAtUtc: selectedStart, paymentMethod: paymentChoice === 'credit' ? 'credit' : packageBalanceId ? 'package' : 'none', ...(packageBalanceId ? { packageBalanceId } : {}) }, crypto.randomUUID()); toast.success('Rezervacija je kreirana.'); await navigate(`/app/${ctx.studio.slug}/termini`); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Rezervaciju nije moguće kreirati.'); availability.reload(); setSelectedStart(null); }
    finally { setSaving(false); }
  }
  return <><PageHeader title="Nova rezervacija" description="Kreirajte termin za postojećeg artista studija." />{error ? <Alert tone="danger" className="mb-5">{error}</Alert> : null}
    {!artists.data?.artists.length && artists.status === 'success' ? <Card padded={false}><EmptyState icon="user" title="Nema registriranih artista" description="Artist se prvo mora registrirati i pridružiti studiju." /></Card> : <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"><Card><div className="grid gap-5 sm:grid-cols-3"><Field label="Artist" required><Select value={artistUserId} onChange={(event) => { setArtistUserId(event.target.value); setPaymentChoice('none'); }}>{artists.data?.artists.map((artist) => <option key={artist.userId} value={artist.userId}>{artist.name} · {artist.email}</option>)}</Select></Field><Field label="Usluga" required><Select value={serviceId} onChange={(event) => { setServiceId(event.target.value); setSelectedStart(null); setPaymentChoice('none'); }}>{catalog.data?.services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field><Field label="Datum" required><Input type="date" min={localDate(ctx.studio.timezone)} value={date} onChange={(event) => { setDate(event.target.value); setSelectedStart(null); }} /></Field></div><h2 className="mt-8 text-xl">Slobodni termini</h2>{availability.status === 'loading' ? <LoadingState className="py-10" /> : null}{availability.data?.slots.length ? <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{availability.data.slots.map((slot) => <button key={slot.startAtUtc} type="button" aria-pressed={selectedStart === slot.startAtUtc} onClick={() => setSelectedStart(slot.startAtUtc)} className="h-11 rounded-control bg-surface text-sm shadow-hairline hover:bg-accent-soft aria-pressed:bg-ink aria-pressed:text-ink-inverse">{time.format(new Date(slot.startAtUtc))}</button>)}</div> : availability.status === 'success' ? <EmptyState size="compact" icon="calendar" title="Nema slobodnih termina" /> : null}</Card>
      <Card className="h-fit"><p className="eyebrow">Sažetak</p><h2 className="mt-3 text-xl">{service?.name ?? 'Odaberite uslugu'}</h2><dl className="mt-5 space-y-3 text-sm"><div className="flex justify-between"><dt className="text-ink-subtle">Artist</dt><dd className="max-w-40 truncate">{artists.data?.artists.find((item) => item.userId === artistUserId)?.name ?? '—'}</dd></div><div className="flex justify-between"><dt className="text-ink-subtle">Trajanje</dt><dd>{service ? `${service.durationMinutes} min` : '—'}</dd></div><div className="flex justify-between"><dt className="text-ink-subtle">Cijena</dt><dd>{service ? new Intl.NumberFormat('hr-HR', { style: 'currency', currency: service.currency }).format(service.priceMinor / 100) : '—'}</dd></div><div className="flex justify-between"><dt className="text-ink-subtle">Vrijeme</dt><dd>{selectedStart ? time.format(new Date(selectedStart)) : '—'}</dd></div></dl><div className="mt-5"><Field label="Iskoristi pri rezervaciji"><Select value={paymentChoice} onChange={(event) => setPaymentChoice(event.target.value)}><option value="none">Bez kredita ili paketa</option><option value="credit" disabled={!valueAccount.data || !service || valueAccount.data.creditBalanceMinor < service.priceMinor}>Prepaid kredit {valueAccount.data ? `· ${new Intl.NumberFormat('hr-HR', { style: 'currency', currency: valueAccount.data.currency }).format(valueAccount.data.creditBalanceMinor / 100)}` : ''}</option>{valueAccount.data?.packageBalances.map((balance) => <option key={balance.id} value={`package:${balance.id}`} disabled={balance.status !== 'active' || !service || balance.remainingMinutes < service.durationMinutes}>{balance.packageName} · {balance.remainingMinutes} min</option>)}</Select></Field></div><Button fullWidth className="mt-6" disabled={!artistUserId || !selectedStart} loading={saving} onClick={() => void submit()}>Potvrdi rezervaciju</Button><p className="mt-3 text-xs text-ink-subtle">Radnja se bilježi pod vašim korisničkim računom.</p></Card></div>}
  </>;
}
