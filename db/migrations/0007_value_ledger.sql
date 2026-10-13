CREATE TABLE "hour_packages" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studio_id" TEXT NOT NULL REFERENCES "studios"("id") ON DELETE RESTRICT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "included_minutes" INTEGER NOT NULL CHECK ("included_minutes" > 0 AND "included_minutes" % 15 = 0),
  "price_minor" INTEGER NOT NULL CHECK ("price_minor" >= 0),
  "currency" TEXT NOT NULL CHECK (length("currency") = 3 AND "currency" = upper("currency")),
  "validity_days" INTEGER CHECK ("validity_days" IS NULL OR "validity_days" BETWEEN 1 AND 3650),
  "status" TEXT NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'archived')),
  "sort_order" INTEGER NOT NULL DEFAULT 0 CHECK ("sort_order" >= 0),
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL,
  UNIQUE ("studio_id", "id")
);
CREATE INDEX "hour_packages_studio_status_sort_idx" ON "hour_packages"("studio_id", "status", "sort_order", "name");

CREATE TABLE "package_balances" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studio_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "package_id" TEXT NOT NULL,
  "package_name_snapshot" TEXT NOT NULL,
  "granted_minutes" INTEGER NOT NULL CHECK ("granted_minutes" > 0),
  "remaining_minutes" INTEGER NOT NULL CHECK ("remaining_minutes" >= 0),
  "expires_at" INTEGER,
  "status" TEXT NOT NULL CHECK ("status" IN ('active', 'exhausted', 'expired')),
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL,
  FOREIGN KEY ("studio_id", "package_id") REFERENCES "hour_packages"("studio_id", "id") ON DELETE RESTRICT,
  UNIQUE ("studio_id", "id")
);
CREATE INDEX "package_balances_studio_user_status_idx" ON "package_balances"("studio_id", "user_id", "status", "created_at" DESC);

CREATE TABLE "package_ledger" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studio_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "package_balance_id" TEXT NOT NULL,
  "amount_minutes" INTEGER NOT NULL CHECK ("amount_minutes" != 0),
  "kind" TEXT NOT NULL CHECK ("kind" IN ('grant', 'use', 'refund', 'adjustment', 'expiry')),
  "reason" TEXT NOT NULL CHECK (length(trim("reason")) >= 2),
  "actor_user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "booking_id" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "created_at" INTEGER NOT NULL,
  FOREIGN KEY ("studio_id", "package_balance_id") REFERENCES "package_balances"("studio_id", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("studio_id", "booking_id") REFERENCES "bookings"("studio_id", "id") ON DELETE RESTRICT,
  UNIQUE ("studio_id", "idempotency_key")
);
CREATE INDEX "package_ledger_studio_user_created_idx" ON "package_ledger"("studio_id", "user_id", "created_at" DESC);

CREATE TABLE "credit_ledger" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studio_id" TEXT NOT NULL REFERENCES "studios"("id") ON DELETE RESTRICT,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "amount_minor" INTEGER NOT NULL CHECK ("amount_minor" != 0),
  "currency" TEXT NOT NULL CHECK (length("currency") = 3 AND "currency" = upper("currency")),
  "kind" TEXT NOT NULL CHECK ("kind" IN ('grant', 'use', 'refund', 'adjustment')),
  "reason" TEXT NOT NULL CHECK (length(trim("reason")) >= 2),
  "actor_user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "booking_id" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "created_at" INTEGER NOT NULL,
  FOREIGN KEY ("studio_id", "booking_id") REFERENCES "bookings"("studio_id", "id") ON DELETE RESTRICT,
  UNIQUE ("studio_id", "idempotency_key")
);
CREATE INDEX "credit_ledger_studio_user_created_idx" ON "credit_ledger"("studio_id", "user_id", "created_at" DESC);

CREATE TRIGGER "package_ledger_no_update" BEFORE UPDATE ON "package_ledger" BEGIN SELECT RAISE(ABORT, 'package_ledger is append-only'); END;
CREATE TRIGGER "package_ledger_no_delete" BEFORE DELETE ON "package_ledger" BEGIN SELECT RAISE(ABORT, 'package_ledger is append-only'); END;
CREATE TRIGGER "credit_ledger_no_update" BEFORE UPDATE ON "credit_ledger" BEGIN SELECT RAISE(ABORT, 'credit_ledger is append-only'); END;
CREATE TRIGGER "credit_ledger_no_delete" BEFORE DELETE ON "credit_ledger" BEGIN SELECT RAISE(ABORT, 'credit_ledger is append-only'); END;
