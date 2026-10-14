import { profileUpdateSchema, viewerSchema, type ApiErrorBody } from '@studio/contracts';
import type { Context } from 'hono';
import type { AuthBindings } from '../auth';
import { resolveStudioAccess } from '../authorization/studio-access';

type ApiContext = Context<{ Bindings: AuthBindings; Variables: { requestId: string } }>;

export async function updateProfile(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, context.req.param('slug') ?? '');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  let body: unknown;
  try { body = await context.req.json(); } catch { body = undefined; }
  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return context.json<ApiErrorBody>({ code: 'VALIDATION_ERROR', message: 'Provjerite podatke profila.',
      fieldErrors: { name: parsed.error.issues[0]?.message ?? 'Ime nije valjano.' } }, 422);
  }
  const current = await context.env.DB.prepare('SELECT name,email,image FROM user WHERE id=?1 LIMIT 1')
    .bind(access.value.actor.userId).first<{ name: string; email: string; image: string | null }>();
  if (!current) return context.json<ApiErrorBody>({ code: 'USER_NOT_FOUND', message: 'Korisnik nije pronađen.' }, 404);
  const before = current.name;
  const now = Date.now();
  await context.env.DB.batch([
    context.env.DB.prepare('UPDATE user SET name=?1,updatedAt=?2 WHERE id=?3')
      .bind(parsed.data.name, now, access.value.actor.userId),
    context.env.DB.prepare(
      `INSERT INTO audit_logs (id,studio_id,actor_user_id,action,entity_type,entity_id,diff_json,request_id,created_at)
       VALUES (?1,?2,?3,'profile.updated','user',?3,?4,?5,?6)`,
    ).bind(crypto.randomUUID(), access.value.studio.id, access.value.actor.userId,
      JSON.stringify({ before: { name: before }, after: { name: parsed.data.name } }), context.get('requestId'), now),
  ]);
  return context.json(viewerSchema.parse({ userId: access.value.actor.userId, name: parsed.data.name,
    email: current.email, avatarUrl: current.image }));
}
