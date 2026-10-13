import { studioOverviewSchema } from '@studio/contracts';
import { Temporal } from '@js-temporal/polyfill';
import type { Context } from 'hono';
import type { AuthBindings } from '../auth';
import { resolveStudioAccess } from '../authorization/studio-access';
import { localDateBounds } from '../bookings/time';

type ApiContext = Context<{ Bindings: AuthBindings; Variables: { requestId: string } }>;
type TodayRow = { id: string; artist_name: string; artist_email: string; service_name_snapshot: string; start_at_utc: number; end_at_utc: number; status: string; price_minor_snapshot: number };

export async function getStudioOverview(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, context.req.param('slug') ?? '', 'bookings.view');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const now = Date.now(); const timezone = access.value.studio.timezone;
  const date = Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(timezone).toPlainDate();
  const today = localDateBounds(date.toString(), timezone);
  const weekEnd = localDateBounds(date.add({ days: 7 }).toString(), timezone).start;
  const results = await context.env.DB.batch([
    context.env.DB.prepare(
      `SELECT b.id,u.name AS artist_name,u.email AS artist_email,b.service_name_snapshot,b.start_at_utc,b.end_at_utc,b.status,b.price_minor_snapshot
       FROM bookings b JOIN user u ON u.id=b.artist_user_id
       WHERE b.studio_id=?1 AND b.start_at_utc>=?2 AND b.start_at_utc<?3 ORDER BY b.start_at_utc`,
    ).bind(access.value.studio.id, today.start, today.end),
    context.env.DB.prepare(
      `SELECT count(*) AS count FROM bookings WHERE studio_id=?1 AND status='confirmed' AND start_at_utc>=?2 AND start_at_utc<?3`,
    ).bind(access.value.studio.id, now, weekEnd),
    context.env.DB.prepare(`SELECT count(*) AS count FROM waitlist_entries WHERE studio_id=?1 AND status='active' AND day_end_utc>?2`)
      .bind(access.value.studio.id, now),
    context.env.DB.prepare(`SELECT count(*) AS count FROM services WHERE studio_id=?1 AND status='active'`).bind(access.value.studio.id),
    context.env.DB.prepare(
      `SELECT count(*) AS count FROM availability_rules ar JOIN bookable_resources br ON br.studio_id=ar.studio_id AND br.id=ar.resource_id
       WHERE ar.studio_id=?1 AND br.status='active'`,
    ).bind(access.value.studio.id),
  ]);
  const rows = results[0]!.results as unknown as TodayRow[];
  const count = (index: number) => Number((results[index]!.results[0] as { count?: number } | undefined)?.count ?? 0);
  const nonCancelled = rows.filter((row) => row.status !== 'cancelled');
  return context.json(studioOverviewSchema.parse({
    date: date.toString(), timezone, currency: access.value.studio.currency,
    summary: {
      todayBookings: nonCancelled.length,
      todayBookingValueMinor: nonCancelled.reduce((sum, row) => sum + row.price_minor_snapshot, 0),
      nextSevenDaysBookings: count(1),
      activeWaitlistEntries: count(2),
    },
    attention: { hasActiveServices: count(3) > 0, hasAvailabilityRules: count(4) > 0, activeWaitlistEntries: count(2) },
    today: rows.map((row) => ({ id: row.id, artistName: row.artist_name, artistEmail: row.artist_email,
      serviceName: row.service_name_snapshot, startAtUtc: new Date(row.start_at_utc).toISOString(), endAtUtc: new Date(row.end_at_utc).toISOString(),
      status: row.status, priceMinor: row.price_minor_snapshot })),
  }));
}
