import {
  artistValueAccountSchema,
  creditEntryCreateSchema,
  hourPackageSchema,
  hourPackageWriteSchema,
  packageEntryCreateSchema,
  packageGrantSchema,
  valueArtistSchema,
  type ApiErrorBody,
  type ArtistValueAccount,
  type HourPackage,
} from '@studio/contracts';
import type { Context } from 'hono';
import type { z } from 'zod';
import type { AuthBindings } from '../auth';
import { resolveStudioAccess, type StudioAccess } from '../authorization/studio-access';

type ApiContext = Context<{ Bindings: AuthBindings; Variables: { requestId: string } }>;
type PackageRow = { id: string; name: string; description: string | null; included_minutes: number; price_minor: number; currency: string; validity_days: number | null; status: 'active' | 'archived'; sort_order: number };

const param = (context: ApiContext, name: string) => context.req.param(name) ?? '';
const iso = (value: number) => new Date(value).toISOString();

function validationError(error: z.ZodError): ApiErrorBody {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { code: 'VALIDATION_ERROR', message: 'Provjerite unesene podatke.', fieldErrors };
}

async function json(context: ApiContext) {
  try { return await context.req.json(); } catch { return undefined; }
}

function mapPackage(row: PackageRow): HourPackage {
  return hourPackageSchema.parse({ id: row.id, name: row.name, description: row.description, includedMinutes: row.included_minutes,
    priceMinor: row.price_minor, currency: row.currency, validityDays: row.validity_days, status: row.status, sortOrder: row.sort_order });
}

async function requireManager(context: ApiContext) {
  return resolveStudioAccess(context.env, context.req.raw, param(context, 'slug'), 'credits.manage');
}

async function activeArtist(context: ApiContext, studioId: string, userId: string) {
  return context.env.DB.prepare(
    `SELECT u.id AS userId, u.name, u.email FROM memberships m JOIN user u ON u.id = m.user_id
     WHERE m.studio_id = ?1 AND m.user_id = ?2 AND m.role = 'artist' AND m.status = 'active' LIMIT 1`,
  ).bind(studioId, userId).first<{ userId: string; name: string; email: string }>();
}

function idempotencyKey(context: ApiContext) {
  const key = context.req.header('Idempotency-Key')?.trim() ?? '';
  return key.length >= 16 && key.length <= 128 ? key : null;
}

export async function listHourPackages(context: ApiContext) {
  const access = await requireManager(context);
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const rows = await context.env.DB.prepare(
    `SELECT id, name, description, included_minutes, price_minor, currency, validity_days, status, sort_order
     FROM hour_packages WHERE studio_id = ?1 ORDER BY status, sort_order, name`,
  ).bind(access.value.studio.id).all<PackageRow>();
  return context.json({ packages: rows.results.map(mapPackage) });
}

export async function createHourPackage(context: ApiContext) {
  const access = await requireManager(context);
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const parsed = hourPackageWriteSchema.safeParse(await json(context));
  if (!parsed.success) return context.json(validationError(parsed.error), 422);
  const id = crypto.randomUUID(); const now = Date.now();
  const value = hourPackageSchema.parse({ id, ...parsed.data, description: parsed.data.description || null,
    validityDays: parsed.data.validityDays ?? null, currency: access.value.studio.currency,
    status: parsed.data.status ?? 'active', sortOrder: parsed.data.sortOrder ?? 0 });
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO hour_packages (id, studio_id, name, description, included_minutes, price_minor, currency, validity_days, status, sort_order, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)`,
    ).bind(id, access.value.studio.id, value.name, value.description, value.includedMinutes, value.priceMinor, value.currency, value.validityDays, value.status, value.sortOrder, now),
    context.env.DB.prepare(
      `INSERT INTO audit_logs (id, studio_id, actor_user_id, action, entity_type, entity_id, diff_json, request_id, created_at)
       VALUES (?1, ?2, ?3, 'hour_package.created', 'hour_package', ?4, ?5, ?6, ?7)`,
    ).bind(crypto.randomUUID(), access.value.studio.id, access.value.actor.userId, id, JSON.stringify({ after: value }), context.get('requestId'), now),
  ]);
  return context.json(value, 201);
}

export async function updateHourPackage(context: ApiContext) {
  const access = await requireManager(context);
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const parsed = hourPackageWriteSchema.safeParse(await json(context));
  if (!parsed.success) return context.json(validationError(parsed.error), 422);
  const current = await context.env.DB.prepare(
    `SELECT id, name, description, included_minutes, price_minor, currency, validity_days, status, sort_order
     FROM hour_packages WHERE studio_id = ?1 AND id = ?2 LIMIT 1`,
  ).bind(access.value.studio.id, param(context, 'packageId')).first<PackageRow>();
  if (!current) return context.json<ApiErrorBody>({ code: 'PACKAGE_NOT_FOUND', message: 'Paket ne postoji.' }, 404);
  const value = hourPackageSchema.parse({ id: current.id, ...parsed.data, description: parsed.data.description || null,
    validityDays: parsed.data.validityDays ?? null, currency: access.value.studio.currency,
    status: parsed.data.status ?? current.status, sortOrder: parsed.data.sortOrder ?? current.sort_order });
  const now = Date.now();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE hour_packages SET name=?1, description=?2, included_minutes=?3, price_minor=?4, currency=?5, validity_days=?6, status=?7, sort_order=?8, updated_at=?9
       WHERE studio_id=?10 AND id=?11`,
    ).bind(value.name, value.description, value.includedMinutes, value.priceMinor, value.currency, value.validityDays, value.status, value.sortOrder, now, access.value.studio.id, value.id),
    context.env.DB.prepare(
      `INSERT INTO audit_logs (id, studio_id, actor_user_id, action, entity_type, entity_id, diff_json, request_id, created_at)
       VALUES (?1, ?2, ?3, 'hour_package.updated', 'hour_package', ?4, ?5, ?6, ?7)`,
    ).bind(crypto.randomUUID(), access.value.studio.id, access.value.actor.userId, value.id,
      JSON.stringify({ before: mapPackage(current), after: value }), context.get('requestId'), now),
  ]);
  return context.json(value);
}

export async function listValueArtists(context: ApiContext) {
  const access = await requireManager(context);
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const result = await context.env.DB.prepare(
    `SELECT u.id AS userId, u.name, u.email FROM memberships m JOIN user u ON u.id = m.user_id
     WHERE m.studio_id = ?1 AND m.role = 'artist' AND m.status = 'active' ORDER BY u.name COLLATE NOCASE`,
  ).bind(access.value.studio.id).all();
  return context.json({ artists: result.results.map((row) => valueArtistSchema.parse(row)) });
}

async function loadAccount(context: ApiContext, access: StudioAccess, userId: string): Promise<ArtistValueAccount | null> {
  const artist = await activeArtist(context, access.studio.id, userId);
  if (!artist) return null;
  const results = await context.env.DB.batch([
    context.env.DB.prepare(
      `SELECT id, package_id, package_name_snapshot, granted_minutes, remaining_minutes, expires_at, status, created_at
       FROM package_balances WHERE studio_id = ?1 AND user_id = ?2 ORDER BY created_at DESC`,
    ).bind(access.studio.id, userId),
    context.env.DB.prepare(
      `SELECT pl.id, pl.package_balance_id, pl.amount_minutes, pl.kind, pl.reason, u.name AS actor_name, pl.created_at
       FROM package_ledger pl JOIN user u ON u.id = pl.actor_user_id
       WHERE pl.studio_id = ?1 AND pl.user_id = ?2 ORDER BY pl.created_at DESC LIMIT 100`,
    ).bind(access.studio.id, userId),
    context.env.DB.prepare(
      `SELECT cl.id, cl.amount_minor, cl.currency, cl.kind, cl.reason, u.name AS actor_name, cl.created_at
       FROM credit_ledger cl JOIN user u ON u.id = cl.actor_user_id
       WHERE cl.studio_id = ?1 AND cl.user_id = ?2 ORDER BY cl.created_at DESC LIMIT 100`,
    ).bind(access.studio.id, userId),
    context.env.DB.prepare(
      `SELECT COALESCE(SUM(amount_minor), 0) AS balance FROM credit_ledger
       WHERE studio_id = ?1 AND user_id = ?2 AND currency = ?3`,
    ).bind(access.studio.id, userId, access.studio.currency),
  ]);
  const now = Date.now();
  return artistValueAccountSchema.parse({
    artist, currency: access.studio.currency,
    creditBalanceMinor: Number((results[3]!.results[0] as { balance?: number } | undefined)?.balance ?? 0),
    packageBalances: (results[0]!.results as Record<string, unknown>[]).map((row) => ({
      id: row.id, packageId: row.package_id, packageName: row.package_name_snapshot,
      grantedMinutes: row.granted_minutes, remainingMinutes: row.expires_at && Number(row.expires_at) <= now ? 0 : row.remaining_minutes,
      expiresAt: row.expires_at ? iso(Number(row.expires_at)) : null,
      status: row.expires_at && Number(row.expires_at) <= now ? 'expired' : row.status, createdAt: iso(Number(row.created_at)),
    })),
    packageLedger: (results[1]!.results as Record<string, unknown>[]).map((row) => ({ id: row.id, packageBalanceId: row.package_balance_id,
      amountMinutes: row.amount_minutes, kind: row.kind, reason: row.reason, actorName: row.actor_name, createdAt: iso(Number(row.created_at)) })),
    creditLedger: (results[2]!.results as Record<string, unknown>[]).map((row) => ({ id: row.id, amountMinor: row.amount_minor,
      currency: row.currency, kind: row.kind, reason: row.reason, actorName: row.actor_name, createdAt: iso(Number(row.created_at)) })),
  });
}

export async function getManagedValueAccount(context: ApiContext) {
  const access = await requireManager(context);
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const account = await loadAccount(context, access.value, param(context, 'userId'));
  return account ? context.json(account) : context.json<ApiErrorBody>({ code: 'ARTIST_NOT_FOUND', message: 'Artist ne postoji.' }, 404);
}

export async function getOwnValueAccount(context: ApiContext) {
  const access = await resolveStudioAccess(context.env, context.req.raw, param(context, 'slug'));
  if (!access.ok) return context.json(access.error.body, access.error.status);
  if (access.value.actor.role !== 'artist') return context.json<ApiErrorBody>({ code: 'ARTIST_REQUIRED', message: 'Artist pristup je obavezan.' }, 403);
  const account = await loadAccount(context, access.value, access.value.actor.userId);
  return account ? context.json(account) : context.json<ApiErrorBody>({ code: 'ARTIST_NOT_FOUND', message: 'Artist ne postoji.' }, 404);
}

export async function grantPackage(context: ApiContext) {
  const access = await requireManager(context);
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const key = idempotencyKey(context);
  if (!key) return context.json<ApiErrorBody>({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Nedostaje valjani Idempotency-Key.' }, 400);
  const parsed = packageGrantSchema.safeParse(await json(context));
  if (!parsed.success) return context.json(validationError(parsed.error), 422);
  if (!await activeArtist(context, access.value.studio.id, parsed.data.userId)) return context.json<ApiErrorBody>({ code: 'ARTIST_NOT_FOUND', message: 'Artist ne postoji.' }, 404);
  const pkg = await context.env.DB.prepare(
    `SELECT id, name, included_minutes, validity_days FROM hour_packages WHERE studio_id=?1 AND id=?2 AND status='active' LIMIT 1`,
  ).bind(access.value.studio.id, parsed.data.packageId).first<{ id: string; name: string; included_minutes: number; validity_days: number | null }>();
  if (!pkg) return context.json<ApiErrorBody>({ code: 'PACKAGE_NOT_FOUND', message: 'Aktivni paket ne postoji.' }, 404);
  const now = Date.now(); const balanceId = crypto.randomUUID();
  const result = await context.env.VALUE_COORDINATOR.getByName(`${access.value.studio.id}:${parsed.data.userId}`).grantPackage({
    studioId: access.value.studio.id, userId: parsed.data.userId, actorUserId: access.value.actor.userId,
    balanceId, ledgerId: crypto.randomUUID(), packageId: pkg.id, packageName: pkg.name, includedMinutes: pkg.included_minutes,
    expiresAt: pkg.validity_days ? now + pkg.validity_days * 86_400_000 : null, reason: parsed.data.reason,
    idempotencyKey: key, requestId: context.get('requestId'), now,
  });
  const account = await loadAccount(context, access.value, parsed.data.userId);
  if (result.kind === 'idempotency_conflict') return context.json<ApiErrorBody>({ code: 'IDEMPOTENCY_CONFLICT', message: 'Isti ključ je već korišten za drugu promjenu.' }, 409);
  return context.json(account, result.kind === 'created' ? 201 : 200);
}

export async function createPackageEntry(context: ApiContext) {
  const access = await requireManager(context);
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const key = idempotencyKey(context);
  if (!key) return context.json<ApiErrorBody>({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Nedostaje valjani Idempotency-Key.' }, 400);
  const parsed = packageEntryCreateSchema.safeParse(await json(context));
  if (!parsed.success) return context.json(validationError(parsed.error), 422);
  const balance = await context.env.DB.prepare(
    `SELECT user_id FROM package_balances WHERE studio_id=?1 AND id=?2 LIMIT 1`,
  ).bind(access.value.studio.id, param(context, 'balanceId')).first<{ user_id: string }>();
  if (!balance) return context.json<ApiErrorBody>({ code: 'PACKAGE_BALANCE_NOT_FOUND', message: 'Stanje paketa ne postoji.' }, 404);
  const result = await context.env.VALUE_COORDINATOR.getByName(`${access.value.studio.id}:${balance.user_id}`).adjustPackage({
    studioId: access.value.studio.id, userId: balance.user_id, actorUserId: access.value.actor.userId,
    ledgerId: crypto.randomUUID(), packageBalanceId: param(context, 'balanceId'), amountMinutes: parsed.data.amountMinutes,
    kind: parsed.data.kind, reason: parsed.data.reason, idempotencyKey: key, requestId: context.get('requestId'), now: Date.now(),
  });
  if (result.kind === 'insufficient') return context.json<ApiErrorBody>({ code: 'INSUFFICIENT_PACKAGE_BALANCE', message: 'Paket nema dovoljno minuta.' }, 409);
  if (result.kind === 'invalid_sign') return context.json<ApiErrorBody>({ code: 'INVALID_ENTRY_SIGN', message: 'Predznak iznosa ne odgovara vrsti promjene.' }, 422);
  if (result.kind === 'expired') return context.json<ApiErrorBody>({ code: 'PACKAGE_EXPIRED', message: 'Paket je istekao.' }, 409);
  if (result.kind === 'not_found') return context.json<ApiErrorBody>({ code: 'PACKAGE_BALANCE_NOT_FOUND', message: 'Stanje paketa ne postoji.' }, 404);
  if (result.kind === 'idempotency_conflict') return context.json<ApiErrorBody>({ code: 'IDEMPOTENCY_CONFLICT', message: 'Isti ključ je već korišten za drugu promjenu.' }, 409);
  return context.json(await loadAccount(context, access.value, balance.user_id), result.kind === 'created' ? 201 : 200);
}

export async function createCreditEntry(context: ApiContext) {
  const access = await requireManager(context);
  if (!access.ok) return context.json(access.error.body, access.error.status);
  const key = idempotencyKey(context);
  if (!key) return context.json<ApiErrorBody>({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Nedostaje valjani Idempotency-Key.' }, 400);
  const parsed = creditEntryCreateSchema.safeParse(await json(context));
  if (!parsed.success) return context.json(validationError(parsed.error), 422);
  if (!await activeArtist(context, access.value.studio.id, parsed.data.userId)) return context.json<ApiErrorBody>({ code: 'ARTIST_NOT_FOUND', message: 'Artist ne postoji.' }, 404);
  const result = await context.env.VALUE_COORDINATOR.getByName(`${access.value.studio.id}:${parsed.data.userId}`).adjustCredit({
    studioId: access.value.studio.id, userId: parsed.data.userId, actorUserId: access.value.actor.userId,
    ledgerId: crypto.randomUUID(), amountMinor: parsed.data.amountMinor, currency: access.value.studio.currency,
    kind: parsed.data.kind, reason: parsed.data.reason, idempotencyKey: key, requestId: context.get('requestId'), now: Date.now(),
  });
  if (result.kind === 'insufficient') return context.json<ApiErrorBody>({ code: 'INSUFFICIENT_CREDIT', message: 'Kredit ne može pasti ispod nule.' }, 409);
  if (result.kind === 'invalid_sign') return context.json<ApiErrorBody>({ code: 'INVALID_ENTRY_SIGN', message: 'Predznak iznosa ne odgovara vrsti promjene.' }, 422);
  if (result.kind === 'idempotency_conflict') return context.json<ApiErrorBody>({ code: 'IDEMPOTENCY_CONFLICT', message: 'Isti ključ je već korišten za drugu promjenu.' }, 409);
  return context.json(await loadAccount(context, access.value, parsed.data.userId), result.kind === 'created' ? 201 : 200);
}
