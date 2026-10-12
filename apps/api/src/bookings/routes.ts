import {
  blockedSlotCreateSchema,
  blockedSlotSchema,
  bookingAvailabilitySchema,
  bookingCreateSchema,
  bookingSchema,
  type ApiErrorBody,
  type Booking,
} from '@studio/contracts';
import { Temporal } from '@js-temporal/polyfill';
import type { Context } from 'hono';
import type { AuthBindings } from '../auth';
import { createAuth } from '../auth';
import { resolveStudioAccess } from '../authorization/studio-access';
import { permissionsForRole } from '../authorization/permissions';
import type { BookingCommand, StoredBlockedSlot, StoredBooking } from '../durable-objects/booking-coordinator';
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

function param(context: ApiContext, name: string) {
  return context.req.param(name) ?? '';
}

function toBooking(row: StoredBooking): Booking {
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
  const idempotencyKey = context.req.header('Idempotency-Key')?.trim();
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    return context.json<ApiErrorBody>({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'A valid Idempotency-Key header is required.' }, 400);
  }

  let body: unknown;
  try { body = await context.req.json(); } catch { body = undefined; }
  const parsed = bookingCreateSchema.safeParse(body);
  if (!parsed.success) return context.json<ApiErrorBody>({ code: 'VALIDATION_ERROR', message: 'Provjerite termin i uslugu.' }, 422);
  const setup = await getSetup(context, access.value.studio.slug, parsed.data.serviceId);
  if (!setup || setup.studio_id !== access.value.studio.id) {
    return context.json<ApiErrorBody>({ code: 'SERVICE_NOT_FOUND', message: 'Service not found.' }, 404);
  }

  let start: number;
  try { start = Temporal.Instant.from(parsed.data.startAtUtc).epochMilliseconds; } catch {
    return context.json<ApiErrorBody>({ code: 'INVALID_START_TIME', message: 'Invalid start time.' }, 422);
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
  const command: BookingCommand = {
    bookingId: crypto.randomUUID(),
    studioId: setup.studio_id,
    resourceId: setup.resource_id,
    artistUserId: access.value.actor.userId,
    serviceId: setup.service_id,
    startAtUtc: start,
    endAtUtc: end,
    serviceName: setup.service_name,
    durationMinutes: setup.duration_minutes,
    priceMinor: setup.price_minor,
    currency: setup.currency,
    idempotencyKey,
    requestFingerprint: `${access.value.actor.userId}:${setup.service_id}:${start}`,
    requestId: context.get('requestId'),
    now: Date.now(),
  };
  const coordinator = context.env.BOOKING_COORDINATOR.getByName(`${setup.studio_id}:${setup.resource_id}`);
  const result = await coordinator.createBooking(command);
  if (result.kind === 'conflict') return context.json<ApiErrorBody>({ code: 'SLOT_UNAVAILABLE', message: 'Selected time is no longer available.' }, 409);
  if (result.kind === 'idempotency_conflict') return context.json<ApiErrorBody>({ code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key was already used for another request.' }, 409);
  return context.json(toBooking(result.booking), result.kind === 'created' ? 201 : 200);
}

export async function listBookings(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, param(context, 'slug'));
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const canViewAll = permissionsForRole(access.value.actor.role).includes('bookings.view');
  const sql = `SELECT id, studio_id, resource_id, artist_user_id, service_id, start_at_utc, end_at_utc, status,
    service_name_snapshot, duration_minutes_snapshot, price_minor_snapshot, currency_snapshot,
    request_fingerprint, created_at
    FROM bookings WHERE studio_id = ?1 ${canViewAll ? '' : 'AND artist_user_id = ?2'}
    ORDER BY start_at_utc DESC LIMIT 200`;
  const statement = context.env.DB.prepare(sql);
  const result = canViewAll
    ? await statement.bind(access.value.studio.id).all<StoredBooking>()
    : await statement.bind(access.value.studio.id, access.value.actor.userId).all<StoredBooking>();
  return context.json({ bookings: result.results.map(toBooking) });
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
