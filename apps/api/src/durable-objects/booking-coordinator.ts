import { DurableObject } from 'cloudflare:workers';

export type BookingCommand = {
  bookingId: string;
  studioId: string;
  resourceId: string;
  artistUserId: string;
  actorUserId: string;
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
  paymentMethod: 'none' | 'credit' | 'package';
  packageBalanceId: string | null;
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
  payment_method: 'none' | 'credit' | 'package';
  package_balance_id: string | null;
  credit_amount_minor: number;
  package_minutes: number;
  value_refunded_at: number | null;
  request_fingerprint: string;
  created_at: number;
};

export type BookingCommandResult =
  | { kind: 'created'; booking: StoredBooking }
  | { kind: 'replayed'; booking: StoredBooking }
  | { kind: 'conflict' }
  | { kind: 'promo_unavailable' }
  | { kind: 'insufficient_credit' }
  | { kind: 'package_unavailable' }
  | { kind: 'insufficient_package' }
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

export type UpdateBookingStatusCommand = {
  studioId: string;
  resourceId: string;
  bookingId: string;
  actorUserId: string;
  status: 'completed' | 'no_show';
  requestId: string;
  now: number;
};

export type UpdateBookingStatusResult =
  | { kind: 'updated' | 'replayed'; booking: StoredBooking }
  | { kind: 'not_found' }
  | { kind: 'invalid_status' }
  | { kind: 'too_early' };

export type RescheduleBookingCommand = {
  studioId: string;
  resourceId: string;
  bookingId: string;
  actorUserId: string;
  startAtUtc: number;
  endAtUtc: number;
  requestId: string;
  now: number;
};

export type RescheduleBookingResult =
  | { kind: 'rescheduled' | 'replayed'; booking: StoredBooking }
  | { kind: 'not_found' }
  | { kind: 'invalid_status' }
  | { kind: 'conflict' };

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
       payment_method,package_balance_id,credit_amount_minor,package_minutes,value_refunded_at,
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

    const creditAmountMinor = command.paymentMethod === 'credit' ? command.priceMinor : 0;
    const packageMinutes = command.paymentMethod === 'package' ? command.durationMinutes : 0;
    if (creditAmountMinor > 0) {
      const credit = await this.env.DB.prepare(
        `SELECT COALESCE(SUM(amount_minor),0) AS balance FROM credit_ledger
         WHERE studio_id=?1 AND user_id=?2 AND currency=?3`,
      ).bind(command.studioId, command.artistUserId, command.currency).first<{ balance: number }>();
      if ((credit?.balance ?? 0) < creditAmountMinor) return { kind: 'insufficient_credit' };
    }
    if (packageMinutes > 0) {
      const balance = command.packageBalanceId ? await this.env.DB.prepare(
        `SELECT remaining_minutes,expires_at,status FROM package_balances
         WHERE studio_id=?1 AND user_id=?2 AND id=?3 LIMIT 1`,
      ).bind(command.studioId, command.artistUserId, command.packageBalanceId)
        .first<{ remaining_minutes: number; expires_at: number | null; status: string }>() : null;
      if (!balance || balance.status === 'expired' || (balance.expires_at !== null && balance.expires_at <= command.now)) {
        return { kind: 'package_unavailable' };
      }
      if (balance.status !== 'active' || balance.remaining_minutes < packageMinutes) return { kind: 'insufficient_package' };
    }

    const slotStarts: number[] = [];
    for (let slot = command.startAtUtc; slot < command.endAtUtc; slot += 15 * 60_000) slotStarts.push(slot);

    try {
      await this.env.DB.batch([
        this.env.DB.prepare(
          `INSERT INTO bookings
           (id, studio_id, resource_id, artist_user_id, service_id, start_at_utc, end_at_utc, status,
           service_name_snapshot, duration_minutes_snapshot, price_minor_snapshot, subtotal_price_minor_snapshot,
            discount_minor_snapshot, promo_code_id, promo_code_snapshot, currency_snapshot,
            payment_method,package_balance_id,credit_amount_minor,package_minutes,
            idempotency_key, request_fingerprint, version, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'confirmed', ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, 1, ?22, ?22)`,
        ).bind(command.bookingId, command.studioId, command.resourceId, command.artistUserId, command.serviceId,
          command.startAtUtc, command.endAtUtc, command.serviceName, command.durationMinutes, command.priceMinor,
          command.subtotalPriceMinor, command.discountMinor, command.promoId, command.promoCode, command.currency,
          command.paymentMethod, command.packageBalanceId, creditAmountMinor, packageMinutes,
          command.idempotencyKey, command.requestFingerprint, command.now),
        ...slotStarts.map((slot) => this.env.DB.prepare(
          `INSERT INTO slot_claims (studio_id, resource_id, slot_start_utc, booking_id, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5)`,
        ).bind(command.studioId, command.resourceId, slot, command.bookingId, command.now)),
        ...(creditAmountMinor > 0 ? [
          this.env.DB.prepare(
            `INSERT INTO credit_ledger
             (id,studio_id,user_id,amount_minor,currency,kind,reason,actor_user_id,booking_id,idempotency_key,created_at)
             VALUES (?1,?2,?3,?4,?5,'use',?6,?7,?8,?9,?10)`,
          ).bind(crypto.randomUUID(), command.studioId, command.artistUserId, -creditAmountMinor, command.currency,
            `Rezervacija: ${command.serviceName}`, command.actorUserId, command.bookingId, `${command.bookingId}:credit-use`, command.now),
          this.env.DB.prepare(
            `INSERT INTO audit_logs (id,studio_id,actor_user_id,action,entity_type,entity_id,diff_json,request_id,created_at)
             VALUES (?1,?2,?3,'credit.used_for_booking','booking',?4,?5,?6,?7)`,
          ).bind(crypto.randomUUID(), command.studioId, command.actorUserId, command.bookingId,
            JSON.stringify({ artistUserId: command.artistUserId, amountMinor: -creditAmountMinor, currency: command.currency }),
            command.requestId, command.now),
        ] : []),
        ...(packageMinutes > 0 && command.packageBalanceId ? [
          this.env.DB.prepare(
            `UPDATE package_balances
             SET remaining_minutes=remaining_minutes-?1,
                 status=CASE WHEN remaining_minutes-?1=0 THEN 'exhausted' ELSE 'active' END,updated_at=?2
             WHERE studio_id=?3 AND user_id=?4 AND id=?5 AND status='active' AND remaining_minutes>=?1`,
          ).bind(packageMinutes, command.now, command.studioId, command.artistUserId, command.packageBalanceId),
          this.env.DB.prepare(
            `INSERT INTO package_ledger
             (id,studio_id,user_id,package_balance_id,amount_minutes,kind,reason,actor_user_id,booking_id,idempotency_key,created_at)
             VALUES (?1,?2,?3,?4,?5,'use',?6,?7,?8,?9,?10)`,
          ).bind(crypto.randomUUID(), command.studioId, command.artistUserId, command.packageBalanceId, -packageMinutes,
            `Rezervacija: ${command.serviceName}`, command.actorUserId, command.bookingId, `${command.bookingId}:package-use`, command.now),
          this.env.DB.prepare(
            `INSERT INTO audit_logs (id,studio_id,actor_user_id,action,entity_type,entity_id,diff_json,request_id,created_at)
             VALUES (?1,?2,?3,'package.used_for_booking','booking',?4,?5,?6,?7)`,
          ).bind(crypto.randomUUID(), command.studioId, command.actorUserId, command.bookingId,
            JSON.stringify({ artistUserId: command.artistUserId, packageBalanceId: command.packageBalanceId, amountMinutes: -packageMinutes }),
            command.requestId, command.now),
        ] : []),
        ...(command.promoId && command.discountMinor > 0 ? [this.env.DB.prepare(
          `INSERT INTO promo_redemptions
           (id, studio_id, promo_code_id, user_id, booking_id, discount_minor, status, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'applied', ?7)`,
        ).bind(crypto.randomUUID(), command.studioId, command.promoId, command.artistUserId, command.bookingId, command.discountMinor, command.now)] : []),
        this.env.DB.prepare(
          `UPDATE waitlist_entries SET status='converted',updated_at=?1
           WHERE studio_id=?2 AND user_id=?3 AND service_id=?4 AND resource_id=?5
             AND day_start_utc<=?6 AND day_end_utc>?6 AND status IN ('active','notified')`,
        ).bind(command.now, command.studioId, command.artistUserId, command.serviceId, command.resourceId, command.startAtUtc),
        this.env.DB.prepare(
          `INSERT INTO booking_events (id, studio_id, booking_id, actor_user_id, event_type, payload_json, created_at)
           VALUES (?1, ?2, ?3, ?4, 'created', ?5, ?6)`,
        ).bind(crypto.randomUUID(), command.studioId, command.bookingId, command.actorUserId, JSON.stringify({
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
          paymentMethod: command.paymentMethod,
          packageBalanceId: command.packageBalanceId,
        }), command.now),
        this.env.DB.prepare(
          `INSERT INTO audit_logs (id, studio_id, actor_user_id, action, entity_type, entity_id, diff_json, request_id, created_at)
           VALUES (?1, ?2, ?3, 'booking.created', 'booking', ?4, ?5, ?6, ?7)`,
        ).bind(crypto.randomUUID(), command.studioId, command.actorUserId, command.bookingId,
          JSON.stringify({ startAtUtc: command.startAtUtc, endAtUtc: command.endAtUtc, status: 'confirmed', artistUserId: command.artistUserId, paymentMethod: command.paymentMethod }),
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
        payment_method: command.paymentMethod,
        package_balance_id: command.packageBalanceId,
        credit_amount_minor: creditAmountMinor,
        package_minutes: packageMinutes,
        value_refunded_at: null,
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
       payment_method,package_balance_id,credit_amount_minor,package_minutes,value_refunded_at,
       request_fingerprint, created_at
       FROM bookings WHERE studio_id = ?1 AND resource_id = ?2 AND id = ?3 LIMIT 1`,
    ).bind(command.studioId, command.resourceId, command.bookingId).first<StoredBooking>();
    if (!booking) return { kind: 'not_found' };
    if (booking.status === 'cancelled') return { kind: 'replayed', booking };
    if (booking.status !== 'confirmed') return { kind: 'invalid_status' };

    await this.env.DB.batch([
      this.env.DB.prepare(
        `UPDATE bookings SET status = 'cancelled', value_refunded_at=CASE WHEN payment_method='none' THEN value_refunded_at ELSE ?1 END,
         version = version + 1, updated_at = ?1
         WHERE studio_id = ?2 AND id = ?3 AND status = 'confirmed'`,
      ).bind(command.now, command.studioId, command.bookingId),
      ...(booking.payment_method === 'credit' && booking.credit_amount_minor > 0 && booking.value_refunded_at === null ? [
        this.env.DB.prepare(
          `INSERT INTO credit_ledger
           (id,studio_id,user_id,amount_minor,currency,kind,reason,actor_user_id,booking_id,idempotency_key,created_at)
           VALUES (?1,?2,?3,?4,?5,'refund',?6,?7,?8,?9,?10)`,
        ).bind(crypto.randomUUID(), command.studioId, booking.artist_user_id, booking.credit_amount_minor, booking.currency_snapshot,
          `Povrat za otkazanu rezervaciju: ${booking.service_name_snapshot}`, command.actorUserId, booking.id,
          `${booking.id}:credit-refund`, command.now),
        this.env.DB.prepare(
          `INSERT INTO audit_logs (id,studio_id,actor_user_id,action,entity_type,entity_id,diff_json,request_id,created_at)
           VALUES (?1,?2,?3,'credit.refunded_for_booking','booking',?4,?5,?6,?7)`,
        ).bind(crypto.randomUUID(), command.studioId, command.actorUserId, booking.id,
          JSON.stringify({ artistUserId: booking.artist_user_id, amountMinor: booking.credit_amount_minor, currency: booking.currency_snapshot }),
          command.requestId, command.now),
      ] : []),
      ...(booking.payment_method === 'package' && booking.package_balance_id && booking.package_minutes > 0 && booking.value_refunded_at === null ? [
        this.env.DB.prepare(
          `UPDATE package_balances SET remaining_minutes=remaining_minutes+?1,
           status=CASE WHEN expires_at IS NOT NULL AND expires_at<=?2 THEN 'expired' ELSE 'active' END,updated_at=?2
           WHERE studio_id=?3 AND user_id=?4 AND id=?5`,
        ).bind(booking.package_minutes, command.now, command.studioId, booking.artist_user_id, booking.package_balance_id),
        this.env.DB.prepare(
          `INSERT INTO package_ledger
           (id,studio_id,user_id,package_balance_id,amount_minutes,kind,reason,actor_user_id,booking_id,idempotency_key,created_at)
           VALUES (?1,?2,?3,?4,?5,'refund',?6,?7,?8,?9,?10)`,
        ).bind(crypto.randomUUID(), command.studioId, booking.artist_user_id, booking.package_balance_id, booking.package_minutes,
          `Povrat za otkazanu rezervaciju: ${booking.service_name_snapshot}`, command.actorUserId, booking.id,
          `${booking.id}:package-refund`, command.now),
        this.env.DB.prepare(
          `INSERT INTO audit_logs (id,studio_id,actor_user_id,action,entity_type,entity_id,diff_json,request_id,created_at)
           VALUES (?1,?2,?3,'package.refunded_for_booking','booking',?4,?5,?6,?7)`,
        ).bind(crypto.randomUUID(), command.studioId, command.actorUserId, booking.id,
          JSON.stringify({ artistUserId: booking.artist_user_id, packageBalanceId: booking.package_balance_id, amountMinutes: booking.package_minutes }),
          command.requestId, command.now),
      ] : []),
      this.env.DB.prepare('DELETE FROM slot_claims WHERE studio_id = ?1 AND booking_id = ?2')
        .bind(command.studioId, command.bookingId),
      this.env.DB.prepare(
        `UPDATE promo_redemptions SET status='reversed', reversed_at=?1
         WHERE studio_id=?2 AND booking_id=?3 AND status='applied'`,
      ).bind(command.now, command.studioId, command.bookingId),
      this.env.DB.prepare(
        `INSERT INTO notifications (id,studio_id,user_id,type,title,body,entity_type,entity_id,created_at)
         SELECT lower(hex(randomblob(16))),w.studio_id,w.user_id,'waitlist_slot_available','Oslobodio se termin',
           'Oslobodio se termin za ' || w.service_name_snapshot || ' na datum ' || w.desired_date || '. Rezervirajte ga dok je dostupan.',
           'waitlist_entry',w.id,?1
         FROM waitlist_entries w
         WHERE w.studio_id=?2 AND w.resource_id=?3 AND w.service_id=?4
           AND w.day_start_utc<=?5 AND w.day_end_utc>?5 AND w.day_end_utc>?1 AND w.status='active'`,
      ).bind(command.now, command.studioId, command.resourceId, booking.service_id, booking.start_at_utc),
      this.env.DB.prepare(
        `UPDATE waitlist_entries SET status='notified',notification_count=notification_count+1,last_notified_at=?1,updated_at=?1
         WHERE studio_id=?2 AND resource_id=?3 AND service_id=?4
           AND day_start_utc<=?5 AND day_end_utc>?5 AND day_end_utc>?1 AND status='active'`,
      ).bind(command.now, command.studioId, command.resourceId, booking.service_id, booking.start_at_utc),
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
    return { kind: 'cancelled', booking: { ...booking, status: 'cancelled', value_refunded_at: booking.payment_method === 'none' ? null : command.now } };
  }

  async updateBookingStatus(command: UpdateBookingStatusCommand): Promise<UpdateBookingStatusResult> {
    const booking = await this.env.DB.prepare(
      `SELECT id,studio_id,resource_id,artist_user_id,service_id,start_at_utc,end_at_utc,status,
       service_name_snapshot,duration_minutes_snapshot,price_minor_snapshot,subtotal_price_minor_snapshot,
       discount_minor_snapshot,promo_code_id,promo_code_snapshot,currency_snapshot,
       payment_method,package_balance_id,credit_amount_minor,package_minutes,value_refunded_at,request_fingerprint,created_at
       FROM bookings WHERE studio_id=?1 AND resource_id=?2 AND id=?3 LIMIT 1`,
    ).bind(command.studioId, command.resourceId, command.bookingId).first<StoredBooking>();
    if (!booking) return { kind: 'not_found' };
    if (booking.status === command.status) return { kind: 'replayed', booking };
    if (booking.status !== 'confirmed') return { kind: 'invalid_status' };
    if ((command.status === 'completed' && booking.end_at_utc > command.now)
      || (command.status === 'no_show' && booking.start_at_utc > command.now)) return { kind: 'too_early' };

    await this.env.DB.batch([
      this.env.DB.prepare(
        `UPDATE bookings SET status=?1,version=version+1,updated_at=?2
         WHERE studio_id=?3 AND id=?4 AND status='confirmed'`,
      ).bind(command.status, command.now, command.studioId, command.bookingId),
      this.env.DB.prepare('DELETE FROM slot_claims WHERE studio_id=?1 AND booking_id=?2').bind(command.studioId, command.bookingId),
      this.env.DB.prepare(
        `INSERT INTO booking_events (id,studio_id,booking_id,actor_user_id,event_type,payload_json,created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7)`,
      ).bind(crypto.randomUUID(), command.studioId, command.bookingId, command.actorUserId, command.status,
        JSON.stringify({ before: { status: 'confirmed' }, after: { status: command.status } }), command.now),
      this.env.DB.prepare(
        `INSERT INTO audit_logs (id,studio_id,actor_user_id,action,entity_type,entity_id,diff_json,request_id,created_at)
         VALUES (?1,?2,?3,?4,'booking',?5,?6,?7,?8)`,
      ).bind(crypto.randomUUID(), command.studioId, command.actorUserId, `booking.${command.status}`, command.bookingId,
        JSON.stringify({ before: { status: 'confirmed' }, after: { status: command.status } }), command.requestId, command.now),
    ]);
    return { kind: 'updated', booking: { ...booking, status: command.status } };
  }

  async rescheduleBooking(command: RescheduleBookingCommand): Promise<RescheduleBookingResult> {
    const booking = await this.env.DB.prepare(
      `SELECT id,studio_id,resource_id,artist_user_id,service_id,start_at_utc,end_at_utc,status,
       service_name_snapshot,duration_minutes_snapshot,price_minor_snapshot,subtotal_price_minor_snapshot,
       discount_minor_snapshot,promo_code_id,promo_code_snapshot,currency_snapshot,
       payment_method,package_balance_id,credit_amount_minor,package_minutes,value_refunded_at,request_fingerprint,created_at
       FROM bookings WHERE studio_id=?1 AND resource_id=?2 AND id=?3 LIMIT 1`,
    ).bind(command.studioId, command.resourceId, command.bookingId).first<StoredBooking>();
    if (!booking) return { kind: 'not_found' };
    if (booking.status !== 'confirmed') return { kind: 'invalid_status' };
    if (booking.start_at_utc === command.startAtUtc && booking.end_at_utc === command.endAtUtc) {
      return { kind: 'replayed', booking };
    }
    const overlap = await this.env.DB.prepare(
      `SELECT id FROM blocked_slots
       WHERE studio_id=?1 AND resource_id=?2 AND start_at_utc<?4 AND end_at_utc>?3
       UNION ALL
       SELECT id FROM bookings
       WHERE studio_id=?1 AND resource_id=?2 AND id<>?5 AND status='confirmed' AND start_at_utc<?4 AND end_at_utc>?3
       LIMIT 1`,
    ).bind(command.studioId, command.resourceId, command.startAtUtc, command.endAtUtc, command.bookingId).first();
    if (overlap) return { kind: 'conflict' };
    const slotStarts: number[] = [];
    for (let slot = command.startAtUtc; slot < command.endAtUtc; slot += 15 * 60_000) slotStarts.push(slot);
    const change = {
      before: { startAtUtc: booking.start_at_utc, endAtUtc: booking.end_at_utc },
      after: { startAtUtc: command.startAtUtc, endAtUtc: command.endAtUtc },
    };
    try {
      await this.env.DB.batch([
        this.env.DB.prepare('DELETE FROM slot_claims WHERE studio_id=?1 AND booking_id=?2')
          .bind(command.studioId, command.bookingId),
        this.env.DB.prepare(
          `UPDATE bookings SET start_at_utc=?1,end_at_utc=?2,version=version+1,updated_at=?3
           WHERE studio_id=?4 AND id=?5 AND status='confirmed'`,
        ).bind(command.startAtUtc, command.endAtUtc, command.now, command.studioId, command.bookingId),
        ...slotStarts.map((slot) => this.env.DB.prepare(
          `INSERT INTO slot_claims (studio_id,resource_id,slot_start_utc,booking_id,created_at)
           VALUES (?1,?2,?3,?4,?5)`,
        ).bind(command.studioId, command.resourceId, slot, command.bookingId, command.now)),
        this.env.DB.prepare(
          `UPDATE waitlist_entries SET status='converted',updated_at=?1
           WHERE studio_id=?2 AND user_id=?3 AND service_id=?4 AND resource_id=?5
             AND day_start_utc<=?6 AND day_end_utc>?6 AND status IN ('active','notified')`,
        ).bind(command.now, command.studioId, booking.artist_user_id, booking.service_id, command.resourceId, command.startAtUtc),
        this.env.DB.prepare(
          `INSERT INTO notifications (id,studio_id,user_id,type,title,body,entity_type,entity_id,created_at)
           SELECT lower(hex(randomblob(16))),w.studio_id,w.user_id,'waitlist_slot_available','Oslobodio se termin',
             'Oslobodio se termin za ' || w.service_name_snapshot || ' na datum ' || w.desired_date || '. Rezervirajte ga dok je dostupan.',
             'waitlist_entry',w.id,?1
           FROM waitlist_entries w
           WHERE w.studio_id=?2 AND w.resource_id=?3 AND w.service_id=?4
             AND w.day_start_utc<=?5 AND w.day_end_utc>?5 AND w.day_end_utc>?1 AND w.status='active'`,
        ).bind(command.now, command.studioId, command.resourceId, booking.service_id, booking.start_at_utc),
        this.env.DB.prepare(
          `UPDATE waitlist_entries SET status='notified',notification_count=notification_count+1,last_notified_at=?1,updated_at=?1
           WHERE studio_id=?2 AND resource_id=?3 AND service_id=?4
             AND day_start_utc<=?5 AND day_end_utc>?5 AND day_end_utc>?1 AND status='active'`,
        ).bind(command.now, command.studioId, command.resourceId, booking.service_id, booking.start_at_utc),
        this.env.DB.prepare(
          `INSERT INTO notifications (id,studio_id,user_id,type,title,body,entity_type,entity_id,created_at)
           VALUES (?1,?2,?3,'booking_rescheduled','Termin je pomaknut',?4,'booking',?5,?6)`,
        ).bind(crypto.randomUUID(), command.studioId, booking.artist_user_id,
          `Vaš termin za ${booking.service_name_snapshot} je pomaknut. Novi termin provjerite u svojim rezervacijama.`,
          booking.id, command.now),
        this.env.DB.prepare(
          `INSERT INTO booking_events (id,studio_id,booking_id,actor_user_id,event_type,payload_json,created_at)
           VALUES (?1,?2,?3,?4,'rescheduled',?5,?6)`,
        ).bind(crypto.randomUUID(), command.studioId, command.bookingId, command.actorUserId, JSON.stringify(change), command.now),
        this.env.DB.prepare(
          `INSERT INTO audit_logs (id,studio_id,actor_user_id,action,entity_type,entity_id,diff_json,request_id,created_at)
           VALUES (?1,?2,?3,'booking.rescheduled','booking',?4,?5,?6,?7)`,
        ).bind(crypto.randomUUID(), command.studioId, command.actorUserId, command.bookingId,
          JSON.stringify(change), command.requestId, command.now),
      ]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('UNIQUE constraint failed') || message.includes('SQLITE_CONSTRAINT')) return { kind: 'conflict' };
      throw error;
    }
    return { kind: 'rescheduled', booking: { ...booking, start_at_utc: command.startAtUtc, end_at_utc: command.endAtUtc } };
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
