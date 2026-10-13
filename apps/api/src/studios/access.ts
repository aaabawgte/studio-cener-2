import {
  managerInvitationCreateSchema,
  managerInvitationCreatedSchema,
  studioAccessSchema,
  type ApiErrorBody,
} from '@studio/contracts';
import type { Context } from 'hono';
import type { AuthBindings } from '../auth';
import { resolveStudioAccess } from '../authorization/studio-access';
import { hashInvitationToken, randomInvitationToken } from '../platform/routes';

type ApiEnvironment = { Bindings: AuthBindings; Variables: { requestId: string } };
type ApiContext = Context<ApiEnvironment>;

type MemberRow = {
  membership_id: string;
  user_id: string;
  name: string;
  email: string;
  role: 'owner' | 'manager';
  status: 'active' | 'suspended' | 'revoked';
  team_member_id: string | null;
  created_at: number;
};

type InvitationRow = {
  id: string;
  email: string;
  team_member_id: string | null;
  expires_at: number;
  created_at: number;
};

function routeParam(context: ApiContext, name: string) {
  return context.req.param(name) ?? '';
}

async function audit(context: ApiContext, studioId: string, userId: string, action: string, entityType: string, entityId: string, diff: unknown) {
  await context.env.DB.prepare(
    `INSERT INTO audit_logs (id, studio_id, actor_user_id, action, entity_type, entity_id, diff_json, request_id, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
  ).bind(crypto.randomUUID(), studioId, userId, action, entityType, entityId, JSON.stringify(diff), context.get('requestId'), Date.now()).run();
}

export async function listStudioAccess(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, routeParam(context, 'slug'), 'studio.settings.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const now = Date.now();
  const results = await context.env.DB.batch([
    context.env.DB.prepare(
      `SELECT m.id AS membership_id, m.user_id, u.name, u.email, m.role, m.status, tm.id AS team_member_id, m.created_at
       FROM memberships m JOIN "user" u ON u.id = m.user_id
       LEFT JOIN team_members tm ON tm.studio_id = m.studio_id AND tm.user_id = m.user_id
       WHERE m.studio_id = ?1 AND m.role IN ('owner', 'manager') AND m.status IN ('active', 'suspended')
       ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END, m.created_at`,
    ).bind(access.value.studio.id),
    context.env.DB.prepare(
      `SELECT id, email, team_member_id, expires_at, created_at FROM studio_invitations
       WHERE studio_id = ?1 AND role = 'manager' AND status = 'pending' AND expires_at > ?2
       ORDER BY created_at DESC`,
    ).bind(access.value.studio.id, now),
    context.env.DB.prepare(
      `SELECT l.max_managers,
        (SELECT COUNT(*) FROM memberships m WHERE m.studio_id = l.studio_id AND m.role = 'manager' AND m.status = 'active') +
        (SELECT COUNT(*) FROM studio_invitations i WHERE i.studio_id = l.studio_id AND i.role = 'manager' AND i.status = 'pending' AND i.expires_at > ?2)
        AS slots_used
       FROM studio_licenses l WHERE l.studio_id = ?1`,
    ).bind(access.value.studio.id, now),
  ]);
  const limit = (results[2]!.results[0] ?? { max_managers: 0, slots_used: 0 }) as { max_managers: number; slots_used: number };
  return context.json(studioAccessSchema.parse({
    members: (results[0]!.results as unknown as MemberRow[]).map((row) => ({
      membershipId: row.membership_id,
      userId: row.user_id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
      teamMemberId: row.team_member_id,
      createdAt: new Date(row.created_at).toISOString(),
    })),
    invitations: (results[1]!.results as unknown as InvitationRow[]).map((row) => ({
      id: row.id,
      email: row.email,
      role: 'manager' as const,
      teamMemberId: row.team_member_id,
      expiresAt: new Date(row.expires_at).toISOString(),
      createdAt: new Date(row.created_at).toISOString(),
    })),
    managerLimit: limit.max_managers,
    managerSlotsUsed: limit.slots_used,
  }));
}

export async function createManagerInvitation(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, routeParam(context, 'slug'), 'studio.settings.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  let body: unknown;
  try { body = await context.req.json(); } catch { body = undefined; }
  const parsed = managerInvitationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return context.json<ApiErrorBody>({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Provjerite podatke pozivnice.' }, 422);
  }
  const existing = await context.env.DB.prepare(
    `SELECT m.id FROM memberships m JOIN "user" u ON u.id = m.user_id
     WHERE m.studio_id = ?1 AND u.email = ?2 COLLATE NOCASE AND m.status IN ('active', 'suspended') LIMIT 1`,
  ).bind(access.value.studio.id, parsed.data.email).first<{ id: string }>();
  if (existing) return context.json<ApiErrorBody>({ code: 'MEMBERSHIP_EXISTS', message: 'Ta osoba već ima pristup studiju.' }, 409);

  const teamMemberId = parsed.data.teamMemberId ?? null;
  if (teamMemberId) {
    const teamMember = await context.env.DB.prepare(
      'SELECT id, user_id FROM team_members WHERE studio_id = ?1 AND id = ?2 LIMIT 1',
    ).bind(access.value.studio.id, teamMemberId).first<{ id: string; user_id: string | null }>();
    if (!teamMember) return context.json<ApiErrorBody>({ code: 'TEAM_MEMBER_NOT_FOUND', message: 'Član tima nije pronađen.' }, 404);
    if (teamMember.user_id) return context.json<ApiErrorBody>({ code: 'TEAM_MEMBER_LINKED', message: 'Član tima već ima povezani pristup.' }, 409);
  }

  const invitationId = crypto.randomUUID();
  const invitationToken = randomInvitationToken();
  const tokenHash = await hashInvitationToken(invitationToken);
  const now = Date.now();
  const expiresAt = now + 14 * 86_400_000;
  await context.env.DB.prepare(
    `UPDATE studio_invitations SET status = 'expired'
     WHERE studio_id = ?1 AND role = 'manager' AND status = 'pending' AND expires_at <= ?2`,
  ).bind(access.value.studio.id, now).run();
  try {
    const inserted = await context.env.DB.prepare(
      `INSERT INTO studio_invitations
       (id, studio_id, email, role, token_hash, status, expires_at, invited_by_user_id, created_at, team_member_id)
       SELECT ?1, l.studio_id, ?2, 'manager', ?3, 'pending', ?4, ?5, ?6, ?7
       FROM studio_licenses l
       WHERE l.studio_id = ?8 AND (
         (SELECT COUNT(*) FROM memberships m WHERE m.studio_id = l.studio_id AND m.role = 'manager' AND m.status = 'active') +
         (SELECT COUNT(*) FROM studio_invitations i WHERE i.studio_id = l.studio_id AND i.role = 'manager' AND i.status = 'pending' AND i.expires_at > ?6)
       ) < l.max_managers`,
    ).bind(invitationId, parsed.data.email, tokenHash, expiresAt, access.value.actor.userId, now, teamMemberId, access.value.studio.id).run();
    if (!inserted.meta.changes) {
      return context.json<ApiErrorBody>({ code: 'MANAGER_LIMIT_REACHED', message: 'Dosegnut je broj managera uključen u licencu.' }, 409);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('UNIQUE') || message.includes('SQLITE_CONSTRAINT')) {
      return context.json<ApiErrorBody>({ code: 'INVITATION_EXISTS', message: 'Aktivna pozivnica za taj e-mail već postoji.' }, 409);
    }
    throw error;
  }
  await audit(context, access.value.studio.id, access.value.actor.userId, 'manager_invitation.created', 'studio_invitation', invitationId, { email: parsed.data.email, teamMemberId });
  return context.json(managerInvitationCreatedSchema.parse({
    invitation: { id: invitationId, email: parsed.data.email, role: 'manager', teamMemberId, expiresAt: new Date(expiresAt).toISOString(), createdAt: new Date(now).toISOString() },
    invitationToken,
  }), 201);
}

export async function revokeManagerInvitation(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, routeParam(context, 'slug'), 'studio.settings.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const invitationId = routeParam(context, 'invitationId');
  const result = await context.env.DB.prepare(
    `UPDATE studio_invitations SET status = 'revoked'
     WHERE id = ?1 AND studio_id = ?2 AND role = 'manager' AND status = 'pending'`,
  ).bind(invitationId, access.value.studio.id).run();
  if (!result.meta.changes) return context.json<ApiErrorBody>({ code: 'INVITATION_NOT_FOUND', message: 'Aktivna pozivnica nije pronađena.' }, 404);
  await audit(context, access.value.studio.id, access.value.actor.userId, 'manager_invitation.revoked', 'studio_invitation', invitationId, {});
  return context.body(null, 204);
}

export async function revokeManagerAccess(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, routeParam(context, 'slug'), 'studio.settings.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const membershipId = routeParam(context, 'membershipId');
  const membership = await context.env.DB.prepare(
    `SELECT id, user_id FROM memberships WHERE id = ?1 AND studio_id = ?2 AND role = 'manager' AND status IN ('active', 'suspended') LIMIT 1`,
  ).bind(membershipId, access.value.studio.id).first<{ id: string; user_id: string }>();
  if (!membership) return context.json<ApiErrorBody>({ code: 'MEMBERSHIP_NOT_FOUND', message: 'Manager pristup nije pronađen.' }, 404);
  const now = Date.now();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE memberships SET status = 'revoked', updated_at = ?1 WHERE id = ?2 AND studio_id = ?3`,
    ).bind(now, membershipId, access.value.studio.id),
    context.env.DB.prepare(
      `UPDATE team_members SET user_id = NULL, updated_at = ?1 WHERE studio_id = ?2 AND user_id = ?3`,
    ).bind(now, access.value.studio.id, membership.user_id),
    context.env.DB.prepare(
      `INSERT INTO audit_logs (id, studio_id, actor_user_id, action, entity_type, entity_id, diff_json, request_id, created_at)
       VALUES (?1, ?2, ?3, 'manager_access.revoked', 'membership', ?4, ?5, ?6, ?7)`,
    ).bind(crypto.randomUUID(), access.value.studio.id, access.value.actor.userId, membershipId, JSON.stringify({ userId: membership.user_id }), context.get('requestId'), now),
  ]);
  return context.body(null, 204);
}
