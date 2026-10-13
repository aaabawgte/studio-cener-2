import {
  blockedSlotCreateSchema,
  blockedSlotSchema,
  bookingAvailabilitySchema,
  bookingCreateSchema,
  bookingDetailSchema,
  bookingListResponseSchema,
  bookingNoteCreateSchema,
  bookingRescheduleSchema,
  bookingStatusUpdateSchema,
  bookingStatusSchema,
  bookingTimelineEntrySchema,
  managedBookingCreateSchema,
  bookingSchema,
  valueArtistSchema,
  type ApiErrorBody,
  type Booking,
  type BookingCreate,
} from '@studio/contracts';
import { Temporal } from '@js-temporal/polyfill';
import type { Context } from 'hono';
import type { AuthBindings } from '../auth';
import { createAuth } from '../auth';
import { resolveStudioAccess, type StudioAccess } from '../authorization/studio-access';
import { permissionsForRole } from '../authorization/permissions';
import type { BookingCommand, StoredBlockedSlot, StoredBooking } from '../durable-objects/booking-coordinator';
import { resolvePromo } from '../promos/routes';
import { instantInTimezone, isBookableDate, localDateBounds, localMinuteToEpoch, weekdayForDate } from './time';

type ApiEnvironment = { Bindings: AuthBindings; Variables: { requestId: string } };
type ApiContext = Context<ApiEnvironment>;

type BookingSetup = {
  studio_id: string;
  timezone: string;
  currency: string;
  resource_id: string;
  service_id: string;
  service_name: string;
  duration_minutes: number;
  price_minor: number;
};

type RuleRow = { start_minute: number; end_minute: number };
type BusyRow = { start_at_utc: number; end_at_utc: number };
type RescheduleSetup = {
  id: string;
  studio_id: string;
  resource_id: string;
  service_id: string;
  duration_minutes_snapshot: number;
  status: string;
};

function param(context: ApiContext, name: string) {
  return context.req.param(name) ?? '';
}

function toBooking(row: StoredBooking & { artist_name?: string; artist_email?: string }): Booking {
  return bookingSchema.parse({
    id: row.id,
    studioId: row.studio_id,
    resourceId: row.resource_id,
    artistUserId: row.artist_user_id,
    serviceId: row.service_id,
    startAtUtc: new Date(row.start_at_utc).toISOString(),
    endAtUtc: new Date(row.end_at_utc).toISOString(),
    status: row.status,
    serviceName: row.service_name_snapshot,
    durationMinutes: row.duration_minutes_snapshot,
    priceMinor: row.price_minor_snapshot,
    subtotalPriceMinor: row.subtotal_price_minor_snapshot,
    discountMinor: row.discount_minor_snapshot,
    promoCode: row.promo_code_snapshot,
    artistName: row.artist_name ?? null,
    artistEmail: row.artist_email ?? null,
    currency: row.currency_snapshot,
    createdAt: new Date(row.created_at).toISOString(),
  });
}

function toBlockedSlot(row: StoredBlockedSlot) {
  return blockedSlotSchema.parse({
    id: row.id,
    studioId: row.studio_id,
    resourceId: row.resource_id,
    startAtUtc: new Date(row.start_at_utc).toISOString(),
    endAtUtc: new Date(row.end_at_utc).toISOString(),
    reason: row.reason,
    createdAt: new Date(row.created_at).toISOString(),
  });
}

async function getPrimaryResource(context: ApiContext, studioId: string) {
  return context.env.DB.prepare(
    `SELECT id FROM bookable_resources
     WHERE studio_id = ?1 AND status = 'active'
     ORDER BY sort_order, id LIMIT 1`,
  ).bind(studioId).first<{ id: string }>();
}

async function getSetup(context: ApiContext, slug: string, serviceId: string): Promise<BookingSetup | null> {
  return context.env.DB.prepare(
    `SELECT s.id AS studio_id, s.timezone, s.currency, br.id AS resource_id,
       sv.id AS service_id, sv.name AS service_name, sv.duration_minutes, sv.price_minor
     FROM studios s
     JOIN bookable_resources br ON br.studio_id = s.id AND br.status = 'active'
     JOIN services sv ON sv.studio_id = s.id AND sv.id = ?2 AND sv.status = 'active'
     JOIN studio_licenses sl ON sl.studio_id = s.id
       AND ((sl.status IN ('trial', 'active') AND sl.expires_at > ?3)
         OR (sl.status = 'grace' AND sl.grace_ends_at > ?3))
     WHERE s.slug = ?1 COLLATE NOCASE AND s.status = 'active'
     ORDER BY br.sort_order, br.id LIMIT 1`,
  ).bind(slug.trim().toLowerCase(), serviceId, Date.now()).first<BookingSetup>();
}

export async function getBookingAvailability(context: ApiContext) {
  const date = context.req.query('date') ?? '';
  const serviceId = context.req.query('serviceId') ?? '';
  let setup: BookingSetup | null;
  try {
    setup = await getSetup(context, param(context, 'slug'), serviceId);
    if (!setup || !isBookableDate(date, setup.timezone)) {
      return context.json<ApiErrorBody>({ code: 'INVALID_AVAILABILITY_REQUEST', message: 'Datum ili usluga nisu dostupni.' }, 422);
    }
  } catch {
    return context.json<ApiErrorBody>({ code: 'INVALID_AVAILABILITY_REQUEST', message: 'Datum ili usluga nisu dostupni.' }, 422);
  }

  const weekday = weekdayForDate(date);
  const rules = await context.env.DB.prepare(
    `SELECT start_minute, end_minute FROM availability_rules
     WHERE studio_id = ?1 AND resource_id = ?2 AND weekday = ?3
     ORDER BY start_minute`,
  ).bind(setup.studio_id, setup.resource_id, weekday).all<RuleRow>();
  const bounds = localDateBounds(date, setup.timezone);
  const busyResult = await context.env.DB.prepare(
    `SELECT start_at_utc, end_at_utc FROM blocked_slots
     WHERE studio_id = ?1 AND resource_id = ?2 AND start_at_utc < ?4 AND end_at_utc > ?3
     UNION ALL
     SELECT start_at_utc, end_at_utc FROM bookings
     WHERE studio_id = ?1 AND resource_id = ?2 AND status = 'confirmed' AND start_at_utc < ?4 AND end_at_utc > ?3`,
  ).bind(setup.studio_id, setup.resource_id, bounds.start, bounds.end).all<BusyRow>();

  const now = Date.now();
  const slots: { startAtUtc: string; endAtUtc: string }[] = [];
  for (const rule of rules.results) {
    for (let minute = rule.start_minute; minute + setup.duration_minutes <= rule.end_minute; minute += 15) {
      try {
        const start = localMinuteToEpoch(date, minute, setup.timezone);
        const end = start + setup.duration_minutes * 60_000;
        if (start <= now) continue;
        if (busyResult.results.some((busy) => busy.start_at_utc < end && busy.end_at_utc > start)) continue;
        slots.push({ startAtUtc: new Date(start).toISOString(), endAtUtc: new Date(end).toISOString() });
      } catch {
        // Lokalno vrijeme ne postoji ili je dvostruko zbog DST prijelaza; ne nudimo ga.
      }
    }
  }

  return context.json(bookingAvailabilitySchema.parse({
    date,
    timezone: setup.timezone,
    serviceId: setup.service_id,
    durationMinutes: setup.duration_minutes,
    slots,
  }));
}

export async function createArtistMembership(context: ApiContext) {
  const session = await createAuth(context.env).api.getSession({ headers: context.req.raw.headers });
  if (!session) return context.json<ApiErrorBody>({ code: 'UNAUTHENTICATED', message: 'Authentication required.' }, 401);
  const studio = await context.env.DB.prepare(
    `SELECT id FROM studios WHERE slug = ?1 COLLATE NOCASE AND status = 'active' LIMIT 1`,
  ).bind(param(context, 'slug').trim().toLowerCase()).first<{ id: string }>();
  if (!studio) return context.json<ApiErrorBody>({ code: 'STUDIO_NOT_FOUND', message: 'Studio not found.' }, 404);

  const existing = await context.env.DB.prepare(
    'SELECT role, status FROM memberships WHERE studio_id = ?1 AND user_id = ?2 LIMIT 1',
  ).bind(studio.id, session.user.id).first<{ role: string; status: string }>();
  if (existing && existing.status !== 'active') {
    return context.json<ApiErrorBody>({ code: 'MEMBERSHIP_UNAVAILABLE', message: 'Membership is unavailable.' }, 403);
  }
  if (!existing) {
    const now = Date.now();
    await context.env.DB.batch([
      context.env.DB.prepare(
        `INSERT INTO memberships (id, studio_id, user_id, role, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'artist', 'active', ?4, ?4)`,
      ).bind(crypto.randomUUID(), studio.id, session.user.id, now),
      context.env.DB.prepare(
        `INSERT INTO audit_logs (id, studio_id, actor_user_id, action, entity_type, entity_id, diff_json, request_id, created_at)
         VALUES (?1, ?2, ?3, 'membership.artist_joined', 'membership', ?3, ?4, ?5, ?6)`,
      ).bind(crypto.randomUUID(), studio.id, session.user.id, JSON.stringify({ role: 'artist' }), context.get('requestId'), now),
    ]);
  }
  return context.json({ joined: true });
}

export async function createBooking(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, param(context, 'slug'));
  if (!access.ok) return context.json(access.error.body, access.error.status);
  let body: unknown;
  try { body = await context.req.json(); } catch { body = undefined; }
  const parsed = bookingCreateSchema.safeParse(body);
  if (!parsed.success) return context.json<ApiErrorBody>({ code: 'VALIDATION_ERROR', message: 'Provjerite termin i uslugu.' }, 422);
  return createBookingFor(context, access.value, access.value.actor.userId, access.value.actor.userId, parsed.data);
}

export async function createManagedBooking(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, param(context, 'slug'), 'bookings.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  let body: unknown;
  try { body = await context.req.json(); } catch { body = undefined; }
  const parsed = managedBookingCreateSchema.safeParse(body);
  if (!parsed.success) return context.json<ApiErrorBody>({ code: 'VALIDATION_ERROR', message: 'Provjerite artista, termin i uslugu.' }, 422);
  const artist = await context.env.DB.prepare(
    `SELECT user_id FROM memberships WHERE studio_id=?1 AND user_id=?2 AND role='artist' AND status='active' LIMIT 1`,
  ).bind(access.value.studio.id, parsed.data.artistUserId).first();
  if (!artist) return context.json<ApiErrorBody>({ code: 'ARTIST_NOT_FOUND', message: 'Aktivni artist nije pronađen.' }, 404);
  return createBookingFor(context, access.value, parsed.data.artistUserId, access.value.actor.userId, parsed.data);
}

async function createBookingFor(context: ApiContext, access: StudioAccess, artistUserId: string, actorUserId: string, input: BookingCreate) {
  const idempotencyKey = context.req.header('Idempotency-Key')?.trim();
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    return context.json<ApiErrorBody>({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'A valid Idempotency-Key header is required.' }, 400);
  }

  let start: number;
  try { start = Temporal.Instant.from(input.startAtUtc).epochMilliseconds; } catch {
    return context.json<ApiErrorBody>({ code: 'INVALID_START_TIME', message: 'Invalid start time.' }, 422);
  }
  const requestFingerprint = `${artistUserId}:${input.serviceId}:${start}:${input.promoCode ?? ''}`;
  const existing = await context.env.DB.prepare(
    `SELECT id, studio_id, resource_id, artist_user_id, service_id, start_at_utc, end_at_utc, status,
      service_name_snapshot, duration_minutes_snapshot, price_minor_snapshot, subtotal_price_minor_snapshot,
      discount_minor_snapshot, promo_code_id, promo_code_snapshot, currency_snapshot, request_fingerprint, created_at
     FROM bookings WHERE studio_id=?1 AND idempotency_key=?2 LIMIT 1`,
  ).bind(access.studio.id, idempotencyKey).first<StoredBooking>();
  if (existing) return existing.request_fingerprint === requestFingerprint
    ? context.json(toBooking(existing), 200)
    : context.json<ApiErrorBody>({ code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key was already used for another request.' }, 409);

  const setup = await getSetup(context, access.studio.slug, input.serviceId);
  if (!setup || setup.studio_id !== access.studio.id) {
    return context.json<ApiErrorBody>({ code: 'SERVICE_NOT_FOUND', message: 'Service not found.' }, 404);
  }
  const local = instantInTimezone(start, setup.timezone);
  const localMinute = local.hour * 60 + local.minute;
  const localDate = local.toPlainDate().toString();
  let canonicalStart: number;
  try { canonicalStart = localMinuteToEpoch(localDate, localMinute, setup.timezone); } catch {
    return context.json<ApiErrorBody>({ code: 'INVALID_START_TIME', message: 'Start time is not bookable.' }, 422);
  }
  if (!isBookableDate(localDate, setup.timezone) || canonicalStart !== start
    || local.second !== 0 || local.millisecond !== 0 || localMinute % 15 !== 0 || start <= Date.now()) {
    return context.json<ApiErrorBody>({ code: 'INVALID_START_TIME', message: 'Start time is not bookable.' }, 422);
  }
  const weekday = local.dayOfWeek % 7;
  const rule = await context.env.DB.prepare(
    `SELECT start_minute, end_minute FROM availability_rules
     WHERE studio_id = ?1 AND resource_id = ?2 AND weekday = ?3
       AND start_minute <= ?4 AND end_minute >= ?5 LIMIT 1`,
  ).bind(setup.studio_id, setup.resource_id, weekday, localMinute, localMinute + setup.duration_minutes).first<RuleRow>();
  if (!rule) return context.json<ApiErrorBody>({ code: 'OUTSIDE_WORKING_HOURS', message: 'Selected time is outside working hours.' }, 422);

  const end = start + setup.duration_minutes * 60_000;
  const promo = input.promoCode
    ? await resolvePromo(context.env, { studioId: setup.studio_id, userId: artistUserId,
      code: input.promoCode, subtotalMinor: setup.price_minor, now: Date.now() })
    : null;
  if (promo && !promo.ok) return context.json<ApiErrorBody>({ code: promo.code, message: promo.message }, 422);
  const discountMinor = promo?.ok ? promo.promo.discountMinor : 0;
  const command: BookingCommand = {
    bookingId: crypto.randomUUID(),
    studioId: setup.studio_id,
    resourceId: setup.resource_id,
    artistUserId,
    actorUserId,
    serviceId: setup.service_id,
    startAtUtc: start,
    endAtUtc: end,
    serviceName: setup.service_name,
    durationMinutes: setup.duration_minutes,
    priceMinor: setup.price_minor - discountMinor,
    subtotalPriceMinor: setup.price_minor,
    discountMinor,
    promoId: promo?.ok ? promo.promo.id : null,
    promoCode: promo?.ok ? promo.promo.code : null,
    currency: setup.currency,
    idempotencyKey,
    requestFingerprint,
    requestId: context.get('requestId'),
    now: Date.now(),
  };
  const coordinator = context.env.BOOKING_COORDINATOR.getByName(`${setup.studio_id}:${setup.resource_id}`);
  const result = await coordinator.createBooking(command);
  if (result.kind === 'conflict') return context.json<ApiErrorBody>({ code: 'SLOT_UNAVAILABLE', message: 'Selected time is no longer available.' }, 409);
  if (result.kind === 'promo_unavailable') return context.json<ApiErrorBody>({ code: 'PROMO_LIMIT_REACHED', message: 'Promo kod je upravo dosegnuo limit korištenja.' }, 409);
  if (result.kind === 'idempotency_conflict') return context.json<ApiErrorBody>({ code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key was already used for another request.' }, 409);
  return context.json(toBooking(result.booking), result.kind === 'created' ? 201 : 200);
}

export async function listBookings(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, param(context, 'slug'));
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const canViewAll = permissionsForRole(access.value.actor.role).includes('bookings.view');
  const status = context.req.query('status')?.trim() || undefined;
  if (status && !bookingStatusSchema.safeParse(status).success) {
    return context.json<ApiErrorBody>({ code: 'VALIDATION_ERROR', message: 'Status rezervacije nije valjan.' }, 422);
  }
  const search = context.req.query('search')?.trim().slice(0, 100) || undefined;
  const fromDate = context.req.query('fromDate')?.trim() || undefined;
  const toDate = context.req.query('toDate')?.trim() || undefined;
  let from: number | undefined;
  let to: number | undefined;
  try {
    if (fromDate) from = localDateBounds(fromDate, access.value.studio.timezone).start;
    if (toDate) to = localDateBounds(toDate, access.value.studio.timezone).end;
  } catch {
    return context.json<ApiErrorBody>({ code: 'VALIDATION_ERROR', message: 'Raspon datuma nije valjan.' }, 422);
  }
  if (from !== undefined && to !== undefined && from >= to) {
    return context.json<ApiErrorBody>({ code: 'VALIDATION_ERROR', message: 'Početni datum mora biti prije završnog.' }, 422);
  }
  let cursor: { start: number; id: string } | undefined;
  const rawCursor = context.req.query('cursor');
  if (rawCursor) {
    try {
      const decoded = JSON.parse(atob(rawCursor)) as { start?: unknown; id?: unknown };
      if (!Number.isSafeInteger(decoded.start) || typeof decoded.id !== 'string' || !decoded.id) throw new Error('invalid cursor');
      cursor = { start: Number(decoded.start), id: decoded.id };
    } catch {
      return context.json<ApiErrorBody>({ code: 'INVALID_CURSOR', message: 'Stranica rezervacija više nije dostupna.' }, 422);
    }
  }
  const conditions = ['b.studio_id = ?'];
  const values: (string | number | null)[] = [access.value.studio.id];
  if (!canViewAll) { conditions.push('b.artist_user_id = ?'); values.push(access.value.actor.userId); }
  if (status) { conditions.push('b.status = ?'); values.push(status); }
  if (search) {
    const escaped = search.replace(/[\\%_]/g, '\\$&');
    conditions.push(canViewAll
      ? `(b.service_name_snapshot LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\')`
      : `b.service_name_snapshot LIKE ? ESCAPE '\\'`);
    const pattern = `%${escaped}%`;
    values.push(pattern);
    if (canViewAll) values.push(pattern, pattern);
  }
  if (from !== undefined) { conditions.push('b.start_at_utc >= ?'); values.push(from); }
  if (to !== undefined) { conditions.push('b.start_at_utc < ?'); values.push(to); }
  if (cursor) {
    conditions.push('(b.start_at_utc < ? OR (b.start_at_utc = ? AND b.id < ?))');
    values.push(cursor.start, cursor.start, cursor.id);
  }
  const sql = `SELECT b.id,b.studio_id,b.resource_id,b.artist_user_id,b.service_id,b.start_at_utc,b.end_at_utc,b.status,
    b.service_name_snapshot,b.duration_minutes_snapshot,b.price_minor_snapshot,b.subtotal_price_minor_snapshot,
    b.discount_minor_snapshot,b.promo_code_id,b.promo_code_snapshot,b.currency_snapshot,b.request_fingerprint,b.created_at,
    u.name AS artist_name,u.email AS artist_email
    FROM bookings b JOIN user u ON u.id=b.artist_user_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY b.start_at_utc DESC,b.id DESC LIMIT 26`;
  const result = await context.env.DB.prepare(sql).bind(...values).all<StoredBooking & { artist_name?: string; artist_email?: string }>();
  const hasMore = result.results.length > 25;
  const page = result.results.slice(0, 25);
  const last = page.at(-1);
  return context.json(bookingListResponseSchema.parse({
    bookings: page.map(toBooking),
    nextCursor: hasMore && last ? btoa(JSON.stringify({ start: last.start_at_utc, id: last.id })) : null,
  }));
}

export async function listBookingArtists(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, param(context, 'slug'), 'bookings.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const result = await context.env.DB.prepare(
    `SELECT u.id AS userId,u.name,u.email FROM memberships m JOIN user u ON u.id=m.user_id
     WHERE m.studio_id=?1 AND m.role='artist' AND m.status='active' ORDER BY u.name COLLATE NOCASE`,
  ).bind(access.value.studio.id).all();
  return context.json({ artists: result.results.map((row) => valueArtistSchema.parse(row)) });
}

type TimelineRow = {
  id: string;
  kind: 'event' | 'note';
  event_type: 'created' | 'cancelled' | 'completed' | 'no_show' | null;
  body: string | null;
  actor_name: string | null;
  created_at: number;
};

export async function getBookingDetail(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, param(context, 'slug'), 'bookings.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const booking = await context.env.DB.prepare(
    `SELECT b.id,b.studio_id,b.resource_id,b.artist_user_id,b.service_id,b.start_at_utc,b.end_at_utc,b.status,
      b.service_name_snapshot,b.duration_minutes_snapshot,b.price_minor_snapshot,b.subtotal_price_minor_snapshot,
      b.discount_minor_snapshot,b.promo_code_id,b.promo_code_snapshot,b.currency_snapshot,b.request_fingerprint,b.created_at,
      u.name AS artist_name,u.email AS artist_email
     FROM bookings b JOIN user u ON u.id=b.artist_user_id
     WHERE b.studio_id=?1 AND b.id=?2 LIMIT 1`,
  ).bind(access.value.studio.id, param(context, 'bookingId')).first<StoredBooking & { artist_name: string; artist_email: string }>();
  if (!booking) return context.json<ApiErrorBody>({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' }, 404);
  const timeline = await context.env.DB.prepare(
    `SELECT e.id,'event' AS kind,e.event_type,NULL AS body,u.name AS actor_name,e.created_at
     FROM booking_events e LEFT JOIN user u ON u.id=e.actor_user_id
     WHERE e.studio_id=?1 AND e.booking_id=?2
     UNION ALL
     SELECT n.id,'note' AS kind,NULL AS event_type,n.body,u.name AS actor_name,n.created_at
     FROM booking_notes n LEFT JOIN user u ON u.id=n.author_user_id
     WHERE n.studio_id=?1 AND n.booking_id=?2
     ORDER BY created_at`,
  ).bind(access.value.studio.id, booking.id).all<TimelineRow>();
  return context.json(bookingDetailSchema.parse({
    booking: toBooking(booking),
    timeline: timeline.results.map((entry) => bookingTimelineEntrySchema.parse(entry.kind === 'event'
      ? { id: entry.id, kind: 'event', eventType: entry.event_type, actorName: entry.actor_name, createdAt: new Date(entry.created_at).toISOString() }
      : { id: entry.id, kind: 'note', body: entry.body, actorName: entry.actor_name, createdAt: new Date(entry.created_at).toISOString() })),
  }));
}

async function getRescheduleSetup(context: ApiContext, studioId: string) {
  return context.env.DB.prepare(
    `SELECT id,studio_id,resource_id,service_id,duration_minutes_snapshot,status
     FROM bookings WHERE studio_id=?1 AND id=?2 LIMIT 1`,
  ).bind(studioId, param(context, 'bookingId')).first<RescheduleSetup>();
}

export async function getBookingRescheduleAvailability(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, param(context, 'slug'), 'bookings.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const booking = await getRescheduleSetup(context, access.value.studio.id);
  if (!booking) return context.json<ApiErrorBody>({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' }, 404);
  if (booking.status !== 'confirmed') return context.json<ApiErrorBody>({ code: 'INVALID_BOOKING_STATUS', message: 'Samo potvrđeni termin moguće je pomaknuti.' }, 409);
  const date = context.req.query('date') ?? '';
  try {
    if (!isBookableDate(date, access.value.studio.timezone)) throw new Error('invalid date');
  } catch {
    return context.json<ApiErrorBody>({ code: 'INVALID_AVAILABILITY_REQUEST', message: 'Datum nije dostupan.' }, 422);
  }
  const rules = await context.env.DB.prepare(
    `SELECT start_minute,end_minute FROM availability_rules
     WHERE studio_id=?1 AND resource_id=?2 AND weekday=?3 ORDER BY start_minute`,
  ).bind(booking.studio_id, booking.resource_id, weekdayForDate(date)).all<RuleRow>();
  const bounds = localDateBounds(date, access.value.studio.timezone);
  const busy = await context.env.DB.prepare(
    `SELECT start_at_utc,end_at_utc FROM blocked_slots
     WHERE studio_id=?1 AND resource_id=?2 AND start_at_utc<?4 AND end_at_utc>?3
     UNION ALL
     SELECT start_at_utc,end_at_utc FROM bookings
     WHERE studio_id=?1 AND resource_id=?2 AND id<>?5 AND status='confirmed' AND start_at_utc<?4 AND end_at_utc>?3`,
  ).bind(booking.studio_id, booking.resource_id, bounds.start, bounds.end, booking.id).all<BusyRow>();
  const slots: { startAtUtc: string; endAtUtc: string }[] = [];
  const now = Date.now();
  for (const rule of rules.results) {
    for (let minute = rule.start_minute; minute + booking.duration_minutes_snapshot <= rule.end_minute; minute += 15) {
      try {
        const start = localMinuteToEpoch(date, minute, access.value.studio.timezone);
        const end = start + booking.duration_minutes_snapshot * 60_000;
        if (start <= now || busy.results.some((item) => item.start_at_utc < end && item.end_at_utc > start)) continue;
        slots.push({ startAtUtc: new Date(start).toISOString(), endAtUtc: new Date(end).toISOString() });
      } catch {
        // DST može ukloniti ili udvostručiti lokalno vrijeme; takav termin ne nudimo.
      }
    }
  }
  return context.json(bookingAvailabilitySchema.parse({
    date,
    timezone: access.value.studio.timezone,
    serviceId: booking.service_id,
    durationMinutes: booking.duration_minutes_snapshot,
    slots,
  }));
}

export async function rescheduleBooking(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, param(context, 'slug'), 'bookings.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  let body: unknown;
  try { body = await context.req.json(); } catch { body = undefined; }
  const parsed = bookingRescheduleSchema.safeParse(body);
  if (!parsed.success) return context.json<ApiErrorBody>({ code: 'VALIDATION_ERROR', message: 'Odaberite valjani novi termin.' }, 422);
  const booking = await getRescheduleSetup(context, access.value.studio.id);
  if (!booking) return context.json<ApiErrorBody>({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' }, 404);
  if (booking.status !== 'confirmed') return context.json<ApiErrorBody>({ code: 'INVALID_BOOKING_STATUS', message: 'Samo potvrđeni termin moguće je pomaknuti.' }, 409);
  let start: number;
  try { start = Temporal.Instant.from(parsed.data.startAtUtc).epochMilliseconds; } catch {
    return context.json<ApiErrorBody>({ code: 'INVALID_START_TIME', message: 'Novi termin nije valjan.' }, 422);
  }
  const local = instantInTimezone(start, access.value.studio.timezone);
  const localMinute = local.hour * 60 + local.minute;
  const localDate = local.toPlainDate().toString();
  let canonicalStart: number;
  try { canonicalStart = localMinuteToEpoch(localDate, localMinute, access.value.studio.timezone); } catch {
    return context.json<ApiErrorBody>({ code: 'INVALID_START_TIME', message: 'Novi termin nije valjan.' }, 422);
  }
  if (!isBookableDate(localDate, access.value.studio.timezone) || canonicalStart !== start
    || local.second !== 0 || local.millisecond !== 0 || localMinute % 15 !== 0 || start <= Date.now()) {
    return context.json<ApiErrorBody>({ code: 'INVALID_START_TIME', message: 'Novi termin nije dostupan.' }, 422);
  }
  const end = start + booking.duration_minutes_snapshot * 60_000;
  const rule = await context.env.DB.prepare(
    `SELECT start_minute,end_minute FROM availability_rules
     WHERE studio_id=?1 AND resource_id=?2 AND weekday=?3 AND start_minute<=?4 AND end_minute>=?5 LIMIT 1`,
  ).bind(booking.studio_id, booking.resource_id, local.dayOfWeek % 7, localMinute,
    localMinute + booking.duration_minutes_snapshot).first<RuleRow>();
  if (!rule) return context.json<ApiErrorBody>({ code: 'OUTSIDE_WORKING_HOURS', message: 'Novi termin je izvan radnog vremena.' }, 422);
  const coordinator = context.env.BOOKING_COORDINATOR.getByName(`${booking.studio_id}:${booking.resource_id}`);
  const result = await coordinator.rescheduleBooking({
    studioId: booking.studio_id,
    resourceId: booking.resource_id,
    bookingId: booking.id,
    actorUserId: access.value.actor.userId,
    startAtUtc: start,
    endAtUtc: end,
    requestId: context.get('requestId'),
    now: Date.now(),
  });
  if (result.kind === 'not_found') return context.json<ApiErrorBody>({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' }, 404);
  if (result.kind === 'invalid_status') return context.json<ApiErrorBody>({ code: 'INVALID_BOOKING_STATUS', message: 'Termin se više ne može pomaknuti.' }, 409);
  if (result.kind === 'conflict') return context.json<ApiErrorBody>({ code: 'SLOT_UNAVAILABLE', message: 'Odabrani termin više nije slobodan.' }, 409);
  return context.json(toBooking(result.booking));
}

export async function createBookingNote(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, param(context, 'slug'), 'bookings.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  let body: unknown;
  try { body = await context.req.json(); } catch { body = undefined; }
  const parsed = bookingNoteCreateSchema.safeParse(body);
  if (!parsed.success) return context.json<ApiErrorBody>({ code: 'VALIDATION_ERROR', message: 'Bilješka mora imati između 1 i 1000 znakova.' }, 422);
  const booking = await context.env.DB.prepare(
    'SELECT id FROM bookings WHERE studio_id=?1 AND id=?2 LIMIT 1',
  ).bind(access.value.studio.id, param(context, 'bookingId')).first<{ id: string }>();
  if (!booking) return context.json<ApiErrorBody>({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' }, 404);
  const id = crypto.randomUUID();
  const now = Date.now();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO booking_notes (id,studio_id,booking_id,author_user_id,body,created_at)
       VALUES (?1,?2,?3,?4,?5,?6)`,
    ).bind(id, access.value.studio.id, booking.id, access.value.actor.userId, parsed.data.body, now),
    context.env.DB.prepare(
      `INSERT INTO audit_logs (id,studio_id,actor_user_id,action,entity_type,entity_id,diff_json,request_id,created_at)
       VALUES (?1,?2,?3,'booking.note_created','booking',?4,?5,?6,?7)`,
    ).bind(crypto.randomUUID(), access.value.studio.id, access.value.actor.userId, booking.id,
      JSON.stringify({ noteId: id }), context.get('requestId'), now),
  ]);
  return context.json(bookingTimelineEntrySchema.parse({
    id,
    kind: 'note',
    body: parsed.data.body,
    actorName: null,
    createdAt: new Date(now).toISOString(),
  }), 201);
}

export async function cancelBooking(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, param(context, 'slug'));
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const booking = await context.env.DB.prepare(
    'SELECT resource_id, artist_user_id, start_at_utc FROM bookings WHERE studio_id = ?1 AND id = ?2 LIMIT 1',
  ).bind(access.value.studio.id, param(context, 'bookingId')).first<{ resource_id: string; artist_user_id: string; start_at_utc: number }>();
  if (!booking) return context.json<ApiErrorBody>({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' }, 404);
  const canManage = permissionsForRole(access.value.actor.role).includes('bookings.manage');
  if (!canManage && booking.artist_user_id !== access.value.actor.userId) {
    return context.json<ApiErrorBody>({ code: 'FORBIDDEN', message: 'Permission denied.' }, 403);
  }
  if (!canManage && booking.start_at_utc <= Date.now()) {
    return context.json<ApiErrorBody>({ code: 'CANCELLATION_CLOSED', message: 'Prošli termin nije moguće otkazati.' }, 409);
  }
  const coordinator = context.env.BOOKING_COORDINATOR.getByName(`${access.value.studio.id}:${booking.resource_id}`);
  const result = await coordinator.cancelBooking({
    studioId: access.value.studio.id,
    resourceId: booking.resource_id,
    bookingId: param(context, 'bookingId'),
    actorUserId: access.value.actor.userId,
    requestId: context.get('requestId'),
    now: Date.now(),
  });
  if (result.kind === 'not_found') return context.json<ApiErrorBody>({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' }, 404);
  if (result.kind === 'invalid_status') return context.json<ApiErrorBody>({ code: 'INVALID_BOOKING_STATUS', message: 'Booking cannot be cancelled.' }, 409);
  return context.json(toBooking(result.booking));
}

export async function updateBookingStatus(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, param(context, 'slug'), 'bookings.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  let body: unknown;
  try { body = await context.req.json(); } catch { body = undefined; }
  const parsed = bookingStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return context.json<ApiErrorBody>({ code: 'VALIDATION_ERROR', message: 'Odaberite valjani status termina.' }, 422);
  }
  const booking = await context.env.DB.prepare(
    'SELECT resource_id FROM bookings WHERE studio_id = ?1 AND id = ?2 LIMIT 1',
  ).bind(access.value.studio.id, param(context, 'bookingId')).first<{ resource_id: string }>();
  if (!booking) return context.json<ApiErrorBody>({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' }, 404);

  const coordinator = context.env.BOOKING_COORDINATOR.getByName(`${access.value.studio.id}:${booking.resource_id}`);
  const result = await coordinator.updateBookingStatus({
    studioId: access.value.studio.id,
    resourceId: booking.resource_id,
    bookingId: param(context, 'bookingId'),
    actorUserId: access.value.actor.userId,
    status: parsed.data.status,
    requestId: context.get('requestId'),
    now: Date.now(),
  });
  if (result.kind === 'not_found') return context.json<ApiErrorBody>({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' }, 404);
  if (result.kind === 'invalid_status') {
    return context.json<ApiErrorBody>({ code: 'INVALID_BOOKING_STATUS', message: 'Status ovog termina više nije moguće promijeniti.' }, 409);
  }
  if (result.kind === 'too_early') {
    return context.json<ApiErrorBody>({ code: 'BOOKING_STATUS_TOO_EARLY', message: 'Termin još nije počeo ili završio.' }, 409);
  }
  return context.json(toBooking(result.booking));
}

export async function listBlockedSlots(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, param(context, 'slug'), 'calendar.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const result = await context.env.DB.prepare(
    `SELECT id, studio_id, resource_id, start_at_utc, end_at_utc, reason, created_at
     FROM blocked_slots WHERE studio_id = ?1 AND end_at_utc >= ?2
     ORDER BY start_at_utc LIMIT 200`,
  ).bind(access.value.studio.id, Date.now()).all<StoredBlockedSlot>();
  return context.json({ blockedSlots: result.results.map(toBlockedSlot) });
}

export async function createBlockedSlot(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, param(context, 'slug'), 'calendar.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  let body: unknown;
  try { body = await context.req.json(); } catch { body = undefined; }
  const parsed = blockedSlotCreateSchema.safeParse(body);
  if (!parsed.success) {
    return context.json<ApiErrorBody>({ code: 'VALIDATION_ERROR', message: 'Provjerite početak, završetak i razlog blokade.' }, 422);
  }

  let start: number;
  let end: number;
  try {
    start = Temporal.PlainDateTime.from(parsed.data.startLocal)
      .toZonedDateTime(access.value.studio.timezone, { disambiguation: 'reject' }).epochMilliseconds;
    end = Temporal.PlainDateTime.from(parsed.data.endLocal)
      .toZonedDateTime(access.value.studio.timezone, { disambiguation: 'reject' }).epochMilliseconds;
  } catch {
    return context.json<ApiErrorBody>({ code: 'INVALID_LOCAL_TIME', message: 'Odabrano lokalno vrijeme nije valjano.' }, 422);
  }
  const duration = end - start;
  if (start <= Date.now() || end <= start || start % (15 * 60_000) !== 0 || end % (15 * 60_000) !== 0 || duration > 30 * 86_400_000) {
    return context.json<ApiErrorBody>({ code: 'INVALID_BLOCK_RANGE', message: 'Blokada mora biti u budućnosti, u koracima od 15 minuta i najviše 30 dana.' }, 422);
  }

  const resource = await getPrimaryResource(context, access.value.studio.id);
  if (!resource) return context.json<ApiErrorBody>({ code: 'RESOURCE_NOT_FOUND', message: 'Studio nema aktivan prostor za rezervacije.' }, 409);
  const coordinator = context.env.BOOKING_COORDINATOR.getByName(`${access.value.studio.id}:${resource.id}`);
  const result = await coordinator.createBlock({
    blockId: crypto.randomUUID(),
    studioId: access.value.studio.id,
    resourceId: resource.id,
    startAtUtc: start,
    endAtUtc: end,
    reason: parsed.data.reason,
    actorUserId: access.value.actor.userId,
    requestId: context.get('requestId'),
    now: Date.now(),
  });
  if (result.kind === 'conflict') {
    return context.json<ApiErrorBody>({ code: 'BLOCK_CONFLICT', message: 'U tom razdoblju već postoji termin ili blokada.' }, 409);
  }
  return context.json(toBlockedSlot(result.block), 201);
}

export async function deleteBlockedSlot(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, param(context, 'slug'), 'calendar.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const block = await context.env.DB.prepare(
    'SELECT resource_id FROM blocked_slots WHERE studio_id = ?1 AND id = ?2 LIMIT 1',
  ).bind(access.value.studio.id, param(context, 'blockId')).first<{ resource_id: string }>();
  if (!block) return context.json<ApiErrorBody>({ code: 'BLOCK_NOT_FOUND', message: 'Blokada nije pronađena.' }, 404);
  const coordinator = context.env.BOOKING_COORDINATOR.getByName(`${access.value.studio.id}:${block.resource_id}`);
  const result = await coordinator.deleteBlock({
    studioId: access.value.studio.id,
    resourceId: block.resource_id,
    blockId: param(context, 'blockId'),
    actorUserId: access.value.actor.userId,
    requestId: context.get('requestId'),
    now: Date.now(),
  });
  if (result.kind === 'not_found') return context.json<ApiErrorBody>({ code: 'BLOCK_NOT_FOUND', message: 'Blokada nije pronađena.' }, 404);
  return context.body(null, 204);
}
