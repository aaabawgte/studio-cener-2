CREATE TABLE "booking_events_next" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studio_id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "actor_user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "event_type" TEXT NOT NULL CHECK ("event_type" IN ('created', 'cancelled', 'completed', 'no_show', 'rescheduled')),
  "payload_json" TEXT NOT NULL,
  "created_at" INTEGER NOT NULL,
  FOREIGN KEY ("studio_id", "booking_id") REFERENCES "bookings"("studio_id", "id") ON DELETE RESTRICT
);

INSERT INTO "booking_events_next" ("id","studio_id","booking_id","actor_user_id","event_type","payload_json","created_at")
SELECT "id","studio_id","booking_id","actor_user_id","event_type","payload_json","created_at" FROM "booking_events";

DROP TABLE "booking_events";

ALTER TABLE "booking_events_next" RENAME TO "booking_events";

CREATE INDEX "booking_events_studio_booking_created_idx" ON "booking_events"("studio_id", "booking_id", "created_at");

CREATE TABLE "notifications_next" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studio_id" TEXT NOT NULL REFERENCES "studios"("id") ON DELETE RESTRICT,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "type" TEXT NOT NULL CHECK ("type" IN ('waitlist_slot_available', 'booking_created', 'booking_cancelled', 'booking_rescheduled', 'system')),
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "read_at" INTEGER,
  "created_at" INTEGER NOT NULL,
  UNIQUE ("studio_id", "id")
);

INSERT INTO "notifications_next" ("id","studio_id","user_id","type","title","body","entity_type","entity_id","read_at","created_at")
SELECT "id","studio_id","user_id","type","title","body","entity_type","entity_id","read_at","created_at" FROM "notifications";

DROP TABLE "notifications";

ALTER TABLE "notifications_next" RENAME TO "notifications";

CREATE INDEX "notifications_studio_user_created_idx" ON "notifications"("studio_id", "user_id", "created_at" DESC);
CREATE INDEX "notifications_studio_user_unread_idx" ON "notifications"("studio_id", "user_id", "read_at", "created_at" DESC);
