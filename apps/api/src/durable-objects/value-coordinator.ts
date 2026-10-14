import { DurableObject } from 'cloudflare:workers';
import type {
  BookingCommand,
  BookingCommandResult,
  CancelBookingCommand,
  CancelBookingResult,
} from './booking-coordinator';

type BaseCommand = {
  studioId: string;
  userId: string;
  actorUserId: string;
  reason: string;
  idempotencyKey: string;
  requestId: string;
  now: number;
};

export type GrantPackageCommand = BaseCommand & {
  balanceId: string;
  ledgerId: string;
  packageId: string;
  packageName: string;
  includedMinutes: number;
  expiresAt: number | null;
};

export type PackageAdjustmentCommand = BaseCommand & {
  ledgerId: string;
  packageBalanceId: string;
  amountMinutes: number;
  kind: 'use' | 'refund' | 'adjustment';
};

export type CreditAdjustmentCommand = BaseCommand & {
  ledgerId: string;
  amountMinor: number;
  currency: string;
  kind: 'grant' | 'use' | 'refund' | 'adjustment';
};

export type ValueMutationResult =
  | { kind: 'created'; id: string; balance: number }
  | { kind: 'replayed'; id: string; balance: number }
  | { kind: 'not_found' | 'insufficient' | 'invalid_sign' | 'expired' | 'idempotency_conflict' };

type BalanceRow = { remaining_minutes: number; expires_at: number | null; status: string };

export class ValueCoordinator extends DurableObject<Env> {
  private mutationTail: Promise<void> = Promise.resolve();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS _sql_schema_migrations (id INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
        INSERT OR IGNORE INTO _sql_schema_migrations (id, applied_at) VALUES (1, unixepoch() * 1000);
      `);
    });
  }

  health() {
    const row = this.ctx.storage.sql.exec<{ version: number }>('SELECT MAX(id) AS version FROM _sql_schema_migrations').one();
    return { status: 'ok' as const, schemaVersion: row.version };
  }

  private async serialize<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.mutationTail;
    let release = () => {};
    this.mutationTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try { return await operation(); } finally { release(); }
  }

  grantPackage(command: GrantPackageCommand): Promise<ValueMutationResult> {
    return this.serialize(() => this.grantPackageUnlocked(command));
  }

  adjustPackage(command: PackageAdjustmentCommand): Promise<ValueMutationResult> {
    return this.serialize(() => this.adjustPackageUnlocked(command));
  }

  adjustCredit(command: CreditAdjustmentCommand): Promise<ValueMutationResult> {
    return this.serialize(() => this.adjustCreditUnlocked(command));
  }

  createBooking(command: BookingCommand): Promise<BookingCommandResult> {
    return this.serialize(async () => {
      const result = await this.env.BOOKING_COORDINATOR
        .getByName(`${command.studioId}:${command.resourceId}`).createBooking(command);
      const value = JSON.parse(JSON.stringify(result)) as BookingCommandResult;
      (result as unknown as { [Symbol.dispose](): void })[Symbol.dispose]();
      return value;
    });
  }

  cancelBooking(command: CancelBookingCommand): Promise<CancelBookingResult> {
    return this.serialize(async () => {
      const result = await this.env.BOOKING_COORDINATOR
        .getByName(`${command.studioId}:${command.resourceId}`).cancelBooking(command);
      const value = JSON.parse(JSON.stringify(result)) as CancelBookingResult;
      (result as unknown as { [Symbol.dispose](): void })[Symbol.dispose]();
      return value;
    });
  }

  private async grantPackageUnlocked(command: GrantPackageCommand): Promise<ValueMutationResult> {
    const replay = await this.env.DB.prepare(
      `SELECT pl.package_balance_id AS id, pb.remaining_minutes AS balance, pb.user_id, pb.package_id, pl.amount_minutes, pl.reason
       FROM package_ledger pl JOIN package_balances pb ON pb.studio_id = pl.studio_id AND pb.id = pl.package_balance_id
       WHERE pl.studio_id = ?1 AND pl.idempotency_key = ?2 LIMIT 1`,
    ).bind(command.studioId, command.idempotencyKey).first<{ id: string; balance: number; user_id: string; package_id: string; amount_minutes: number; reason: string }>();
    if (replay) return replay.user_id === command.userId && replay.package_id === command.packageId
      && replay.amount_minutes === command.includedMinutes && replay.reason === command.reason
      ? { kind: 'replayed', id: replay.id, balance: replay.balance } : { kind: 'idempotency_conflict' };

    const status = command.expiresAt !== null && command.expiresAt <= command.now ? 'expired' : 'active';
    const remaining = status === 'expired' ? 0 : command.includedMinutes;
    await this.env.DB.batch([
      this.env.DB.prepare(
        `INSERT INTO package_balances
         (id, studio_id, user_id, package_id, package_name_snapshot, granted_minutes, remaining_minutes, expires_at, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)`,
      ).bind(command.balanceId, command.studioId, command.userId, command.packageId, command.packageName,
        command.includedMinutes, remaining, command.expiresAt, status, command.now),
      this.env.DB.prepare(
        `INSERT INTO package_ledger
         (id, studio_id, user_id, package_balance_id, amount_minutes, kind, reason, actor_user_id, idempotency_key, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'grant', ?6, ?7, ?8, ?9)`,
      ).bind(command.ledgerId, command.studioId, command.userId, command.balanceId, command.includedMinutes,
        command.reason, command.actorUserId, command.idempotencyKey, command.now),
      this.env.DB.prepare(
        `INSERT INTO audit_logs (id, studio_id, actor_user_id, action, entity_type, entity_id, diff_json, request_id, created_at)
         VALUES (?1, ?2, ?3, 'package.granted', 'package_balance', ?4, ?5, ?6, ?7)`,
      ).bind(crypto.randomUUID(), command.studioId, command.actorUserId, command.balanceId,
        JSON.stringify({ userId: command.userId, packageId: command.packageId, minutes: command.includedMinutes }),
        command.requestId, command.now),
    ]);
    return { kind: 'created', id: command.balanceId, balance: remaining };
  }

  private async adjustPackageUnlocked(command: PackageAdjustmentCommand): Promise<ValueMutationResult> {
    const replay = await this.env.DB.prepare(
      `SELECT pl.package_balance_id AS id, pb.remaining_minutes AS balance, pl.user_id, pl.amount_minutes, pl.kind, pl.reason
       FROM package_ledger pl JOIN package_balances pb ON pb.studio_id = pl.studio_id AND pb.id = pl.package_balance_id
       WHERE pl.studio_id = ?1 AND pl.idempotency_key = ?2 LIMIT 1`,
    ).bind(command.studioId, command.idempotencyKey).first<{ id: string; balance: number; user_id: string; amount_minutes: number; kind: string; reason: string }>();
    if (replay) return replay.user_id === command.userId && replay.id === command.packageBalanceId
      && replay.amount_minutes === command.amountMinutes && replay.kind === command.kind && replay.reason === command.reason
      ? { kind: 'replayed', id: replay.id, balance: replay.balance } : { kind: 'idempotency_conflict' };
    if ((command.kind === 'use' && command.amountMinutes >= 0) || (command.kind === 'refund' && command.amountMinutes <= 0)) {
      return { kind: 'invalid_sign' };
    }
    const current = await this.env.DB.prepare(
      `SELECT remaining_minutes, expires_at, status FROM package_balances
       WHERE studio_id = ?1 AND user_id = ?2 AND id = ?3 LIMIT 1`,
    ).bind(command.studioId, command.userId, command.packageBalanceId).first<BalanceRow>();
    if (!current) return { kind: 'not_found' };
    if (current.status === 'expired' || (current.expires_at !== null && current.expires_at <= command.now)) return { kind: 'expired' };
    const next = current.remaining_minutes + command.amountMinutes;
    if (next < 0) return { kind: 'insufficient' };

    await this.env.DB.batch([
      this.env.DB.prepare(
        `UPDATE package_balances SET remaining_minutes = ?1, status = ?2, updated_at = ?3
         WHERE studio_id = ?4 AND user_id = ?5 AND id = ?6`,
      ).bind(next, next === 0 ? 'exhausted' : 'active', command.now, command.studioId, command.userId, command.packageBalanceId),
      this.env.DB.prepare(
        `INSERT INTO package_ledger
         (id, studio_id, user_id, package_balance_id, amount_minutes, kind, reason, actor_user_id, idempotency_key, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
      ).bind(command.ledgerId, command.studioId, command.userId, command.packageBalanceId, command.amountMinutes,
        command.kind, command.reason, command.actorUserId, command.idempotencyKey, command.now),
      this.env.DB.prepare(
        `INSERT INTO audit_logs (id, studio_id, actor_user_id, action, entity_type, entity_id, diff_json, request_id, created_at)
         VALUES (?1, ?2, ?3, 'package.balance_changed', 'package_balance', ?4, ?5, ?6, ?7)`,
      ).bind(crypto.randomUUID(), command.studioId, command.actorUserId, command.packageBalanceId,
        JSON.stringify({ userId: command.userId, amountMinutes: command.amountMinutes, kind: command.kind, reason: command.reason }),
        command.requestId, command.now),
    ]);
    return { kind: 'created', id: command.packageBalanceId, balance: next };
  }

  private async adjustCreditUnlocked(command: CreditAdjustmentCommand): Promise<ValueMutationResult> {
    const replay = await this.env.DB.prepare(
      `SELECT id, user_id, amount_minor, currency, kind, reason FROM credit_ledger WHERE studio_id = ?1 AND idempotency_key = ?2 LIMIT 1`,
    ).bind(command.studioId, command.idempotencyKey).first<{ id: string; user_id: string; amount_minor: number; currency: string; kind: string; reason: string }>();
    const total = await this.creditBalance(command.studioId, command.userId, command.currency);
    if (replay) return replay.user_id === command.userId && replay.amount_minor === command.amountMinor
      && replay.currency === command.currency && replay.kind === command.kind && replay.reason === command.reason
      ? { kind: 'replayed', id: replay.id, balance: total } : { kind: 'idempotency_conflict' };
    if ((command.kind === 'use' && command.amountMinor >= 0)
      || ((command.kind === 'grant' || command.kind === 'refund') && command.amountMinor <= 0)) return { kind: 'invalid_sign' };
    const next = total + command.amountMinor;
    if (next < 0) return { kind: 'insufficient' };

    await this.env.DB.batch([
      this.env.DB.prepare(
        `INSERT INTO credit_ledger
         (id, studio_id, user_id, amount_minor, currency, kind, reason, actor_user_id, idempotency_key, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
      ).bind(command.ledgerId, command.studioId, command.userId, command.amountMinor, command.currency,
        command.kind, command.reason, command.actorUserId, command.idempotencyKey, command.now),
      this.env.DB.prepare(
        `INSERT INTO audit_logs (id, studio_id, actor_user_id, action, entity_type, entity_id, diff_json, request_id, created_at)
         VALUES (?1, ?2, ?3, 'credit.ledger_entry_created', 'credit_ledger', ?4, ?5, ?6, ?7)`,
      ).bind(crypto.randomUUID(), command.studioId, command.actorUserId, command.ledgerId,
        JSON.stringify({ userId: command.userId, amountMinor: command.amountMinor, kind: command.kind, reason: command.reason }),
        command.requestId, command.now),
    ]);
    return { kind: 'created', id: command.ledgerId, balance: next };
  }

  private async creditBalance(studioId: string, userId: string, currency: string) {
    const row = await this.env.DB.prepare(
      `SELECT COALESCE(SUM(amount_minor), 0) AS balance FROM credit_ledger
       WHERE studio_id = ?1 AND user_id = ?2 AND currency = ?3`,
    ).bind(studioId, userId, currency).first<{ balance: number }>();
    return row?.balance ?? 0;
  }
}
