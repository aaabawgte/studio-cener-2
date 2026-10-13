CREATE TABLE "promo_codes" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studio_id" TEXT NOT NULL REFERENCES "studios"("id") ON DELETE RESTRICT,
  "code" TEXT NOT NULL COLLATE NOCASE,
  "description" TEXT,
  "discount_type" TEXT NOT NULL CHECK ("discount_type" IN ('percentage', 'fixed')),
  "discount_value" INTEGER NOT NULL CHECK ("discount_value" > 0),
  "max_discount_minor" INTEGER CHECK ("max_discount_minor" IS NULL OR "max_discount_minor" > 0),
  "minimum_spend_minor" INTEGER NOT NULL DEFAULT 0 CHECK ("minimum_spend_minor" >= 0),
  "valid_from" INTEGER NOT NULL,
  "valid_until" INTEGER NOT NULL CHECK ("valid_until" > "valid_from"),
  "max_redemptions" INTEGER CHECK ("max_redemptions" IS NULL OR "max_redemptions" > 0),
  "max_redemptions_per_user" INTEGER NOT NULL DEFAULT 1 CHECK ("max_redemptions_per_user" > 0),
  "status" TEXT NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'archived')),
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL,
  UNIQUE ("studio_id", "id"),
  UNIQUE ("studio_id", "code")
);
CREATE INDEX "promo_codes_studio_status_validity_idx" ON "promo_codes"("studio_id", "status", "valid_from", "valid_until");

ALTER TABLE "bookings" ADD COLUMN "subtotal_price_minor_snapshot" INTEGER NOT NULL DEFAULT 0 CHECK ("subtotal_price_minor_snapshot" >= 0);
ALTER TABLE "bookings" ADD COLUMN "discount_minor_snapshot" INTEGER NOT NULL DEFAULT 0 CHECK ("discount_minor_snapshot" >= 0);
ALTER TABLE "bookings" ADD COLUMN "promo_code_id" TEXT;
ALTER TABLE "bookings" ADD COLUMN "promo_code_snapshot" TEXT;
UPDATE "bookings" SET "subtotal_price_minor_snapshot" = "price_minor_snapshot";

CREATE TABLE "promo_redemptions" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studio_id" TEXT NOT NULL,
  "promo_code_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "booking_id" TEXT NOT NULL,
  "discount_minor" INTEGER NOT NULL CHECK ("discount_minor" > 0),
  "status" TEXT NOT NULL DEFAULT 'applied' CHECK ("status" IN ('applied', 'reversed')),
  "created_at" INTEGER NOT NULL,
  "reversed_at" INTEGER,
  FOREIGN KEY ("studio_id", "promo_code_id") REFERENCES "promo_codes"("studio_id", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("studio_id", "booking_id") REFERENCES "bookings"("studio_id", "id") ON DELETE RESTRICT,
  UNIQUE ("studio_id", "id"),
  UNIQUE ("studio_id", "booking_id")
);
CREATE INDEX "promo_redemptions_studio_code_status_idx" ON "promo_redemptions"("studio_id", "promo_code_id", "status", "created_at");
CREATE INDEX "promo_redemptions_studio_user_code_idx" ON "promo_redemptions"("studio_id", "user_id", "promo_code_id", "status");

CREATE TRIGGER "promo_redemptions_global_limit"
BEFORE INSERT ON "promo_redemptions"
WHEN NEW."status" = 'applied' AND (
  SELECT p."max_redemptions" IS NOT NULL AND
    (SELECT count(*) FROM "promo_redemptions" r WHERE r."studio_id" = NEW."studio_id" AND r."promo_code_id" = NEW."promo_code_id" AND r."status" = 'applied') >= p."max_redemptions"
  FROM "promo_codes" p WHERE p."studio_id" = NEW."studio_id" AND p."id" = NEW."promo_code_id"
)
BEGIN SELECT RAISE(ABORT, 'PROMO_MAX_REDEMPTIONS'); END;

CREATE TRIGGER "promo_redemptions_user_limit"
BEFORE INSERT ON "promo_redemptions"
WHEN NEW."status" = 'applied' AND (
  SELECT (SELECT count(*) FROM "promo_redemptions" r WHERE r."studio_id" = NEW."studio_id" AND r."promo_code_id" = NEW."promo_code_id" AND r."user_id" = NEW."user_id" AND r."status" = 'applied') >= p."max_redemptions_per_user"
  FROM "promo_codes" p WHERE p."studio_id" = NEW."studio_id" AND p."id" = NEW."promo_code_id"
)
BEGIN SELECT RAISE(ABORT, 'PROMO_USER_LIMIT'); END;
