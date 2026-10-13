import type { BlockedSlot, BlockedSlotCreate, Booking, BookingAvailability, BookingCreate } from '@studio/contracts';

let bookings: Booking[] = [];
let blockedSlots: BlockedSlot[] = [];

function wait(signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, 180);
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

export async function mockBookingAvailability(serviceId: string, date: string, signal?: AbortSignal): Promise<BookingAvailability> {
  await wait(signal);
  const starts = [10, 12, 14, 16].map((hour) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+02:00`));
  return {
    date,
    timezone: 'Europe/Zagreb',
    serviceId,
    durationMinutes: 120,
    slots: starts
      .filter((start) => start.getTime() > Date.now() && !bookings.some((booking) => booking.status === 'confirmed' && booking.startAtUtc === start.toISOString()))
      .map((start) => ({ startAtUtc: start.toISOString(), endAtUtc: new Date(start.getTime() + 120 * 60_000).toISOString() })),
  };
}

export async function mockCreateBooking(input: BookingCreate): Promise<Booking> {
  await wait();
  const start = new Date(input.startAtUtc);
  const booking: Booking = {
    id: crypto.randomUUID(),
    studioId: 'studio-demo',
    resourceId: 'main:studio-demo',
    artistUserId: 'user-demo',
    serviceId: input.serviceId,
    startAtUtc: start.toISOString(),
    endAtUtc: new Date(start.getTime() + 120 * 60_000).toISOString(),
    status: 'confirmed',
    serviceName: input.serviceId === 'demo-mix' ? 'Mix' : 'Snimanje vokala',
    durationMinutes: 120,
    priceMinor: input.serviceId === 'demo-mix' ? 15000 : 9000,
    subtotalPriceMinor: input.serviceId === 'demo-mix' ? 15000 : 9000,
    discountMinor: 0,
    promoCode: null,
    artistName: null,
    artistEmail: null,
    currency: 'EUR',
    createdAt: new Date().toISOString(),
  };
  bookings = [booking, ...bookings];
  return structuredClone(booking);
}

export async function mockBookings(signal?: AbortSignal) {
  await wait(signal);
  return { bookings: structuredClone(bookings) };
}

export async function mockCancelBooking(id: string): Promise<Booking> {
  await wait();
  const booking = bookings.find((item) => item.id === id);
  if (!booking) throw new Error('Rezervacija nije pronađena.');
  const cancelled: Booking = { ...booking, status: 'cancelled' };
  bookings = bookings.map((item) => item.id === id ? cancelled : item);
  return structuredClone(cancelled);
}

export async function mockBlockedSlots(signal?: AbortSignal) {
  await wait(signal);
  return { blockedSlots: structuredClone(blockedSlots) };
}

export async function mockCreateBlockedSlot(input: BlockedSlotCreate): Promise<BlockedSlot> {
  await wait();
  const block: BlockedSlot = {
    id: crypto.randomUUID(),
    studioId: 'studio-demo',
    resourceId: 'main:studio-demo',
    startAtUtc: new Date(input.startLocal).toISOString(),
    endAtUtc: new Date(input.endLocal).toISOString(),
    reason: input.reason,
    createdAt: new Date().toISOString(),
  };
  blockedSlots = [...blockedSlots, block].sort((a, b) => a.startAtUtc.localeCompare(b.startAtUtc));
  return structuredClone(block);
}

export async function mockDeleteBlockedSlot(id: string): Promise<void> {
  await wait();
  blockedSlots = blockedSlots.filter((item) => item.id !== id);
}
