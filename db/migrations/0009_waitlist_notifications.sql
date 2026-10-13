CREATE TABLE "waitlist_entries" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studio_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "service_id" TEXT NOT NULL,
  "resource_id" TEXT NOT NULL,
  "service_name_snapshot" TEXT NOT NULL,
  "desired_date" TEXT NOT NULL CHECK ("desired_date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  "day_start_utc" INTEGER NOT NULL,
  "day_end_utc" INTEGER NOT NULL CHECK ("day_end_utc" > "day_start_utc"),
  "status" TEXT NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'notified', 'cancelled', 'converted', 'expired')),
  "notification_count" INTEGER NOT NULL DEFAULT 0 CHECK ("notification_count" >= 0),
  "last_notified_at" INTEGER,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL,
  FOREIGN KEY ("studio_id", "service_id") REFERENCES "services"("studio_id", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("studio_id", "resource_id") REFERENCES "bookable_resources"("studio_id", "id") ON DELETE RESTRICT,
  UNIQUE ("studio_id", "id")
);
CREATE UNIQUE INDEX "waitlist_entries_active_unique_idx"
  ON "waitlist_entries"("studio_id", "user_id", "service_id", "resource_id", "desired_date") WHERE "status" = 'active';
CREATE INDEX "waitlist_entries_match_idx"
  ON "waitlist_entries"("studio_id", "resource_id", "service_id", "status", "day_start_utc", "day_end_utc");
CREATE INDEX "waitlist_entries_studio_created_idx" ON "waitlist_entries"("studio_id", "status", "created_at" DESC);

CREATE TABLE "notifications" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studio_id" TEXT NOT NULL REFERENCES "studios"("id") ON DELETE RESTRICT,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "type" TEXT NOT NULL CHECK ("type" IN ('waitlist_slot_available', 'booking_created', 'booking_cancelled', 'system')),
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "read_at" INTEGER,
  "created_at" INTEGER NOT NULL,
  UNIQUE ("studio_id", "id")
);
CREATE INDEX "notifications_studio_user_created_idx" ON "notifications"("studio_id", "user_id", "created_at" DESC);
CREATE INDEX "notifications_studio_user_unread_idx" ON "notifications"("studio_id", "user_id", "read_at", "created_at" DESC);
