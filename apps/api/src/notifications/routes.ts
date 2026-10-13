import { notificationSchema, type ApiErrorBody } from '@studio/contracts';
import type { Context } from 'hono';
import type { AuthBindings } from '../auth';
import { resolveStudioAccess } from '../authorization/studio-access';

type ApiContext = Context<{ Bindings: AuthBindings; Variables: { requestId: string } }>;
const param = (context: ApiContext, name: string) => context.req.param(name) ?? '';

export async function listNotifications(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, param(context, 'slug'));
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const result = await context.env.DB.prepare(
    `SELECT id,type,title,body,entity_type,entity_id,read_at,created_at FROM notifications
     WHERE studio_id=?1 AND user_id=?2 ORDER BY created_at DESC LIMIT 100`,
  ).bind(access.value.studio.id, access.value.actor.userId).all<Record<string, unknown>>();
  return context.json({ notifications: result.results.map((row) => notificationSchema.parse({ id: row.id, type: row.type,
    title: row.title, body: row.body, entityType: row.entity_type, entityId: row.entity_id,
    readAt: row.read_at ? new Date(Number(row.read_at)).toISOString() : null, createdAt: new Date(Number(row.created_at)).toISOString() })) });
}

export async function markNotificationRead(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, param(context, 'slug'));
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const result = await context.env.DB.prepare(
    `UPDATE notifications SET read_at=COALESCE(read_at,?1) WHERE studio_id=?2 AND user_id=?3 AND id=?4`,
  ).bind(Date.now(), access.value.studio.id, access.value.actor.userId, param(context, 'notificationId')).run();
  if (!result.meta.changes) return context.json<ApiErrorBody>({ code: 'NOTIFICATION_NOT_FOUND', message: 'Obavijest nije pronađena.' }, 404);
  return context.body(null, 204);
}
