import { waitlistCreateSchema, waitlistEntrySchema, type ApiErrorBody } from '@studio/contracts';
import type { Context } from 'hono';
import type { AuthBindings } from '../auth';
import { resolveStudioAccess } from '../authorization/studio-access';
import { isBookableDate, localDateBounds } from '../bookings/time';

type ApiContext = Context<{ Bindings: AuthBindings; Variables: { requestId: string } }>;
type WaitlistRow = {
  id: string; user_id: string; artist_name: string; artist_email: string; service_id: string; service_name_snapshot: string;
  desired_date: string; status: 'active'|'notified'|'cancelled'|'converted'|'expired'; notification_count: number;
  last_notified_at: number|null; created_at: number;
};
const param = (context: ApiContext, name: string) => context.req.param(name) ?? '';
const mapEntry = (row: WaitlistRow) => waitlistEntrySchema.parse({ id: row.id, userId: row.user_id, artistName: row.artist_name,
  artistEmail: row.artist_email, serviceId: row.service_id, serviceName: row.service_name_snapshot, desiredDate: row.desired_date,
  status: row.status, notificationCount: row.notification_count,
  lastNotifiedAt: row.last_notified_at ? new Date(row.last_notified_at).toISOString() : null, createdAt: new Date(row.created_at).toISOString() });

const selectSql = `SELECT w.id,w.user_id,u.name AS artist_name,u.email AS artist_email,w.service_id,w.service_name_snapshot,
  w.desired_date,w.status,w.notification_count,w.last_notified_at,w.created_at
  FROM waitlist_entries w JOIN user u ON u.id=w.user_id`;

export async function createWaitlistEntry(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, param(context, 'slug'));
  if (!access.ok) return context.json(access.error.body, access.error.status);
  if (access.value.actor.role !== 'artist') return context.json<ApiErrorBody>({ code: 'ARTIST_REQUIRED', message: 'Artist pristup je obavezan.' }, 403);
  let body: unknown; try { body = await context.req.json(); } catch { body = undefined; }
  const parsed = waitlistCreateSchema.safeParse(body);
  if (!parsed.success || !isBookableDate(parsed.data.desiredDate, access.value.studio.timezone)) {
    return context.json<ApiErrorBody>({ code: 'INVALID_WAITLIST_DATE', message: 'Odaberite valjani datum unutar razdoblja rezerviranja.' }, 422);
  }
  const setup = await context.env.DB.prepare(
    `SELECT sv.id AS service_id,sv.name AS service_name,br.id AS resource_id FROM services sv
     JOIN bookable_resources br ON br.studio_id=sv.studio_id AND br.status='active'
     WHERE sv.studio_id=?1 AND sv.id=?2 AND sv.status='active' ORDER BY br.sort_order,br.id LIMIT 1`,
  ).bind(access.value.studio.id, parsed.data.serviceId).first<{ service_id: string; service_name: string; resource_id: string }>();
  if (!setup) return context.json<ApiErrorBody>({ code: 'SERVICE_NOT_FOUND', message: 'Usluga nije pronađena.' }, 404);
  const bounds = localDateBounds(parsed.data.desiredDate, access.value.studio.timezone); const id = crypto.randomUUID(); const now = Date.now();
  try {
    await context.env.DB.batch([
      context.env.DB.prepare(
        `INSERT INTO waitlist_entries (id,studio_id,user_id,service_id,resource_id,service_name_snapshot,desired_date,day_start_utc,day_end_utc,status,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,'active',?10,?10)`,
      ).bind(id, access.value.studio.id, access.value.actor.userId, setup.service_id, setup.resource_id, setup.service_name,
        parsed.data.desiredDate, bounds.start, bounds.end, now),
      context.env.DB.prepare(`INSERT INTO audit_logs (id,studio_id,actor_user_id,action,entity_type,entity_id,diff_json,request_id,created_at) VALUES (?1,?2,?3,'waitlist.joined','waitlist_entry',?4,?5,?6,?7)`)
        .bind(crypto.randomUUID(), access.value.studio.id, access.value.actor.userId, id,
          JSON.stringify({ serviceId: setup.service_id, desiredDate: parsed.data.desiredDate }), context.get('requestId'), now),
    ]);
  } catch (error) {
    if (String(error).includes('UNIQUE')) return context.json<ApiErrorBody>({ code: 'WAITLIST_ALREADY_JOINED', message: 'Već ste na listi čekanja za ovu uslugu i datum.' }, 409);
    throw error;
  }
  const row = await context.env.DB.prepare(`${selectSql} WHERE w.studio_id=?1 AND w.id=?2`).bind(access.value.studio.id, id).first<WaitlistRow>();
  return context.json(mapEntry(row!), 201);
}

export async function listOwnWaitlist(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, param(context, 'slug'));
  if (!access.ok) return context.json(access.error.body, access.error.status);
  if (access.value.actor.role !== 'artist') return context.json<ApiErrorBody>({ code: 'ARTIST_REQUIRED', message: 'Artist pristup je obavezan.' }, 403);
  await expireEntries(context, access.value.studio.id);
  const result = await context.env.DB.prepare(`${selectSql} WHERE w.studio_id=?1 AND w.user_id=?2 ORDER BY w.created_at DESC LIMIT 100`)
    .bind(access.value.studio.id, access.value.actor.userId).all<WaitlistRow>();
  return context.json({ waitlistEntries: result.results.map(mapEntry) });
}

export async function listStudioWaitlist(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, param(context, 'slug'), 'bookings.view');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  await expireEntries(context, access.value.studio.id);
  const result = await context.env.DB.prepare(`${selectSql} WHERE w.studio_id=?1 ORDER BY CASE w.status WHEN 'active' THEN 0 WHEN 'notified' THEN 1 ELSE 2 END,w.desired_date,w.created_at LIMIT 300`)
    .bind(access.value.studio.id).all<WaitlistRow>();
  return context.json({ waitlistEntries: result.results.map(mapEntry) });
}

export async function cancelWaitlistEntry(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, param(context, 'slug'));
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const canManage = access.value.actor.role === 'owner' || access.value.actor.role === 'manager';
  const row = await context.env.DB.prepare('SELECT id,user_id,status FROM waitlist_entries WHERE studio_id=?1 AND id=?2 LIMIT 1')
    .bind(access.value.studio.id, param(context, 'entryId')).first<{ id: string; user_id: string; status: string }>();
  if (!row) return context.json<ApiErrorBody>({ code: 'WAITLIST_NOT_FOUND', message: 'Prijava nije pronađena.' }, 404);
  if (!canManage && row.user_id !== access.value.actor.userId) return context.json<ApiErrorBody>({ code: 'FORBIDDEN', message: 'Nemate ovlasti za ovu radnju.' }, 403);
  if (!['active', 'notified'].includes(row.status)) return context.json<ApiErrorBody>({ code: 'WAITLIST_NOT_ACTIVE', message: 'Prijava više nije aktivna.' }, 409);
  const now = Date.now();
  await context.env.DB.batch([
    context.env.DB.prepare(`UPDATE waitlist_entries SET status='cancelled',updated_at=?1 WHERE studio_id=?2 AND id=?3 AND status IN ('active','notified')`).bind(now, access.value.studio.id, row.id),
    context.env.DB.prepare(`INSERT INTO audit_logs (id,studio_id,actor_user_id,action,entity_type,entity_id,diff_json,request_id,created_at) VALUES (?1,?2,?3,'waitlist.cancelled','waitlist_entry',?4,'{}',?5,?6)`)
      .bind(crypto.randomUUID(), access.value.studio.id, access.value.actor.userId, row.id, context.get('requestId'), now),
  ]);
  return context.body(null, 204);
}

async function expireEntries(context: ApiContext, studioId: string) {
  await context.env.DB.prepare(
    `UPDATE waitlist_entries SET status='expired',updated_at=?1
     WHERE studio_id=?2 AND status='active' AND day_end_utc<=?1`,
  ).bind(Date.now(), studioId).run();
}
