import {
  invitationAcceptSchema,
  invitationAcceptedSchema,
  licenseUpdateSchema,
  platformStudioCreateSchema,
  platformStudioCreatedSchema,
  platformDomainWriteSchema,
  publicDomainResolutionSchema,
  platformStudioSchema,
  type ApiErrorBody,
} from '@studio/contracts';
import type { Context } from 'hono';
import type { AuthBindings } from '../auth';
import { createAuth } from '../auth';

type ApiEnvironment = { Bindings: AuthBindings; Variables: { requestId: string } };
type ApiContext = Context<ApiEnvironment>;

type AdminStudioRow = {
  id: string;
  slug: string;
  name: string;
  status: 'active' | 'suspended' | 'archived';
  owner_email: string | null;
  plan: 'starter' | 'pro' | 'custom';
  license_status: 'trial' | 'active' | 'grace' | 'suspended' | 'expired';
  expires_at: number;
  hostname: string | null;
  domain_status: 'pending' | 'active' | 'failed' | null;
  ssl_status: 'pending' | 'active' | 'failed' | null;
};

function mapStudio(row: AdminStudioRow) {
  return platformStudioSchema.parse({
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    ownerEmail: row.owner_email,
    license: { plan: row.plan, status: row.license_status, expiresAt: new Date(row.expires_at).toISOString() },
    domain: row.hostname && row.domain_status && row.ssl_status
      ? { hostname: row.hostname, status: row.domain_status, sslStatus: row.ssl_status }
      : null,
  });
}

export async function hashInvitationToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function randomInvitationToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function requirePlatformAdmin(context: ApiContext) {
  const session = await createAuth(context.env).api.getSession({ headers: context.req.raw.headers });
  if (!session) return { ok: false as const, response: context.json<ApiErrorBody>({ code: 'UNAUTHENTICATED', message: 'Authentication required.' }, 401) };
  const user = await context.env.DB.prepare('SELECT platformRole FROM "user" WHERE id = ?1 LIMIT 1')
    .bind(session.user.id).first<{ platformRole: string | null }>();
  if (user?.platformRole === 'platform_admin') return { ok: true as const, userId: session.user.id };

  const allowed = context.env.PLATFORM_ADMIN_EMAILS.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (allowed.includes(session.user.email.toLowerCase())) {
    await context.env.DB.prepare(`UPDATE "user" SET platformRole = 'platform_admin', updatedAt = ?1 WHERE id = ?2`)
      .bind(Date.now(), session.user.id).run();
    return { ok: true as const, userId: session.user.id };
  }
  return { ok: false as const, response: context.json<ApiErrorBody>({ code: 'FORBIDDEN', message: 'Platform admin access required.' }, 403) };
}

const studioSelectSql = `SELECT s.id, s.slug, s.name, s.status, l.plan, l.status AS license_status, l.expires_at,
  COALESCE(
    (SELECT u.email FROM memberships m JOIN "user" u ON u.id = m.user_id
      WHERE m.studio_id = s.id AND m.role = 'owner' AND m.status = 'active' ORDER BY m.created_at LIMIT 1),
    (SELECT i.email FROM studio_invitations i
      WHERE i.studio_id = s.id AND i.role = 'owner' ORDER BY i.created_at DESC LIMIT 1)
  ) AS owner_email,
  d.hostname, d.status AS domain_status, d.ssl_status
  FROM studios s
  JOIN studio_licenses l ON l.studio_id = s.id
  LEFT JOIN studio_domains d ON d.studio_id = s.id AND d.is_primary = 1`;

export async function listPlatformStudios(context: ApiContext) {
  const admin = await requirePlatformAdmin(context);
  if (!admin.ok) return admin.response;
  const result = await context.env.DB.prepare(`${studioSelectSql} ORDER BY s.created_at DESC`).all<AdminStudioRow>();
  return context.json({ studios: result.results.map(mapStudio) });
}

async function loadPlatformStudio(context: ApiContext, studioId: string) {
  const result = await context.env.DB.prepare(`${studioSelectSql} WHERE s.id=?1`)
    .bind(studioId).all<AdminStudioRow>();
  return result.results[0] ? mapStudio(result.results[0]) : null;
}

export async function resolvePublicDomain(context: ApiContext) {
  const parsed = platformDomainWriteSchema.safeParse({ hostname: context.req.query('hostname')?.toLowerCase() });
  if (!parsed.success) return context.json<ApiErrorBody>({ code: 'DOMAIN_NOT_FOUND', message: 'Domena nije povezana.' }, 404);
  const row = await context.env.DB.prepare(
    `SELECT s.slug FROM studio_domains d JOIN studios s ON s.id=d.studio_id
     JOIN studio_licenses l ON l.studio_id=d.studio_id
     WHERE d.hostname=?1 COLLATE NOCASE AND d.status='active' AND d.ssl_status='active'
       AND d.is_primary=1 AND s.status='active'
       AND ((l.status IN ('trial','active') AND l.expires_at>?2)
         OR (l.status='grace' AND COALESCE(l.grace_ends_at,l.expires_at)>?2))
     LIMIT 1`,
  ).bind(parsed.data.hostname, Date.now()).first<{ slug: string }>();
  return row ? context.json(publicDomainResolutionSchema.parse({ studioSlug: row.slug }))
    : context.json<ApiErrorBody>({ code: 'DOMAIN_NOT_FOUND', message: 'Domena nije povezana.' }, 404);
}

export async function setStudioDomain(context: ApiContext) {
  const admin = await requirePlatformAdmin(context);
  if (!admin.ok) return admin.response;
  let body: unknown;
  try { body = await context.req.json(); } catch { body = undefined; }
  const parsed = platformDomainWriteSchema.safeParse(body);
  if (!parsed.success) return context.json<ApiErrorBody>({ code: 'VALIDATION_ERROR', message: 'Domena nije valjana.' }, 422);
  const studioId = context.req.param('studioId') ?? '';
  const studio = await context.env.DB.prepare('SELECT id FROM studios WHERE id=?1 LIMIT 1').bind(studioId).first();
  if (!studio) return context.json<ApiErrorBody>({ code: 'STUDIO_NOT_FOUND', message: 'Studio nije pronađen.' }, 404);
  const existing = await context.env.DB.prepare(
    'SELECT id,hostname FROM studio_domains WHERE studio_id=?1 AND is_primary=1 LIMIT 1',
  ).bind(studioId).first<{ id: string; hostname: string }>();
  const now = Date.now();
  const domainId = existing?.id ?? crypto.randomUUID();
  try {
    await context.env.DB.batch([
      existing ? context.env.DB.prepare(
        `UPDATE studio_domains SET hostname=?1,status='pending',ssl_status='pending',cloudflare_hostname_id=NULL,updated_at=?2
         WHERE studio_id=?3 AND id=?4`,
      ).bind(parsed.data.hostname, now, studioId, existing.id) : context.env.DB.prepare(
        `INSERT INTO studio_domains (id,studio_id,hostname,status,ssl_status,is_primary,created_at,updated_at)
         VALUES (?1,?2,?3,'pending','pending',1,?4,?4)`,
      ).bind(domainId, studioId, parsed.data.hostname, now),
      context.env.DB.prepare(
        `INSERT INTO audit_logs (id,studio_id,actor_user_id,action,entity_type,entity_id,diff_json,request_id,created_at)
         VALUES (?1,?2,?3,'studio.domain_configured','studio_domain',?4,?5,?6,?7)`,
      ).bind(crypto.randomUUID(), studioId, admin.userId, domainId,
        JSON.stringify({ before: existing?.hostname ?? null, after: parsed.data.hostname }), context.get('requestId'), now),
    ]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('UNIQUE') || message.includes('SQLITE_CONSTRAINT')) {
      return context.json<ApiErrorBody>({ code: 'DOMAIN_CONFLICT', message: 'Domena je već povezana s drugim studijem.' }, 409);
    }
    throw error;
  }
  const updated = await loadPlatformStudio(context, studioId);
  if (!updated) throw new Error('Updated studio could not be loaded.');
  return context.json(updated);
}

export async function verifyStudioDomain(context: ApiContext) {
  const admin = await requirePlatformAdmin(context);
  if (!admin.ok) return admin.response;
  const studioId = context.req.param('studioId') ?? '';
  const domain = await context.env.DB.prepare(
    'SELECT id,hostname FROM studio_domains WHERE studio_id=?1 AND is_primary=1 LIMIT 1',
  ).bind(studioId).first<{ id: string; hostname: string }>();
  if (!domain) return context.json<ApiErrorBody>({ code: 'DOMAIN_NOT_FOUND', message: 'Domena nije postavljena.' }, 404);
  let verified = false;
  try {
    const response = await fetch(`https://${domain.hostname}/api/health`, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
    if (response.ok) {
      const payload = await response.json<{ service?: string; environment?: string }>();
      verified = payload.service === 'studio-cener-api' && payload.environment === 'production';
    }
  } catch { verified = false; }
  const now = Date.now();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE studio_domains SET status=?1,ssl_status=?1,updated_at=?2 WHERE studio_id=?3 AND id=?4`,
    ).bind(verified ? 'active' : 'failed', now, studioId, domain.id),
    context.env.DB.prepare(
      `INSERT INTO audit_logs (id,studio_id,actor_user_id,action,entity_type,entity_id,diff_json,request_id,created_at)
       VALUES (?1,?2,?3,?4,'studio_domain',?5,?6,?7,?8)`,
    ).bind(crypto.randomUUID(), studioId, admin.userId,
      verified ? 'studio.domain_activated' : 'studio.domain_verification_failed', domain.id,
      JSON.stringify({ hostname: domain.hostname }), context.get('requestId'), now),
  ]);
  if (!verified) return context.json<ApiErrorBody>({ code: 'DOMAIN_NOT_READY', message: 'Domena još ne vodi na Studio Cener Pages projekt ili SSL nije spreman.' }, 409);
  const updated = await loadPlatformStudio(context, studioId);
  if (!updated) throw new Error('Verified studio could not be loaded.');
  return context.json(updated);
}

export async function createPlatformStudio(context: ApiContext) {
  const admin = await requirePlatformAdmin(context);
  if (!admin.ok) return admin.response;
  let body: unknown;
  try { body = await context.req.json(); } catch { body = undefined; }
  const parsed = platformStudioCreateSchema.safeParse(body);
  if (!parsed.success) return context.json<ApiErrorBody>({ code: 'VALIDATION_ERROR', message: 'Provjerite podatke studija.' }, 422);
  try { new Intl.DateTimeFormat('en', { timeZone: parsed.data.timezone }).format(); } catch {
    return context.json<ApiErrorBody>({ code: 'INVALID_TIMEZONE', message: 'Vremenska zona nije valjana.' }, 422);
  }
  const expiresAt = Date.parse(parsed.data.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return context.json<ApiErrorBody>({ code: 'INVALID_LICENSE_EXPIRY', message: 'Licenca mora vrijediti u budućnosti.' }, 422);
  }
  const hostname = parsed.data.hostname || null;
  if (hostname && (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname))) {
    return context.json<ApiErrorBody>({ code: 'INVALID_HOSTNAME', message: 'Domena nije valjana.' }, 422);
  }

  const studioId = crypto.randomUUID();
  const invitationId = crypto.randomUUID();
  const invitationToken = randomInvitationToken();
  const tokenHash = await hashInvitationToken(invitationToken);
  const now = Date.now();
  const invitationExpiresAt = now + 14 * 86_400_000;
  const resourceId = `main:${studioId}`;
  const statements = [
    context.env.DB.prepare(
      `INSERT INTO studios (id, slug, name, timezone, currency, status, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 'active', ?6, ?6)`,
    ).bind(studioId, parsed.data.slug, parsed.data.name, parsed.data.timezone, parsed.data.currency, now),
    context.env.DB.prepare(
      `INSERT INTO bookable_resources (id, studio_id, name, status, sort_order, created_at, updated_at)
       VALUES (?1, ?2, 'Glavni studio', 'active', 0, ?3, ?3)`,
    ).bind(resourceId, studioId, now),
    context.env.DB.prepare(
      `INSERT INTO studio_licenses
       (id, studio_id, plan, status, starts_at, expires_at, max_managers, features_json, created_by_user_id, created_at, updated_at)
       VALUES (?1, ?2, ?3, 'active', ?4, ?5, ?6, '{}', ?7, ?4, ?4)`,
    ).bind(crypto.randomUUID(), studioId, parsed.data.plan, now, expiresAt, parsed.data.plan === 'starter' ? 1 : 3, admin.userId),
    context.env.DB.prepare(
      `INSERT INTO studio_invitations
       (id, studio_id, email, role, token_hash, status, expires_at, invited_by_user_id, created_at)
       VALUES (?1, ?2, ?3, 'owner', ?4, 'pending', ?5, ?6, ?7)`,
    ).bind(invitationId, studioId, parsed.data.ownerEmail.toLowerCase(), tokenHash, invitationExpiresAt, admin.userId, now),
    context.env.DB.prepare(
      `INSERT INTO audit_logs (id, studio_id, actor_user_id, action, entity_type, entity_id, diff_json, request_id, created_at)
       VALUES (?1, ?2, ?3, 'studio.created', 'studio', ?2, ?4, ?5, ?6)`,
    ).bind(crypto.randomUUID(), studioId, admin.userId, JSON.stringify({ name: parsed.data.name, slug: parsed.data.slug, ownerEmail: parsed.data.ownerEmail }), context.get('requestId'), now),
  ];
  if (hostname) {
    statements.splice(4, 0, context.env.DB.prepare(
      `INSERT INTO studio_domains (id, studio_id, hostname, status, ssl_status, is_primary, created_at, updated_at)
       VALUES (?1, ?2, ?3, 'pending', 'pending', 1, ?4, ?4)`,
    ).bind(crypto.randomUUID(), studioId, hostname, now));
  }
  try {
    await context.env.DB.batch(statements);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('UNIQUE') || message.includes('SQLITE_CONSTRAINT')) {
      return context.json<ApiErrorBody>({ code: 'STUDIO_CONFLICT', message: 'Slug, domena ili owner pozivnica već postoje.' }, 409);
    }
    throw error;
  }

  const createdRows = await context.env.DB.prepare(`${studioSelectSql} ORDER BY s.created_at DESC`).all<AdminStudioRow>();
  const row = createdRows.results.find((item) => item.id === studioId);
  if (!row) throw new Error('Created studio could not be loaded.');
  return context.json(platformStudioCreatedSchema.parse({ studio: mapStudio(row), invitationToken }), 201);
}

export async function updateStudioLicense(context: ApiContext) {
  const admin = await requirePlatformAdmin(context);
  if (!admin.ok) return admin.response;
  let body: unknown;
  try { body = await context.req.json(); } catch { body = undefined; }
  const parsed = licenseUpdateSchema.safeParse(body);
  if (!parsed.success) return context.json<ApiErrorBody>({ code: 'VALIDATION_ERROR', message: 'Provjerite podatke licence.' }, 422);
  const expiresAt = Date.parse(parsed.data.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return context.json<ApiErrorBody>({ code: 'INVALID_LICENSE_EXPIRY', message: 'Licenca mora vrijediti u budućnosti.' }, 422);
  }
  const studioId = context.req.param('studioId') ?? '';
  const current = await context.env.DB.prepare('SELECT plan, status, expires_at FROM studio_licenses WHERE studio_id = ?1 LIMIT 1')
    .bind(studioId).first<{ plan: string; status: string; expires_at: number }>();
  if (!current) return context.json<ApiErrorBody>({ code: 'STUDIO_NOT_FOUND', message: 'Studio nije pronađen.' }, 404);
  const now = Date.now();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE studio_licenses SET plan = ?1, status = ?2, expires_at = ?3, updated_at = ?4 WHERE studio_id = ?5`,
    ).bind(parsed.data.plan, parsed.data.status, expiresAt, now, studioId),
    context.env.DB.prepare(
      `INSERT INTO audit_logs (id, studio_id, actor_user_id, action, entity_type, entity_id, diff_json, request_id, created_at)
       VALUES (?1, ?2, ?3, 'license.updated', 'studio_license', ?2, ?4, ?5, ?6)`,
    ).bind(crypto.randomUUID(), studioId, admin.userId, JSON.stringify({ before: current, after: parsed.data }), context.get('requestId'), now),
  ]);
  const updated = await loadPlatformStudio(context, studioId);
  if (!updated) throw new Error('Updated studio could not be loaded.');
  return context.json(updated);
}

export async function acceptStudioInvitation(context: ApiContext) {
  const session = await createAuth(context.env).api.getSession({ headers: context.req.raw.headers });
  if (!session) return context.json<ApiErrorBody>({ code: 'UNAUTHENTICATED', message: 'Authentication required.' }, 401);
  let body: unknown;
  try { body = await context.req.json(); } catch { body = undefined; }
  const parsed = invitationAcceptSchema.safeParse(body);
  if (!parsed.success) return context.json<ApiErrorBody>({ code: 'INVALID_INVITATION', message: 'Pozivnica nije valjana.' }, 422);
  const tokenHash = await hashInvitationToken(parsed.data.token);
  const invitation = await context.env.DB.prepare(
    `SELECT i.id, i.studio_id, i.email, i.role, i.status, i.expires_at, i.accepted_by_user_id, i.team_member_id, s.slug
     FROM studio_invitations i JOIN studios s ON s.id = i.studio_id
     WHERE i.token_hash = ?1 AND s.status = 'active' LIMIT 1`,
  ).bind(tokenHash).first<{
    id: string; studio_id: string; email: string; role: 'owner' | 'manager'; status: string;
    expires_at: number; accepted_by_user_id: string | null; team_member_id: string | null; slug: string;
  }>();
  if (!invitation) return context.json<ApiErrorBody>({ code: 'INVITATION_NOT_FOUND', message: 'Pozivnica nije pronađena.' }, 404);
  if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) {
    return context.json<ApiErrorBody>({ code: 'INVITATION_EMAIL_MISMATCH', message: 'Prijavite se e-mailom na koji je pozivnica poslana.' }, 403);
  }
  if (invitation.status === 'accepted' && invitation.accepted_by_user_id === session.user.id) {
    return context.json(invitationAcceptedSchema.parse({ studioSlug: invitation.slug, role: invitation.role }));
  }
  if (invitation.status !== 'pending' || invitation.expires_at <= Date.now()) {
    return context.json<ApiErrorBody>({ code: 'INVITATION_EXPIRED', message: 'Pozivnica više nije aktivna.' }, 410);
  }
  const now = Date.now();
  const statements = [
    context.env.DB.prepare(
      `INSERT INTO memberships (id, studio_id, user_id, role, status, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, 'active', ?5, ?5)
       ON CONFLICT (studio_id, user_id) DO UPDATE SET role = excluded.role, status = 'active', updated_at = excluded.updated_at`,
    ).bind(crypto.randomUUID(), invitation.studio_id, session.user.id, invitation.role, now),
    context.env.DB.prepare(
      `UPDATE studio_invitations SET status = 'accepted', accepted_by_user_id = ?1, accepted_at = ?2
       WHERE id = ?3 AND studio_id = ?4 AND status = 'pending'`,
    ).bind(session.user.id, now, invitation.id, invitation.studio_id),
    context.env.DB.prepare(
      `INSERT INTO audit_logs (id, studio_id, actor_user_id, action, entity_type, entity_id, diff_json, request_id, created_at)
       VALUES (?1, ?2, ?3, 'invitation.accepted', 'studio_invitation', ?4, ?5, ?6, ?7)`,
    ).bind(crypto.randomUUID(), invitation.studio_id, session.user.id, invitation.id, JSON.stringify({ role: invitation.role }), context.get('requestId'), now),
  ];
  if (invitation.team_member_id) {
    statements.splice(2, 0, context.env.DB.prepare(
      `UPDATE team_members SET user_id = ?1, updated_at = ?2
       WHERE id = ?3 AND studio_id = ?4 AND user_id IS NULL`,
    ).bind(session.user.id, now, invitation.team_member_id, invitation.studio_id));
  }
  try {
    await context.env.DB.batch(statements);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('UNIQUE') || message.includes('SQLITE_CONSTRAINT')) {
      return context.json<ApiErrorBody>({ code: 'MEMBERSHIP_CONFLICT', message: 'Korisnik već ima pristup ovom studiju.' }, 409);
    }
    throw error;
  }
  return context.json(invitationAcceptedSchema.parse({ studioSlug: invitation.slug, role: invitation.role }));
}
