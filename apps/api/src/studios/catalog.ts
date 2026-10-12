import {
  availabilityRulesWriteSchema,
  publicStudioSchema,
  serviceSchema,
  serviceWriteSchema,
  type ApiErrorBody,
  type AvailabilityRule,
  type Service,
} from '@studio/contracts';
import type { Context } from 'hono';
import { z } from 'zod';
import type { AuthBindings } from '../auth';
import { resolveStudioAccess } from '../authorization/studio-access';

type ApiEnvironment = { Bindings: AuthBindings; Variables: { requestId: string } };
type ApiContext = Context<ApiEnvironment>;

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_minor: number;
  currency: string;
  status: 'active' | 'archived';
  sort_order: number;
};

type AvailabilityRow = {
  id: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
};

function mapService(row: ServiceRow): Service {
  return serviceSchema.parse({
    id: row.id,
    name: row.name,
    description: row.description,
    durationMinutes: row.duration_minutes,
    priceMinor: row.price_minor,
    currency: row.currency,
    status: row.status,
    sortOrder: row.sort_order,
  });
}

function mapRule(row: AvailabilityRow): AvailabilityRule {
  return { id: row.id, weekday: row.weekday, startMinute: row.start_minute, endMinute: row.end_minute };
}

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

export async function getPublicStudio(context: ApiContext) {
  const slug = routeParam(context, 'slug').trim().toLowerCase();
  const studio = await context.env.DB.prepare(
    `SELECT id, slug, name, timezone, currency, accent_color, logo_r2_key, description, address
     FROM studios WHERE slug = ?1 COLLATE NOCASE AND status = 'active' LIMIT 1`,
  ).bind(slug).first<{
    id: string; slug: string; name: string; timezone: string; currency: string;
    accent_color: string | null; logo_r2_key: string | null; description: string | null; address: string | null;
  }>();

  if (!studio) return context.json<ApiErrorBody>({ code: 'STUDIO_NOT_FOUND', message: 'Studio not found.' }, 404);

  const results = await context.env.DB.batch([
    context.env.DB.prepare(
      `SELECT id, name, description, duration_minutes, price_minor, currency, status, sort_order
       FROM services WHERE studio_id = ?1 AND status = 'active' ORDER BY sort_order, name`,
    ).bind(studio.id),
    context.env.DB.prepare(
      `SELECT ar.id, ar.weekday, ar.start_minute, ar.end_minute
       FROM availability_rules ar
       JOIN bookable_resources br ON br.studio_id = ar.studio_id AND br.id = ar.resource_id
       WHERE ar.studio_id = ?1 AND br.status = 'active'
       ORDER BY ar.weekday, ar.start_minute`,
    ).bind(studio.id),
  ]);
  const servicesResult = results[0]!;
  const rulesResult = results[1]!;

  const logoUrl = studio.logo_r2_key
    ? new URL(`/api/public/studios/${encodeURIComponent(studio.slug)}/logo`, context.req.url).toString()
    : null;

  return context.json(publicStudioSchema.parse({
    studio: {
      id: studio.id,
      slug: studio.slug,
      name: studio.name,
      timezone: studio.timezone,
      currency: studio.currency,
      description: studio.description,
      address: studio.address,
      branding: { accentColor: studio.accent_color, logoUrl },
    },
    services: (servicesResult.results as unknown as ServiceRow[]).map(mapService),
    availabilityRules: (rulesResult.results as unknown as AvailabilityRow[]).map(mapRule),
  }));
}

export async function listServices(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, routeParam(context, 'slug'), 'services.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const result = await context.env.DB.prepare(
    `SELECT id, name, description, duration_minutes, price_minor, currency, status, sort_order
     FROM services WHERE studio_id = ?1 ORDER BY status, sort_order, name`,
  ).bind(access.value.studio.id).all<ServiceRow>();
  return context.json({ services: result.results.map(mapService) });
}

export async function createService(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, routeParam(context, 'slug'), 'services.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const parsed = serviceWriteSchema.safeParse(await readJson(context));
  if (!parsed.success) return context.json(validationError(parsed.error), 422);

  const id = crypto.randomUUID();
  const now = Date.now();
  const service = serviceSchema.parse({
    id,
    name: parsed.data.name,
    description: parsed.data.description || null,
    durationMinutes: parsed.data.durationMinutes,
    priceMinor: parsed.data.priceMinor,
    currency: access.value.studio.currency,
    status: parsed.data.status ?? 'active',
    sortOrder: parsed.data.sortOrder ?? 0,
  });
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO services
       (id, studio_id, name, description, duration_minutes, price_minor, currency, status, sort_order, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)`,
    ).bind(id, access.value.studio.id, service.name, service.description, service.durationMinutes, service.priceMinor, service.currency, service.status, service.sortOrder, now),
    context.env.DB.prepare(
      `INSERT INTO audit_logs (id, studio_id, actor_user_id, action, entity_type, entity_id, diff_json, request_id, created_at)
       VALUES (?1, ?2, ?3, 'service.created', 'service', ?4, ?5, ?6, ?7)`,
    ).bind(crypto.randomUUID(), access.value.studio.id, access.value.actor.userId, id, JSON.stringify({ after: service }), context.get('requestId'), now),
  ]);
  return context.json(service, 201);
}

export async function updateService(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, routeParam(context, 'slug'), 'services.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const parsed = serviceWriteSchema.safeParse(await readJson(context));
  if (!parsed.success) return context.json(validationError(parsed.error), 422);

  const current = await context.env.DB.prepare(
    `SELECT id, name, description, duration_minutes, price_minor, currency, status, sort_order
     FROM services WHERE studio_id = ?1 AND id = ?2 LIMIT 1`,
  ).bind(access.value.studio.id, routeParam(context, 'serviceId')).first<ServiceRow>();
  if (!current) return context.json<ApiErrorBody>({ code: 'SERVICE_NOT_FOUND', message: 'Service not found.' }, 404);

  const service = serviceSchema.parse({
    id: current.id,
    name: parsed.data.name,
    description: parsed.data.description || null,
    durationMinutes: parsed.data.durationMinutes,
    priceMinor: parsed.data.priceMinor,
    currency: access.value.studio.currency,
    status: parsed.data.status ?? current.status,
    sortOrder: parsed.data.sortOrder ?? current.sort_order,
  });
  const now = Date.now();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE services SET name = ?1, description = ?2, duration_minutes = ?3, price_minor = ?4,
       currency = ?5, status = ?6, sort_order = ?7, updated_at = ?8
       WHERE studio_id = ?9 AND id = ?10`,
    ).bind(service.name, service.description, service.durationMinutes, service.priceMinor, service.currency, service.status, service.sortOrder, now, access.value.studio.id, service.id),
    context.env.DB.prepare(
      `INSERT INTO audit_logs (id, studio_id, actor_user_id, action, entity_type, entity_id, diff_json, request_id, created_at)
       VALUES (?1, ?2, ?3, 'service.updated', 'service', ?4, ?5, ?6, ?7)`,
    ).bind(crypto.randomUUID(), access.value.studio.id, access.value.actor.userId, service.id, JSON.stringify({ before: mapService(current), after: service }), context.get('requestId'), now),
  ]);
  return context.json(service);
}

export async function listAvailabilityRules(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, routeParam(context, 'slug'), 'hours.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const result = await context.env.DB.prepare(
    `SELECT ar.id, ar.weekday, ar.start_minute, ar.end_minute
     FROM availability_rules ar
     JOIN bookable_resources br ON br.studio_id = ar.studio_id AND br.id = ar.resource_id
     WHERE ar.studio_id = ?1 AND br.status = 'active'
     ORDER BY ar.weekday, ar.start_minute`,
  ).bind(access.value.studio.id).all<AvailabilityRow>();
  return context.json({ rules: result.results.map(mapRule), timezone: access.value.studio.timezone });
}

export async function replaceAvailabilityRules(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, routeParam(context, 'slug'), 'hours.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const parsed = availabilityRulesWriteSchema.safeParse(await readJson(context));
  if (!parsed.success) return context.json(validationError(parsed.error), 422);

  for (const weekday of Array.from({ length: 7 }, (_, index) => index)) {
    const dayRules = parsed.data.rules.filter((rule) => rule.weekday === weekday).sort((a, b) => a.startMinute - b.startMinute);
    if (dayRules.length > 1) {
      return context.json<ApiErrorBody>({ code: 'MULTIPLE_DAILY_INTERVALS', message: 'Za svaki dan trenutno je podržan jedan radni interval.' }, 422);
    }
    if (dayRules.some((rule, index) => index > 0 && rule.startMinute < dayRules[index - 1]!.endMinute)) {
      return context.json<ApiErrorBody>({ code: 'OVERLAPPING_HOURS', message: 'Radni intervali istog dana ne smiju se preklapati.' }, 422);
    }
  }

  const studioId = access.value.studio.id;
  const resourceId = `main:${studioId}`;
  const now = Date.now();
  const statements = [
    context.env.DB.prepare(
      `INSERT OR IGNORE INTO bookable_resources (id, studio_id, name, status, sort_order, created_at, updated_at)
       VALUES (?1, ?2, 'Glavni studio', 'active', 0, ?3, ?3)`,
    ).bind(resourceId, studioId, now),
    context.env.DB.prepare('DELETE FROM availability_rules WHERE studio_id = ?1 AND resource_id = ?2').bind(studioId, resourceId),
    ...parsed.data.rules.map((rule) => context.env.DB.prepare(
      `INSERT INTO availability_rules
       (id, studio_id, resource_id, weekday, start_minute, end_minute, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)`,
    ).bind(crypto.randomUUID(), studioId, resourceId, rule.weekday, rule.startMinute, rule.endMinute, now)),
    context.env.DB.prepare(
      `INSERT INTO audit_logs (id, studio_id, actor_user_id, action, entity_type, entity_id, diff_json, request_id, created_at)
       VALUES (?1, ?2, ?3, 'availability.replaced', 'availability_rules', ?2, ?4, ?5, ?6)`,
    ).bind(crypto.randomUUID(), studioId, access.value.actor.userId, JSON.stringify({ rules: parsed.data.rules }), context.get('requestId'), now),
  ];
  await context.env.DB.batch(statements);

  const saved = await context.env.DB.prepare(
    `SELECT id, weekday, start_minute, end_minute FROM availability_rules
     WHERE studio_id = ?1 AND resource_id = ?2 ORDER BY weekday, start_minute`,
  ).bind(studioId, resourceId).all<AvailabilityRow>();
  return context.json({ rules: saved.results.map(mapRule), timezone: access.value.studio.timezone });
}
