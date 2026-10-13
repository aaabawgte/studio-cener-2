import type { BlockedSlot, BlockedSlotCreate, Booking, BookingAvailability, BookingCreate, ManagedBookingCreate, PromoQuote, PromoQuoteRequest, ValueArtist } from '@studio/contracts';
import { apiFetch } from '../../lib/api/client';
import { USE_MOCKS } from '../../lib/env';

export async function joinStudioAsArtist(slug: string) {
  if (USE_MOCKS) return { joined: true };
  return apiFetch<{ joined: true }>(`/api/studios/${encodeURIComponent(slug)}/artist-membership`, { method: 'POST', body: {} });
}

export async function fetchBookingAvailability(slug: string, serviceId: string, date: string, signal?: AbortSignal) {
  if (USE_MOCKS) return (await import('../../mocks/bookings')).mockBookingAvailability(serviceId, date, signal);
  const query = new URLSearchParams({ serviceId, date });
  return apiFetch<BookingAvailability>(`/api/public/studios/${encodeURIComponent(slug)}/booking-availability?${query}`, { signal });
}

export async function createBooking(slug: string, input: BookingCreate, idempotencyKey: string) {
  if (USE_MOCKS) return (await import('../../mocks/bookings')).mockCreateBooking(input);
  return apiFetch<Booking>(`/api/studios/${encodeURIComponent(slug)}/bookings`, { method: 'POST', body: input, idempotencyKey });
}

export async function createManagedBooking(slug: string, input: ManagedBookingCreate, idempotencyKey: string) {
  return apiFetch<Booking>(`/api/studios/${encodeURIComponent(slug)}/bookings/managed`, { method: 'POST', body: input, idempotencyKey });
}

export async function fetchBookingArtists(slug: string, signal?: AbortSignal) {
  return apiFetch<{ artists: ValueArtist[] }>(`/api/studios/${encodeURIComponent(slug)}/booking-artists`, { signal });
}

export async function validateBookingPromo(slug: string, input: PromoQuoteRequest) {
  return apiFetch<PromoQuote>(`/api/studios/${encodeURIComponent(slug)}/promo-codes/validate`, { method: 'POST', body: input });
}

export async function fetchBookings(slug: string, signal?: AbortSignal) {
  if (USE_MOCKS) return (await import('../../mocks/bookings')).mockBookings(signal);
  return apiFetch<{ bookings: Booking[] }>(`/api/studios/${encodeURIComponent(slug)}/bookings`, { signal });
}

export async function cancelBooking(slug: string, bookingId: string) {
  if (USE_MOCKS) return (await import('../../mocks/bookings')).mockCancelBooking(bookingId);
  return apiFetch<Booking>(`/api/studios/${encodeURIComponent(slug)}/bookings/${encodeURIComponent(bookingId)}/cancel`, { method: 'POST', body: {} });
}

export async function fetchBlockedSlots(slug: string, signal?: AbortSignal) {
  if (USE_MOCKS) return (await import('../../mocks/bookings')).mockBlockedSlots(signal);
  return apiFetch<{ blockedSlots: BlockedSlot[] }>(`/api/studios/${encodeURIComponent(slug)}/blocked-slots`, { signal });
}

export async function createBlockedSlot(slug: string, input: BlockedSlotCreate) {
  if (USE_MOCKS) return (await import('../../mocks/bookings')).mockCreateBlockedSlot(input);
  return apiFetch<BlockedSlot>(`/api/studios/${encodeURIComponent(slug)}/blocked-slots`, { method: 'POST', body: input });
}

export async function deleteBlockedSlot(slug: string, blockId: string) {
  if (USE_MOCKS) return (await import('../../mocks/bookings')).mockDeleteBlockedSlot(blockId);
  return apiFetch<void>(`/api/studios/${encodeURIComponent(slug)}/blocked-slots/${encodeURIComponent(blockId)}`, { method: 'DELETE' });
}
