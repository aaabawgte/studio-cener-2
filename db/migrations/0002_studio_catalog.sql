ALTER TABLE "studios" ADD COLUMN "description" TEXT;
ALTER TABLE "studios" ADD COLUMN "address" TEXT;

CREATE TABLE "bookable_resources" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studio_id" TEXT NOT NULL REFERENCES "studios"("id") ON DELETE RESTRICT,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'archived')),
  "sort_order" INTEGER NOT NULL DEFAULT 0 CHECK ("sort_order" >= 0),
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL,
  UNIQUE ("studio_id", "id")
);

CREATE INDEX "bookable_resources_studio_status_idx" ON "bookable_resources"("studio_id", "status", "sort_order");

CREATE TABLE "services" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studio_id" TEXT NOT NULL REFERENCES "studios"("id") ON DELETE RESTRICT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "duration_minutes" INTEGER NOT NULL CHECK ("duration_minutes" BETWEEN 15 AND 720 AND "duration_minutes" % 15 = 0),
  "price_minor" INTEGER NOT NULL CHECK ("price_minor" >= 0),
  "currency" TEXT NOT NULL CHECK (length("currency") = 3 AND "currency" = upper("currency")),
  "status" TEXT NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'archived')),
  "sort_order" INTEGER NOT NULL DEFAULT 0 CHECK ("sort_order" >= 0),
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL,
  UNIQUE ("studio_id", "id")
);

CREATE INDEX "services_studio_status_sort_idx" ON "services"("studio_id", "status", "sort_order", "name");

CREATE TABLE "availability_rules" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studio_id" TEXT NOT NULL,
  "resource_id" TEXT NOT NULL,
  "weekday" INTEGER NOT NULL CHECK ("weekday" BETWEEN 0 AND 6),
  "start_minute" INTEGER NOT NULL CHECK ("start_minute" BETWEEN 0 AND 1439),
  "end_minute" INTEGER NOT NULL CHECK ("end_minute" BETWEEN 1 AND 1440 AND "end_minute" > "start_minute"),
  "valid_from" TEXT,
  "valid_to" TEXT,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL,
  FOREIGN KEY ("studio_id", "resource_id") REFERENCES "bookable_resources"("studio_id", "id") ON DELETE RESTRICT,
  UNIQUE ("studio_id", "resource_id", "weekday", "start_minute", "end_minute")
);

CREATE INDEX "availability_rules_studio_resource_weekday_idx" ON "availability_rules"("studio_id", "resource_id", "weekday", "start_minute");
