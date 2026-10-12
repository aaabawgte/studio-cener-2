CREATE TABLE "blocked_slots" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studio_id" TEXT NOT NULL,
  "resource_id" TEXT NOT NULL,
  "start_at_utc" INTEGER NOT NULL,
  "end_at_utc" INTEGER NOT NULL CHECK ("end_at_utc" > "start_at_utc"),
  "reason" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL,
  FOREIGN KEY ("studio_id", "resource_id") REFERENCES "bookable_resources"("studio_id", "id") ON DELETE RESTRICT,
  UNIQUE ("studio_id", "id")
);

CREATE INDEX "blocked_slots_studio_resource_time_idx" ON "blocked_slots"("studio_id", "resource_id", "start_at_utc", "end_at_utc");

CREATE TABLE "bookings" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studio_id" TEXT NOT NULL,
  "resource_id" TEXT NOT NULL,
  "artist_user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "service_id" TEXT NOT NULL,
  "start_at_utc" INTEGER NOT NULL,
  "end_at_utc" INTEGER NOT NULL CHECK ("end_at_utc" > "start_at_utc"),
  "status" TEXT NOT NULL CHECK ("status" IN ('confirmed', 'cancelled', 'completed', 'no_show')),
  "service_name_snapshot" TEXT NOT NULL,
  "duration_minutes_snapshot" INTEGER NOT NULL CHECK ("duration_minutes_snapshot" > 0),
  "price_minor_snapshot" INTEGER NOT NULL CHECK ("price_minor_snapshot" >= 0),
  "currency_snapshot" TEXT NOT NULL CHECK (length("currency_snapshot") = 3),
  "idempotency_key" TEXT NOT NULL,
  "request_fingerprint" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL,
  FOREIGN KEY ("studio_id", "resource_id") REFERENCES "bookable_resources"("studio_id", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("studio_id", "service_id") REFERENCES "services"("studio_id", "id") ON DELETE RESTRICT,
  UNIQUE ("studio_id", "id"),
  UNIQUE ("studio_id", "idempotency_key")
);

CREATE INDEX "bookings_studio_resource_start_idx" ON "bookings"("studio_id", "resource_id", "start_at_utc");
CREATE INDEX "bookings_studio_artist_start_idx" ON "bookings"("studio_id", "artist_user_id", "start_at_utc");

CREATE TABLE "slot_claims" (
  "studio_id" TEXT NOT NULL,
  "resource_id" TEXT NOT NULL,
  "slot_start_utc" INTEGER NOT NULL,
  "booking_id" TEXT NOT NULL,
  "created_at" INTEGER NOT NULL,
  PRIMARY KEY ("studio_id", "resource_id", "slot_start_utc"),
  FOREIGN KEY ("studio_id", "booking_id") REFERENCES "bookings"("studio_id", "id") ON DELETE CASCADE
) WITHOUT ROWID;

CREATE INDEX "slot_claims_booking_idx" ON "slot_claims"("studio_id", "booking_id");

CREATE TABLE "booking_events" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studio_id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "actor_user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "event_type" TEXT NOT NULL CHECK ("event_type" IN ('created', 'cancelled', 'completed', 'no_show')),
  "payload_json" TEXT NOT NULL,
  "created_at" INTEGER NOT NULL,
  FOREIGN KEY ("studio_id", "booking_id") REFERENCES "bookings"("studio_id", "id") ON DELETE RESTRICT
);

CREATE INDEX "booking_events_studio_booking_created_idx" ON "booking_events"("studio_id", "booking_id", "created_at");
