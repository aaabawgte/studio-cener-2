import { analyticsRangeSchema, studioAnalyticsSchema, type ApiErrorBody } from '@studio/contracts';
import { Temporal } from '@js-temporal/polyfill';
import type { Context } from 'hono';
import type { AuthBindings } from '../auth';
import { resolveStudioAccess } from '../authorization/studio-access';
import { localDateBounds, localMinuteToEpoch } from '../bookings/time';

type ApiContext = Context<{ Bindings: AuthBindings; Variables: { requestId: string } }>;
type BookingRow = { artist_user_id: string; service_id: string; service_name_snapshot: string; start_at_utc: number; status: 'confirmed'|'cancelled'|'completed'|'no_show'; duration_minutes_snapshot: number; price_minor_snapshot: number };
type RuleRow = { resource_id: string; weekday: number; start_minute: number; end_minute: number };
type BlockRow = { resource_id: string; start_at_utc: number; end_at_utc: number };
const rangeDays = { '30d': 30, '90d': 90, '365d': 365 } as const;

export async function getStudioAnalytics(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, context.req.param('slug') ?? '', 'analytics.view');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const parsedRange = analyticsRangeSchema.safeParse(context.req.query('range') ?? '30d');
  if (!parsedRange.success) return context.json<ApiErrorBody>({ code: 'INVALID_ANALYTICS_RANGE', message: 'Razdoblje analitike nije valjano.' }, 422);
  const range = parsedRange.data; const timezone = access.value.studio.timezone; const now = Date.now();
  const today = Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(timezone).toPlainDate();
  const fromDate = today.subtract({ days: rangeDays[range] - 1 }); const afterDate = today.add({ days: 1 });
  const from = localDateBounds(fromDate.toString(), timezone).start; const to = localDateBounds(afterDate.toString(), timezone).start;
  const results = await context.env.DB.batch([
    context.env.DB.prepare(
      `SELECT artist_user_id,service_id,service_name_snapshot,start_at_utc,status,duration_minutes_snapshot,price_minor_snapshot
       FROM bookings WHERE studio_id=?1 AND start_at_utc>=?2 AND start_at_utc<?3 ORDER BY start_at_utc`,
    ).bind(access.value.studio.id, from, to),
    context.env.DB.prepare(
      `SELECT ar.resource_id,ar.weekday,ar.start_minute,ar.end_minute FROM availability_rules ar
       JOIN bookable_resources br ON br.studio_id=ar.studio_id AND br.id=ar.resource_id
       WHERE ar.studio_id=?1 AND br.status='active'`,
    ).bind(access.value.studio.id),
    context.env.DB.prepare(
      `SELECT resource_id,start_at_utc,end_at_utc FROM blocked_slots
       WHERE studio_id=?1 AND start_at_utc<?3 AND end_at_utc>?2`,
    ).bind(access.value.studio.id, from, to),
  ]);
  const bookings = results[0]!.results as unknown as BookingRow[];
  const rules = results[1]!.results as unknown as RuleRow[];
  const blocks = results[2]!.results as unknown as BlockRow[];
  const active = bookings.filter((booking) => booking.status !== 'cancelled');
  const artistCounts = new Map<string, number>(); const serviceMap = new Map<string, { serviceId: string; serviceName: string; bookings: number; valueMinor: number }>();
  const dailyMap = new Map<string, { date: string; bookings: number; valueMinor: number; bookedMinutes: number }>();
  for (let cursor = fromDate; Temporal.PlainDate.compare(cursor, afterDate) < 0; cursor = cursor.add({ days: 1 })) {
    dailyMap.set(cursor.toString(), { date: cursor.toString(), bookings: 0, valueMinor: 0, bookedMinutes: 0 });
  }
  for (const booking of active) {
    artistCounts.set(booking.artist_user_id, (artistCounts.get(booking.artist_user_id) ?? 0) + 1);
    const service = serviceMap.get(booking.service_id) ?? { serviceId: booking.service_id, serviceName: booking.service_name_snapshot, bookings: 0, valueMinor: 0 };
    service.bookings += 1; service.valueMinor += booking.price_minor_snapshot; serviceMap.set(booking.service_id, service);
    const date = Temporal.Instant.fromEpochMilliseconds(booking.start_at_utc).toZonedDateTimeISO(timezone).toPlainDate().toString();
    const day = dailyMap.get(date); if (day) { day.bookings += 1; day.valueMinor += booking.price_minor_snapshot; day.bookedMinutes += booking.duration_minutes_snapshot; }
  }
  let scheduledMinutes = 0; let blockedMinutes = 0;
  for (const day of dailyMap.values()) {
    const plain = Temporal.PlainDate.from(day.date); const weekday = plain.dayOfWeek % 7;
    for (const rule of rules.filter((item) => item.weekday === weekday)) {
      scheduledMinutes += rule.end_minute - rule.start_minute;
      const ruleStart = localMinuteToEpoch(day.date, rule.start_minute, timezone);
      const ruleEnd = rule.end_minute === 1440 ? localDateBounds(day.date, timezone).end : localMinuteToEpoch(day.date, rule.end_minute, timezone);
      for (const block of blocks.filter((item) => item.resource_id === rule.resource_id)) {
        blockedMinutes += Math.max(0, Math.min(ruleEnd, block.end_at_utc) - Math.max(ruleStart, block.start_at_utc)) / 60_000;
      }
    }
  }
  const availableMinutes = Math.max(0, Math.round(scheduledMinutes - blockedMinutes));
  const bookedMinutes = active.reduce((sum, item) => sum + item.duration_minutes_snapshot, 0);
  return context.json(studioAnalyticsSchema.parse({
    range, fromDate: fromDate.toString(), toDate: today.toString(), timezone, currency: access.value.studio.currency,
    summary: {
      totalBookings: bookings.length,
      confirmedBookings: bookings.filter((item) => item.status === 'confirmed').length,
      completedBookings: bookings.filter((item) => item.status === 'completed').length,
      cancelledBookings: bookings.filter((item) => item.status === 'cancelled').length,
      uniqueArtists: artistCounts.size,
      returningArtists: [...artistCounts.values()].filter((count) => count >= 2).length,
      bookingValueMinor: active.reduce((sum, item) => sum + item.price_minor_snapshot, 0),
      bookedMinutes, availableMinutes,
      utilizationPercent: availableMinutes ? Math.min(100, Math.round(bookedMinutes / availableMinutes * 1000) / 10) : 0,
    },
    topServices: [...serviceMap.values()].sort((a, b) => b.bookings - a.bookings || b.valueMinor - a.valueMinor).slice(0, 8),
    daily: [...dailyMap.values()],
  }));
}
