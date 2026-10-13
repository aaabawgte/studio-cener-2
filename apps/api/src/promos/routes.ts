import {
  promoCodeSchema,
  promoCodeWriteSchema,
  promoQuoteRequestSchema,
  promoQuoteSchema,
  type ApiErrorBody,
  type PromoCode,
} from '@studio/contracts';
import type { Context } from 'hono';
import type { z } from 'zod';
import type { AuthBindings } from '../auth';
import { resolveStudioAccess } from '../authorization/studio-access';

type ApiContext = Context<{ Bindings: AuthBindings; Variables: { requestId: string } }>;
type PromoRow = {
  id: string; code: string; description: string | null; discount_type: 'percentage' | 'fixed'; discount_value: number;
  max_discount_minor: number | null; minimum_spend_minor: number; valid_from: number; valid_until: number;
  max_redemptions: number | null; max_redemptions_per_user: number; status: 'active' | 'archived'; redemption_count: number;
};

const param = (context: ApiContext, name: string) => context.req.param(name) ?? '';
const readJson = async (context: ApiContext) => { try { return await context.req.json(); } catch { return undefined; } };

function validationError(error: z.ZodError): ApiErrorBody {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) { const key = issue.path[0]; if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = issue.message; }
  return { code: 'VALIDATION_ERROR', message: 'Provjerite unesene podatke.', fieldErrors };
}

function mapPromo(row: PromoRow): PromoCode {
  return promoCodeSchema.parse({ id: row.id, code: row.code, description: row.description, discountType: row.discount_type,
    discountValue: row.discount_value, maxDiscountMinor: row.max_discount_minor, minimumSpendMinor: row.minimum_spend_minor,
    validFrom: new Date(row.valid_from).toISOString(), validUntil: new Date(row.valid_until).toISOString(),
    maxRedemptions: row.max_redemptions, maxRedemptionsPerUser: row.max_redemptions_per_user,
    redemptionCount: row.redemption_count, status: row.status });
}

export type ResolvedPromo = { id: string; code: string; discountMinor: number };
export type PromoResolution = { ok: true; promo: ResolvedPromo } | { ok: false; code: string; message: string };

export async function resolvePromo(env: AuthBindings, input: { studioId: string; userId: string; code: string; subtotalMinor: number; now: number }): Promise<PromoResolution> {
  const row = await env.DB.prepare(
    `SELECT p.id, p.code, p.discount_type, p.discount_value, p.max_discount_minor, p.minimum_spend_minor,
      p.valid_from, p.valid_until, p.max_redemptions, p.max_redemptions_per_user,
      (SELECT count(*) FROM promo_redemptions r WHERE r.studio_id=p.studio_id AND r.promo_code_id=p.id AND r.status='applied') AS total_count,
      (SELECT count(*) FROM promo_redemptions r WHERE r.studio_id=p.studio_id AND r.promo_code_id=p.id AND r.user_id=?3 AND r.status='applied') AS user_count
     FROM promo_codes p WHERE p.studio_id=?1 AND p.code=?2 COLLATE NOCASE AND p.status='active' LIMIT 1`,
  ).bind(input.studioId, input.code.trim().toUpperCase(), input.userId).first<{
    id: string; code: string; discount_type: 'percentage'|'fixed'; discount_value: number; max_discount_minor: number|null;
    minimum_spend_minor: number; valid_from: number; valid_until: number; max_redemptions: number|null;
    max_redemptions_per_user: number; total_count: number; user_count: number;
  }>();
  if (!row) return { ok: false, code: 'PROMO_NOT_FOUND', message: 'Promo kod nije pronađen.' };
  if (input.now < row.valid_from || input.now >= row.valid_until) return { ok: false, code: 'PROMO_INACTIVE', message: 'Promo kod trenutno nije aktivan.' };
  if (input.subtotalMinor < row.minimum_spend_minor) return { ok: false, code: 'PROMO_MINIMUM_NOT_MET', message: 'Minimalni iznos za ovaj promo kod nije dosegnut.' };
  if (row.max_redemptions !== null && row.total_count >= row.max_redemptions) return { ok: false, code: 'PROMO_LIMIT_REACHED', message: 'Promo kod je iskorišten maksimalan broj puta.' };
  if (row.user_count >= row.max_redemptions_per_user) return { ok: false, code: 'PROMO_USER_LIMIT_REACHED', message: 'Već ste iskoristili ovaj promo kod.' };
  let discount = row.discount_type === 'percentage' ? Math.floor(input.subtotalMinor * row.discount_value / 100) : row.discount_value;
  if (row.max_discount_minor !== null) discount = Math.min(discount, row.max_discount_minor);
  discount = Math.min(discount, input.subtotalMinor);
  if (discount <= 0) return { ok: false, code: 'PROMO_NO_DISCOUNT', message: 'Promo kod nema primjenjiv popust.' };
  return { ok: true, promo: { id: row.id, code: row.code, discountMinor: discount } };
}

export async function listPromoCodes(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, param(context, 'slug'), 'promos.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const result = await context.env.DB.prepare(
    `SELECT p.id,p.code,p.description,p.discount_type,p.discount_value,p.max_discount_minor,p.minimum_spend_minor,
      p.valid_from,p.valid_until,p.max_redemptions,p.max_redemptions_per_user,p.status,
      (SELECT count(*) FROM promo_redemptions r WHERE r.studio_id=p.studio_id AND r.promo_code_id=p.id AND r.status='applied') AS redemption_count
     FROM promo_codes p WHERE p.studio_id=?1 ORDER BY p.status, p.created_at DESC`,
  ).bind(access.value.studio.id).all<PromoRow>();
  return context.json({ promoCodes: result.results.map(mapPromo) });
}

async function writePromo(context: ApiContext, id?: string) {
  const access = await resolveStudioAccess(context.env, context.req.raw, param(context, 'slug'), 'promos.manage');
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const parsed = promoCodeWriteSchema.safeParse(await readJson(context));
  if (!parsed.success) return context.json(validationError(parsed.error), 422);
  const current = id ? await context.env.DB.prepare('SELECT id FROM promo_codes WHERE studio_id=?1 AND id=?2 LIMIT 1').bind(access.value.studio.id, id).first() : null;
  if (id && !current) return context.json<ApiErrorBody>({ code: 'PROMO_NOT_FOUND', message: 'Promo kod nije pronađen.' }, 404);
  const promoId = id ?? crypto.randomUUID(); const now = Date.now(); const data = parsed.data;
  try {
    if (id) {
      await context.env.DB.batch([
        context.env.DB.prepare(
          `UPDATE promo_codes SET code=?1,description=?2,discount_type=?3,discount_value=?4,max_discount_minor=?5,minimum_spend_minor=?6,
           valid_from=?7,valid_until=?8,max_redemptions=?9,max_redemptions_per_user=?10,status=?11,updated_at=?12 WHERE studio_id=?13 AND id=?14`,
        ).bind(data.code, data.description || null, data.discountType, data.discountValue, data.maxDiscountMinor ?? null, data.minimumSpendMinor ?? 0,
          Date.parse(data.validFrom), Date.parse(data.validUntil), data.maxRedemptions ?? null, data.maxRedemptionsPerUser ?? 1,
          data.status ?? 'active', now, access.value.studio.id, promoId),
        context.env.DB.prepare(`INSERT INTO audit_logs (id,studio_id,actor_user_id,action,entity_type,entity_id,diff_json,request_id,created_at) VALUES (?1,?2,?3,'promo_code.updated','promo_code',?4,?5,?6,?7)`)
          .bind(crypto.randomUUID(), access.value.studio.id, access.value.actor.userId, promoId, JSON.stringify({ after: data }), context.get('requestId'), now),
      ]);
    } else {
      await context.env.DB.batch([
        context.env.DB.prepare(
          `INSERT INTO promo_codes (id,studio_id,code,description,discount_type,discount_value,max_discount_minor,minimum_spend_minor,valid_from,valid_until,max_redemptions,max_redemptions_per_user,status,created_at,updated_at)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?14)`,
        ).bind(promoId, access.value.studio.id, data.code, data.description || null, data.discountType, data.discountValue,
          data.maxDiscountMinor ?? null, data.minimumSpendMinor ?? 0, Date.parse(data.validFrom), Date.parse(data.validUntil),
          data.maxRedemptions ?? null, data.maxRedemptionsPerUser ?? 1, data.status ?? 'active', now),
        context.env.DB.prepare(`INSERT INTO audit_logs (id,studio_id,actor_user_id,action,entity_type,entity_id,diff_json,request_id,created_at) VALUES (?1,?2,?3,'promo_code.created','promo_code',?4,?5,?6,?7)`)
          .bind(crypto.randomUUID(), access.value.studio.id, access.value.actor.userId, promoId, JSON.stringify({ after: data }), context.get('requestId'), now),
      ]);
    }
  } catch (error) {
    if (String(error).includes('UNIQUE')) return context.json<ApiErrorBody>({ code: 'PROMO_CODE_EXISTS', message: 'Promo kod s tim nazivom već postoji.' }, 409);
    throw error;
  }
  const row = await context.env.DB.prepare(
    `SELECT p.id,p.code,p.description,p.discount_type,p.discount_value,p.max_discount_minor,p.minimum_spend_minor,p.valid_from,p.valid_until,
     p.max_redemptions,p.max_redemptions_per_user,p.status,0 AS redemption_count FROM promo_codes p WHERE p.studio_id=?1 AND p.id=?2`,
  ).bind(access.value.studio.id, promoId).first<PromoRow>();
  return context.json(mapPromo(row!), id ? 200 : 201);
}

export const createPromoCode = (context: ApiContext) => writePromo(context);
export const updatePromoCode = (context: ApiContext) => writePromo(context, param(context, 'promoId'));

export async function validatePromoCode(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, param(context, 'slug'));
  if (!access.ok) return context.json(access.error.body, access.error.status);
  if (access.value.actor.role !== 'artist') return context.json<ApiErrorBody>({ code: 'ARTIST_REQUIRED', message: 'Artist pristup je obavezan.' }, 403);
  const parsed = promoQuoteRequestSchema.safeParse(await readJson(context));
  if (!parsed.success) return context.json(validationError(parsed.error), 422);
  const service = await context.env.DB.prepare('SELECT price_minor FROM services WHERE studio_id=?1 AND id=?2 AND status=\'active\' LIMIT 1')
    .bind(access.value.studio.id, parsed.data.serviceId).first<{ price_minor: number }>();
  if (!service) return context.json<ApiErrorBody>({ code: 'SERVICE_NOT_FOUND', message: 'Usluga nije pronađena.' }, 404);
  const resolution = await resolvePromo(context.env, { studioId: access.value.studio.id, userId: access.value.actor.userId,
    code: parsed.data.code, subtotalMinor: service.price_minor, now: Date.now() });
  if (!resolution.ok) return context.json<ApiErrorBody>({ code: resolution.code, message: resolution.message }, 422);
  return context.json(promoQuoteSchema.parse({ code: resolution.promo.code, subtotalPriceMinor: service.price_minor,
    discountMinor: resolution.promo.discountMinor, totalPriceMinor: service.price_minor - resolution.promo.discountMinor,
    currency: access.value.studio.currency }));
}
