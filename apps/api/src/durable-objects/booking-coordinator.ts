import { DurableObject } from 'cloudflare:workers';

export type BookingCommand = {
  bookingId: string;
  studioId: string;
  resourceId: string;
  artistUserId: string;
  serviceId: string;
  startAtUtc: number;
  endAtUtc: number;
  serviceName: string;
  durationMinutes: number;
  priceMinor: number;
  subtotalPriceMinor: number;
  discountMinor: number;
  promoId: string | null;
  promoCode: string | null;
  currency: string;
  idempotencyKey: string;
  requestFingerprint: string;
  requestId: string;
  now: number;
};

export type StoredBooking = {
  id: string;
  studio_id: string;
  resource_id: string;
  artist_user_id: string;
  service_id: string;
  start_at_utc: number;
  end_at_utc: number;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  service_name_snapshot: string;
  duration_minutes_snapshot: number;
  price_minor_snapshot: number;
  subtotal_price_minor_snapshot: number;
  discount_minor_snapshot: number;
  promo_code_id: string | null;
  promo_code_snapshot: string | null;
  currency_snapshot: string;
  request_fingerprint: string;
  created_at: number;
};

export type BookingCommandResult =
  | { kind: 'created'; booking: StoredBooking }
  | { kind: 'replayed'; booking: StoredBooking }
  | { kind: 'conflict' }
  | { kind: 'promo_unavailable' }
  | { kind: 'idempotency_conflict' };

export type CancelBookingCommand = {
  studioId: string;
  resourceId: string;
  bookingId: string;
  actorUserId: string;
  requestId: string;
  now: number;
};

export type CancelBookingResult =
  | { kind: 'cancelled'; booking: StoredBooking }
  | { kind: 'replayed'; booking: StoredBooking }
  | { kind: 'not_found' }
  | { kind: 'invalid_status' };

export type StoredBlockedSlot = {
  id: string;
  studio_id: string;
  resource_id: string;
  start_at_utc: number;
  end_at_utc: number;
  reason: string;
  created_at: number;
};

export type CreateBlockCommand = {
  blockId: string;
  studioId: string;
  resourceId: string;
  startAtUtc: number;
  endAtUtc: number;
  reason: string;
  actorUserId: string;
  requestId: string;
  now: number;
};

export type CreateBlockResult = { kind: 'created'; block: StoredBlockedSlot } | { kind: 'conflict' };

export type DeleteBlockCommand = {
  studioId: string;
  resourceId: string;
  blockId: string;
  actorUserId: string;
  requestId: string;
  now: number;
};

export class BookingCoordinator extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS _sql_schema_migrations (
          id INTEGER PRIMARY KEY,
          applied_at INTEGER NOT NULL
        );
        INSERT OR IGNORE INTO _sql_schema_migrations (id, applied_at)
        VALUES (1, unixepoch() * 1000);
      `);
    });
  }

  health(): { status: 'ok'; schemaVersion: number } {
    const row = this.ctx.storage.sql
      .exec<{ version: number }>('SELECT MAX(id) AS version FROM _sql_schema_migrations')
      .one();
    return { status: 'ok', schemaVersion: row.version };
  }

  async createBooking(command: BookingCommand): Promise<BookingCommandResult> {
    const existing = await this.env.DB.prepare(
      `SELECT id, studio_id, resource_id, artist_user_id, service_id, start_at_utc, end_at_utc, status,
       service_name_snapshot, duration_minutes_snapshot, price_minor_snapshot, subtotal_price_minor_snapshot,
       discount_minor_snapshot, promo_code_id, promo_code_snapshot, currency_snapshot,
       request_fingerprint, created_at
       FROM bookings WHERE studio_id = ?1 AND idempotency_key = ?2 LIMIT 1`,
    ).bind(command.studioId, command.idempotencyKey).first<StoredBooking>();
    if (existing) {
      return existing.request_fingerprint === command.requestFingerprint
        ? { kind: 'replayed', booking: existing }
        : { kind: 'idempotency_conflict' };
    }

    const blocked = await this.env.DB.prepare(
      `SELECT id FROM blocked_slots
       WHERE studio_id = ?1 AND resource_id = ?2
         AND start_at_utc < ?4 AND end_at_utc > ?3
       LIMIT 1`,
    ).bind(command.studioId, command.resourceId, command.startAtUtc, command.endAtUtc).first();
    if (blocked) return { kind: 'conflict' };

    const slotStarts: number[] = [];
    for (let slot = command.startAtUtc; slot < command.endAtUtc; slot += 15 * 60_000) slotStarts.push(slot);

    try {
      await this.env.DB.batch([
        this.env.DB.prepare(
          `INSERT INTO bookings
           (id, studio_id, resource_id, artist_user_id, service_id, start_at_utc, end_at_utc, status,
           service_name_snapshot, duration_minutes_snapshot, price_minor_snapshot, subtotal_price_minor_snapshot,
            discount_minor_snapshot, promo_code_id, promo_code_snapshot, currency_snapshot,
            idempotency_key, request_fingerprint, version, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'confirmed', ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, 1, ?18, ?18)`,
        ).bind(command.bookingId, command.studioId, command.resourceId, command.artistUserId, command.serviceId,
          command.startAtUtc, command.endAtUtc, command.serviceName, command.durationMinutes, command.priceMinor,
          command.subtotalPriceMinor, command.discountMinor, command.promoId, command.promoCode, command.currency,
          command.idempotencyKey, command.requestFingerprint, command.now),
        ...slotStarts.map((slot) => this.env.DB.prepare(
          `INSERT INTO slot_claims (studio_id, resource_id, slot_start_utc, booking_id, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5)`,
        ).bind(command.studioId, command.resourceId, slot, command.bookingId, command.now)),
        ...(command.promoId && command.discountMinor > 0 ? [this.env.DB.prepare(
          `INSERT INTO promo_redemptions
           (id, studio_id, promo_code_id, user_id, booking_id, discount_minor, status, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'applied', ?7)`,
        ).bind(crypto.randomUUID(), command.studioId, command.promoId, command.artistUserId, command.bookingId, command.discountMinor, command.now)] : []),
        this.env.DB.prepare(
          `INSERT INTO booking_events (id, studio_id, booking_id, actor_user_id, event_type, payload_json, created_at)
           VALUES (?1, ?2, ?3, ?4, 'created', ?5, ?6)`,
        ).bind(crypto.randomUUID(), command.studioId, command.bookingId, command.artistUserId, JSON.stringify({
          startAtUtc: command.startAtUtc,
          endAtUtc: command.endAtUtc,
          serviceId: command.serviceId,
          serviceName: command.serviceName,
          durationMinutes: command.durationMinutes,
          priceMinor: command.priceMinor,
          subtotalPriceMinor: command.subtotalPriceMinor,
          discountMinor: command.discountMinor,
          promoCode: command.promoCode,
          currency: command.currency,
        }), command.now),
        this.env.DB.prepare(
          `INSERT INTO audit_logs (id, studio_id, actor_user_id, action, entity_type, entity_id, diff_json, request_id, created_at)
           VALUES (?1, ?2, ?3, 'booking.created', 'booking', ?4, ?5, ?6, ?7)`,
        ).bind(crypto.randomUUID(), command.studioId, command.artistUserId, command.bookingId,
          JSON.stringify({ startAtUtc: command.startAtUtc, endAtUtc: command.endAtUtc, status: 'confirmed' }),
          command.requestId, command.now),
      ]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('PROMO_MAX_REDEMPTIONS') || message.includes('PROMO_USER_LIMIT')) return { kind: 'promo_unavailable' };
      if (message.includes('UNIQUE constraint failed') || message.includes('SQLITE_CONSTRAINT')) return { kind: 'conflict' };
      throw error;
    }

    return {
      kind: 'created',
      booking: {
        id: command.bookingId,
        studio_id: command.studioId,
        resource_id: command.resourceId,
        artist_user_id: command.artistUserId,
        service_id: command.serviceId,
        start_at_utc: command.startAtUtc,
        end_at_utc: command.endAtUtc,
        status: 'confirmed',
        service_name_snapshot: command.serviceName,
        duration_minutes_snapshot: command.durationMinutes,
        price_minor_snapshot: command.priceMinor,
        subtotal_price_minor_snapshot: command.subtotalPriceMinor,
        discount_minor_snapshot: command.discountMinor,
        promo_code_id: command.promoId,
        promo_code_snapshot: command.promoCode,
        currency_snapshot: command.currency,
        request_fingerprint: command.requestFingerprint,
        created_at: command.now,
      },
    };
  }

  async cancelBooking(command: CancelBookingCommand): Promise<CancelBookingResult> {
    const booking = await this.env.DB.prepare(
      `SELECT id, studio_id, resource_id, artist_user_id, service_id, start_at_utc, end_at_utc, status,
       service_name_snapshot, duration_minutes_snapshot, price_minor_snapshot, subtotal_price_minor_snapshot,
       discount_minor_snapshot, promo_code_id, promo_code_snapshot, currency_snapshot,
       request_fingerprint, created_at
       FROM bookings WHERE studio_id = ?1 AND resource_id = ?2 AND id = ?3 LIMIT 1`,
    ).bind(command.studioId, command.resourceId, command.bookingId).first<StoredBooking>();
    if (!booking) return { kind: 'not_found' };
    if (booking.status === 'cancelled') return { kind: 'replayed', booking };
    if (booking.status !== 'confirmed') return { kind: 'invalid_status' };

    await this.env.DB.batch([
      this.env.DB.prepare(
        `UPDATE bookings SET status = 'cancelled', version = version + 1, updated_at = ?1
         WHERE studio_id = ?2 AND id = ?3 AND status = 'confirmed'`,
      ).bind(command.now, command.studioId, command.bookingId),
      this.env.DB.prepare('DELETE FROM slot_claims WHERE studio_id = ?1 AND booking_id = ?2')
        .bind(command.studioId, command.bookingId),
      this.env.DB.prepare(
        `UPDATE promo_redemptions SET status='reversed', reversed_at=?1
         WHERE studio_id=?2 AND booking_id=?3 AND status='applied'`,
      ).bind(command.now, command.studioId, command.bookingId),
      this.env.DB.prepare(
        `INSERT INTO booking_events (id, studio_id, booking_id, actor_user_id, event_type, payload_json, created_at)
         VALUES (?1, ?2, ?3, ?4, 'cancelled', ?5, ?6)`,
      ).bind(crypto.randomUUID(), command.studioId, command.bookingId, command.actorUserId,
        JSON.stringify({ before: { status: 'confirmed' }, after: { status: 'cancelled' } }), command.now),
      this.env.DB.prepare(
        `INSERT INTO audit_logs (id, studio_id, actor_user_id, action, entity_type, entity_id, diff_json, request_id, created_at)
         VALUES (?1, ?2, ?3, 'booking.cancelled', 'booking', ?4, ?5, ?6, ?7)`,
      ).bind(crypto.randomUUID(), command.studioId, command.actorUserId, command.bookingId,
        JSON.stringify({ before: { status: 'confirmed' }, after: { status: 'cancelled' } }), command.requestId, command.now),
    ]);
    return { kind: 'cancelled', booking: { ...booking, status: 'cancelled' } };
  }

  async createBlock(command: CreateBlockCommand): Promise<CreateBlockResult> {
    const overlap = await this.env.DB.prepare(
      `SELECT id FROM blocked_slots
       WHERE studio_id = ?1 AND resource_id = ?2 AND start_at_utc < ?4 AND end_at_utc > ?3
       UNION ALL
       SELECT id FROM bookings
       WHERE studio_id = ?1 AND resource_id = ?2 AND status = 'confirmed' AND start_at_utc < ?4 AND end_at_utc > ?3
       LIMIT 1`,
    ).bind(command.studioId, command.resourceId, command.startAtUtc, command.endAtUtc).first();
    if (overlap) return { kind: 'conflict' };

    await this.env.DB.batch([
      this.env.DB.prepare(
        `INSERT INTO blocked_slots
         (id, studio_id, resource_id, start_at_utc, end_at_utc, reason, actor_user_id, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)`,
      ).bind(command.blockId, command.studioId, command.resourceId, command.startAtUtc, command.endAtUtc,
        command.reason, command.actorUserId, command.now),
      this.env.DB.prepare(
        `INSERT INTO audit_logs (id, studio_id, actor_user_id, action, entity_type, entity_id, diff_json, request_id, created_at)
         VALUES (?1, ?2, ?3, 'blocked_slot.created', 'blocked_slot', ?4, ?5, ?6, ?7)`,
      ).bind(crypto.randomUUID(), command.studioId, command.actorUserId, command.blockId,
        JSON.stringify({ startAtUtc: command.startAtUtc, endAtUtc: command.endAtUtc, reason: command.reason }),
        command.requestId, command.now),
    ]);
    return {
      kind: 'created',
      block: {
        id: command.blockId,
        studio_id: command.studioId,
        resource_id: command.resourceId,
        start_at_utc: command.startAtUtc,
        end_at_utc: command.endAtUtc,
        reason: command.reason,
        created_at: command.now,
      },
    };
  }

  async deleteBlock(command: DeleteBlockCommand): Promise<{ kind: 'deleted' | 'not_found' }> {
    const block = await this.env.DB.prepare(
      `SELECT id FROM blocked_slots
       WHERE studio_id = ?1 AND resource_id = ?2 AND id = ?3 LIMIT 1`,
    ).bind(command.studioId, command.resourceId, command.blockId).first();
    if (!block) return { kind: 'not_found' };

    await this.env.DB.batch([
      this.env.DB.prepare('DELETE FROM blocked_slots WHERE studio_id = ?1 AND resource_id = ?2 AND id = ?3')
        .bind(command.studioId, command.resourceId, command.blockId),
      this.env.DB.prepare(
        `INSERT INTO audit_logs (id, studio_id, actor_user_id, action, entity_type, entity_id, diff_json, request_id, created_at)
         VALUES (?1, ?2, ?3, 'blocked_slot.deleted', 'blocked_slot', ?4, '{}', ?5, ?6)`,
      ).bind(crypto.randomUUID(), command.studioId, command.actorUserId, command.blockId, command.requestId, command.now),
    ]);
    return { kind: 'deleted' };
  }
}
