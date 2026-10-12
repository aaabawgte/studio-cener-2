import {
  portfolioProjectSchema,
  portfolioProjectWriteSchema,
  studioSettingsSchema,
  studioSettingsWriteSchema,
  teamMemberSchema,
  teamMemberWriteSchema,
  type ApiErrorBody,
  type PortfolioProject,
  type TeamMember,
} from '@studio/contracts';
import type { Context } from 'hono';
import type { z } from 'zod';
import type { AuthBindings } from '../auth';
import { resolveStudioAccess } from '../authorization/studio-access';

type ApiEnvironment = { Bindings: AuthBindings; Variables: { requestId: string } };
type ApiContext = Context<ApiEnvironment>;

type TeamRow = {
  id: string;
  name: string;
  role_title: string;
  bio: string | null;
  image_r2_key: string | null;
  status: 'active' | 'hidden';
  sort_order: number;
};

type PortfolioRow = {
  id: string;
  title: string;
  artist_name: string;
  description: string | null;
  image_r2_key: string | null;
  status: 'draft' | 'published';
  sort_order: number;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function validationError(error: z.ZodError): ApiErrorBody {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { code: 'VALIDATION_ERROR', message: 'Provjerite unesene podatke.', fieldErrors };
}

async function readJson(context: ApiContext): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    return undefined;
  }
}

function routeParam(context: ApiContext, name: string): string {
  return context.req.param(name) ?? '';
}

function mediaUrl(context: ApiContext, slug: string, kind: 'team-members' | 'portfolio-projects', id: string) {
  return new URL(`/api/public/studios/${encodeURIComponent(slug)}/${kind}/${encodeURIComponent(id)}/image`, context.req.url).toString();
}

function mapTeam(context: ApiContext, slug: string, row: TeamRow): TeamMember {
  return teamMemberSchema.parse({
    id: row.id,
    name: row.name,
    roleTitle: row.role_title,
    bio: row.bio,
    imageUrl: row.image_r2_key ? mediaUrl(context, slug, 'team-members', row.id) : null,
    status: row.status,
    sortOrder: row.sort_order,
  });
}

function mapPortfolio(context: ApiContext, slug: string, row: PortfolioRow): PortfolioProject {
  return portfolioProjectSchema.parse({
    id: row.id,
    title: row.title,
    artistName: row.artist_name,
    description: row.description,
    imageUrl: row.image_r2_key ? mediaUrl(context, slug, 'portfolio-projects', row.id) : null,
    status: row.status,
    sortOrder: row.sort_order,
  });
}

async function audit(context: ApiContext, studioId: string, userId: string, action: string, entityType: string, entityId: string, diff: unknown) {
  await context.env.DB.prepare(
    `INSERT INTO audit_logs (id, studio_id, actor_user_id, action, entity_type, entity_id, diff_json, request_id, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
  ).bind(
    crypto.randomUUID(), studioId, userId, action, entityType, entityId,
    JSON.stringify(diff), context.get('requestId'), Date.now(),
  ).run();
}

export async function getStudioSettings(context: ApiContext) {
  const slug = routeParam(context, 'slug');
  const access = await resolveStudioAccess(context.env, context.req.raw, slug, 'studio.settings.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);

  const row = await context.env.DB.prepare(
    `SELECT id, slug, name, timezone, currency, description, address, accent_color, logo_r2_key
     FROM studios WHERE id = ?1`,
  ).bind(access.value.studio.id).first<{
    id: string; slug: string; name: string; timezone: string; currency: string;
    description: string | null; address: string | null; accent_color: string | null; logo_r2_key: string | null;
  }>();
  if (!row) return context.json<ApiErrorBody>({ code: 'STUDIO_NOT_FOUND', message: 'Studio not found.' }, 404);

  return context.json(studioSettingsSchema.parse({
    id: row.id,
    slug: row.slug,
    name: row.name,
    timezone: row.timezone,
    currency: row.currency,
    description: row.description,
    address: row.address,
    branding: {
      accentColor: row.accent_color,
      logoUrl: row.logo_r2_key ? new URL(`/api/public/studios/${encodeURIComponent(row.slug)}/logo`, context.req.url).toString() : null,
    },
  }));
}

export async function updateStudioSettings(context: ApiContext) {
  const slug = routeParam(context, 'slug');
  const access = await resolveStudioAccess(context.env, context.req.raw, slug, 'studio.settings.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const parsed = studioSettingsWriteSchema.safeParse(await readJson(context));
  if (!parsed.success) return context.json(validationError(parsed.error), 422);

  const now = Date.now();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE studios SET name = ?1, description = ?2, address = ?3, accent_color = ?4, updated_at = ?5 WHERE id = ?6`,
    ).bind(parsed.data.name, parsed.data.description || null, parsed.data.address || null, parsed.data.accentColor, now, access.value.studio.id),
    context.env.DB.prepare(
      `INSERT INTO audit_logs (id, studio_id, actor_user_id, action, entity_type, entity_id, diff_json, request_id, created_at)
       VALUES (?1, ?2, ?3, 'studio.settings.updated', 'studio', ?2, ?4, ?5, ?6)`,
    ).bind(crypto.randomUUID(), access.value.studio.id, access.value.actor.userId, JSON.stringify(parsed.data), context.get('requestId'), now),
  ]);
  return getStudioSettings(context);
}

export async function listTeamMembers(context: ApiContext) {
  const slug = routeParam(context, 'slug');
  const access = await resolveStudioAccess(context.env, context.req.raw, slug, 'team.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const rows = await context.env.DB.prepare(
    `SELECT id, name, role_title, bio, image_r2_key, status, sort_order FROM team_members
     WHERE studio_id = ?1 ORDER BY sort_order, name`,
  ).bind(access.value.studio.id).all<TeamRow>();
  return context.json({ teamMembers: rows.results.map((row) => mapTeam(context, access.value.studio.slug, row)) });
}

export async function createTeamMember(context: ApiContext) {
  const slug = routeParam(context, 'slug');
  const access = await resolveStudioAccess(context.env, context.req.raw, slug, 'team.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const parsed = teamMemberWriteSchema.safeParse(await readJson(context));
  if (!parsed.success) return context.json(validationError(parsed.error), 422);
  const id = crypto.randomUUID();
  const now = Date.now();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO team_members (id, studio_id, name, role_title, bio, status, sort_order, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)`,
    ).bind(id, access.value.studio.id, parsed.data.name, parsed.data.roleTitle, parsed.data.bio || null, parsed.data.status ?? 'active', parsed.data.sortOrder ?? 0, now),
    context.env.DB.prepare(
      `INSERT INTO audit_logs (id, studio_id, actor_user_id, action, entity_type, entity_id, diff_json, request_id, created_at)
       VALUES (?1, ?2, ?3, 'team_member.created', 'team_member', ?4, ?5, ?6, ?7)`,
    ).bind(crypto.randomUUID(), access.value.studio.id, access.value.actor.userId, id, JSON.stringify(parsed.data), context.get('requestId'), now),
  ]);
  const row = await context.env.DB.prepare(
    'SELECT id, name, role_title, bio, image_r2_key, status, sort_order FROM team_members WHERE studio_id = ?1 AND id = ?2',
  ).bind(access.value.studio.id, id).first<TeamRow>();
  return context.json(mapTeam(context, access.value.studio.slug, row!), 201);
}

export async function updateTeamMember(context: ApiContext) {
  const slug = routeParam(context, 'slug');
  const access = await resolveStudioAccess(context.env, context.req.raw, slug, 'team.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const id = routeParam(context, 'memberId');
  const parsed = teamMemberWriteSchema.safeParse(await readJson(context));
  if (!parsed.success) return context.json(validationError(parsed.error), 422);
  const result = await context.env.DB.prepare(
    `UPDATE team_members SET name = ?1, role_title = ?2, bio = ?3, status = ?4, sort_order = ?5, updated_at = ?6
     WHERE studio_id = ?7 AND id = ?8`,
  ).bind(parsed.data.name, parsed.data.roleTitle, parsed.data.bio || null, parsed.data.status ?? 'active', parsed.data.sortOrder ?? 0, Date.now(), access.value.studio.id, id).run();
  if (!result.meta.changes) return context.json<ApiErrorBody>({ code: 'TEAM_MEMBER_NOT_FOUND', message: 'Član tima nije pronađen.' }, 404);
  await audit(context, access.value.studio.id, access.value.actor.userId, 'team_member.updated', 'team_member', id, parsed.data);
  const row = await context.env.DB.prepare(
    'SELECT id, name, role_title, bio, image_r2_key, status, sort_order FROM team_members WHERE studio_id = ?1 AND id = ?2',
  ).bind(access.value.studio.id, id).first<TeamRow>();
  return context.json(mapTeam(context, access.value.studio.slug, row!));
}

export async function listPortfolioProjects(context: ApiContext) {
  const slug = routeParam(context, 'slug');
  const access = await resolveStudioAccess(context.env, context.req.raw, slug, 'portfolio.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const rows = await context.env.DB.prepare(
    `SELECT id, title, artist_name, description, image_r2_key, status, sort_order FROM portfolio_projects
     WHERE studio_id = ?1 ORDER BY sort_order, title`,
  ).bind(access.value.studio.id).all<PortfolioRow>();
  return context.json({ portfolioProjects: rows.results.map((row) => mapPortfolio(context, access.value.studio.slug, row)) });
}

export async function createPortfolioProject(context: ApiContext) {
  const slug = routeParam(context, 'slug');
  const access = await resolveStudioAccess(context.env, context.req.raw, slug, 'portfolio.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const parsed = portfolioProjectWriteSchema.safeParse(await readJson(context));
  if (!parsed.success) return context.json(validationError(parsed.error), 422);
  const id = crypto.randomUUID();
  const now = Date.now();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO portfolio_projects (id, studio_id, title, artist_name, description, status, sort_order, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)`,
    ).bind(id, access.value.studio.id, parsed.data.title, parsed.data.artistName, parsed.data.description || null, parsed.data.status ?? 'draft', parsed.data.sortOrder ?? 0, now),
    context.env.DB.prepare(
      `INSERT INTO audit_logs (id, studio_id, actor_user_id, action, entity_type, entity_id, diff_json, request_id, created_at)
       VALUES (?1, ?2, ?3, 'portfolio_project.created', 'portfolio_project', ?4, ?5, ?6, ?7)`,
    ).bind(crypto.randomUUID(), access.value.studio.id, access.value.actor.userId, id, JSON.stringify(parsed.data), context.get('requestId'), now),
  ]);
  const row = await context.env.DB.prepare(
    'SELECT id, title, artist_name, description, image_r2_key, status, sort_order FROM portfolio_projects WHERE studio_id = ?1 AND id = ?2',
  ).bind(access.value.studio.id, id).first<PortfolioRow>();
  return context.json(mapPortfolio(context, access.value.studio.slug, row!), 201);
}

export async function updatePortfolioProject(context: ApiContext) {
  const slug = routeParam(context, 'slug');
  const access = await resolveStudioAccess(context.env, context.req.raw, slug, 'portfolio.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const id = routeParam(context, 'projectId');
  const parsed = portfolioProjectWriteSchema.safeParse(await readJson(context));
  if (!parsed.success) return context.json(validationError(parsed.error), 422);
  const result = await context.env.DB.prepare(
    `UPDATE portfolio_projects SET title = ?1, artist_name = ?2, description = ?3, status = ?4, sort_order = ?5, updated_at = ?6
     WHERE studio_id = ?7 AND id = ?8`,
  ).bind(parsed.data.title, parsed.data.artistName, parsed.data.description || null, parsed.data.status ?? 'draft', parsed.data.sortOrder ?? 0, Date.now(), access.value.studio.id, id).run();
  if (!result.meta.changes) return context.json<ApiErrorBody>({ code: 'PORTFOLIO_PROJECT_NOT_FOUND', message: 'Projekt nije pronađen.' }, 404);
  await audit(context, access.value.studio.id, access.value.actor.userId, 'portfolio_project.updated', 'portfolio_project', id, parsed.data);
  const row = await context.env.DB.prepare(
    'SELECT id, title, artist_name, description, image_r2_key, status, sort_order FROM portfolio_projects WHERE studio_id = ?1 AND id = ?2',
  ).bind(access.value.studio.id, id).first<PortfolioRow>();
  return context.json(mapPortfolio(context, access.value.studio.slug, row!));
}

function detectImage(bytes: Uint8Array, declaredType: string): { contentType: string; extension: string } | null {
  const png = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const webp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (png && declaredType === 'image/png') return { contentType: 'image/png', extension: 'png' };
  if (jpeg && declaredType === 'image/jpeg') return { contentType: 'image/jpeg', extension: 'jpg' };
  if (webp && declaredType === 'image/webp') return { contentType: 'image/webp', extension: 'webp' };
  return null;
}

async function parseImage(context: ApiContext) {
  const contentLength = Number(context.req.header('content-length') ?? 0);
  if (contentLength > MAX_IMAGE_BYTES + 100_000) return { error: context.json<ApiErrorBody>({ code: 'IMAGE_TOO_LARGE', message: 'Slika može imati najviše 5 MB.' }, 413) };
  let form: FormData;
  try {
    form = await context.req.formData();
  } catch {
    return { error: context.json<ApiErrorBody>({ code: 'INVALID_UPLOAD', message: 'Upload nije valjan.' }, 400) };
  }
  const file = form.get('file');
  if (!(file instanceof File)) return { error: context.json<ApiErrorBody>({ code: 'IMAGE_REQUIRED', message: 'Odaberite sliku.' }, 422) };
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) return { error: context.json<ApiErrorBody>({ code: 'IMAGE_TOO_LARGE', message: 'Slika može imati najviše 5 MB.' }, 413) };
  const buffer = await file.arrayBuffer();
  const detected = detectImage(new Uint8Array(buffer), file.type);
  if (!detected) return { error: context.json<ApiErrorBody>({ code: 'INVALID_IMAGE', message: 'Podržani su JPG, PNG i WebP formati.' }, 422) };
  return { buffer, ...detected };
}

type UploadKind = 'logo' | 'team' | 'portfolio';

export async function uploadStudioImage(context: ApiContext, kind: UploadKind) {
  const slug = routeParam(context, 'slug');
  const permission = kind === 'logo' ? 'studio.settings.manage' : kind === 'team' ? 'team.manage' : 'portfolio.manage';
  const access = await resolveStudioAccess(context.env, context.req.raw, slug, permission);
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const parsed = await parseImage(context);
  if ('error' in parsed) return parsed.error;

  const entityId = kind === 'logo' ? access.value.studio.id : routeParam(context, kind === 'team' ? 'memberId' : 'projectId');
  const table = kind === 'logo' ? 'studios' : kind === 'team' ? 'team_members' : 'portfolio_projects';
  const current = await context.env.DB.prepare(
    `SELECT image_r2_key FROM ${table === 'studios' ? '(SELECT logo_r2_key AS image_r2_key, id FROM studios)' : table} WHERE id = ?1${table === 'studios' ? '' : ' AND studio_id = ?2'}`,
  ).bind(...(table === 'studios' ? [entityId] : [entityId, access.value.studio.id])).first<{ image_r2_key: string | null }>();
  if (!current) return context.json<ApiErrorBody>({ code: 'MEDIA_TARGET_NOT_FOUND', message: 'Sadržaj nije pronađen.' }, 404);

  const key = `studios/${access.value.studio.id}/${kind}/${entityId}/${crypto.randomUUID()}.${parsed.extension}`;
  await context.env.MEDIA.put(key, parsed.buffer, {
    httpMetadata: { contentType: parsed.contentType },
    customMetadata: { studioId: access.value.studio.id, uploadedBy: access.value.actor.userId },
  });
  try {
    const column = kind === 'logo' ? 'logo_r2_key' : 'image_r2_key';
    const sql = table === 'studios'
      ? `UPDATE studios SET ${column} = ?1, updated_at = ?2 WHERE id = ?3`
      : `UPDATE ${table} SET ${column} = ?1, updated_at = ?2 WHERE id = ?3 AND studio_id = ?4`;
    await context.env.DB.prepare(sql).bind(...(table === 'studios' ? [key, Date.now(), entityId] : [key, Date.now(), entityId, access.value.studio.id])).run();
    await audit(context, access.value.studio.id, access.value.actor.userId, `${kind}.image.updated`, table, entityId, { contentType: parsed.contentType });
  } catch (error) {
    await context.env.MEDIA.delete(key);
    throw error;
  }
  if (current.image_r2_key) context.executionCtx.waitUntil(context.env.MEDIA.delete(current.image_r2_key));

  const url = kind === 'logo'
    ? new URL(`/api/public/studios/${encodeURIComponent(access.value.studio.slug)}/logo`, context.req.url).toString()
    : mediaUrl(context, access.value.studio.slug, kind === 'team' ? 'team-members' : 'portfolio-projects', entityId);
  return context.json({ imageUrl: url });
}

async function sendR2Object(context: ApiContext, key: string | null) {
  if (!key) return context.json<ApiErrorBody>({ code: 'IMAGE_NOT_FOUND', message: 'Slika nije pronađena.' }, 404);
  const object = await context.env.MEDIA.get(key);
  if (!object) return context.json<ApiErrorBody>({ code: 'IMAGE_NOT_FOUND', message: 'Slika nije pronađena.' }, 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  headers.set('X-Content-Type-Options', 'nosniff');
  if (context.req.header('if-none-match') === object.httpEtag) return new Response(null, { status: 304, headers });
  return new Response(object.body, { headers });
}

export async function getPublicLogo(context: ApiContext) {
  const row = await context.env.DB.prepare(
    `SELECT logo_r2_key FROM studios WHERE slug = ?1 COLLATE NOCASE AND status = 'active' LIMIT 1`,
  ).bind(routeParam(context, 'slug')).first<{ logo_r2_key: string | null }>();
  return sendR2Object(context, row?.logo_r2_key ?? null);
}

export async function getPublicTeamImage(context: ApiContext) {
  const row = await context.env.DB.prepare(
    `SELECT tm.image_r2_key FROM team_members tm JOIN studios s ON s.id = tm.studio_id
     WHERE s.slug = ?1 COLLATE NOCASE AND s.status = 'active' AND tm.id = ?2 AND tm.status = 'active' LIMIT 1`,
  ).bind(routeParam(context, 'slug'), routeParam(context, 'memberId')).first<{ image_r2_key: string | null }>();
  return sendR2Object(context, row?.image_r2_key ?? null);
}

export async function getPublicPortfolioImage(context: ApiContext) {
  const row = await context.env.DB.prepare(
    `SELECT pp.image_r2_key FROM portfolio_projects pp JOIN studios s ON s.id = pp.studio_id
     WHERE s.slug = ?1 COLLATE NOCASE AND s.status = 'active' AND pp.id = ?2 AND pp.status = 'published' LIMIT 1`,
  ).bind(routeParam(context, 'slug'), routeParam(context, 'projectId')).first<{ image_r2_key: string | null }>();
  return sendR2Object(context, row?.image_r2_key ?? null);
}

export async function loadPublicContent(context: ApiContext, studioId: string, slug: string) {
  const results = await context.env.DB.batch([
    context.env.DB.prepare(
      `SELECT id, name, role_title, bio, image_r2_key, status, sort_order FROM team_members
       WHERE studio_id = ?1 AND status = 'active' ORDER BY sort_order, name`,
    ).bind(studioId),
    context.env.DB.prepare(
      `SELECT id, title, artist_name, description, image_r2_key, status, sort_order FROM portfolio_projects
       WHERE studio_id = ?1 AND status = 'published' ORDER BY sort_order, title`,
    ).bind(studioId),
  ]);
  return {
    teamMembers: (results[0]!.results as unknown as TeamRow[]).map((row) => mapTeam(context, slug, row)),
    portfolioProjects: (results[1]!.results as unknown as PortfolioRow[]).map((row) => mapPortfolio(context, slug, row)),
  };
}
