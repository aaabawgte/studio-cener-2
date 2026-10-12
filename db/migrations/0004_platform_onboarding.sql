CREATE TABLE "studio_licenses" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studio_id" TEXT NOT NULL UNIQUE REFERENCES "studios"("id") ON DELETE RESTRICT,
  "plan" TEXT NOT NULL CHECK ("plan" IN ('starter', 'pro', 'custom')),
  "status" TEXT NOT NULL CHECK ("status" IN ('trial', 'active', 'grace', 'suspended', 'expired')),
  "starts_at" INTEGER NOT NULL,
  "expires_at" INTEGER NOT NULL CHECK ("expires_at" > "starts_at"),
  "grace_ends_at" INTEGER,
  "max_managers" INTEGER NOT NULL DEFAULT 1 CHECK ("max_managers" >= 0),
  "features_json" TEXT NOT NULL DEFAULT '{}',
  "notes" TEXT,
  "created_by_user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL
);

CREATE INDEX "studio_licenses_status_expiry_idx" ON "studio_licenses"("status", "expires_at");

CREATE TABLE "studio_invitations" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studio_id" TEXT NOT NULL REFERENCES "studios"("id") ON DELETE RESTRICT,
  "email" TEXT NOT NULL COLLATE NOCASE,
  "role" TEXT NOT NULL CHECK ("role" IN ('owner', 'manager')),
  "token_hash" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'accepted', 'revoked', 'expired')),
  "expires_at" INTEGER NOT NULL,
  "invited_by_user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "accepted_by_user_id" TEXT REFERENCES "user"("id") ON DELETE RESTRICT,
  "created_at" INTEGER NOT NULL,
  "accepted_at" INTEGER
);

CREATE INDEX "studio_invitations_studio_status_idx" ON "studio_invitations"("studio_id", "status", "created_at");
CREATE UNIQUE INDEX "studio_invitations_pending_email_idx"
  ON "studio_invitations"("studio_id", "email", "role") WHERE "status" = 'pending';

CREATE TABLE "studio_domains" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studio_id" TEXT NOT NULL REFERENCES "studios"("id") ON DELETE RESTRICT,
  "hostname" TEXT NOT NULL UNIQUE COLLATE NOCASE,
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'active', 'failed')),
  "ssl_status" TEXT NOT NULL DEFAULT 'pending' CHECK ("ssl_status" IN ('pending', 'active', 'failed')),
  "cloudflare_hostname_id" TEXT UNIQUE,
  "is_primary" INTEGER NOT NULL DEFAULT 0 CHECK ("is_primary" IN (0, 1)),
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL,
  UNIQUE ("studio_id", "hostname")
);

CREATE INDEX "studio_domains_studio_status_idx" ON "studio_domains"("studio_id", "status");

INSERT INTO studio_licenses (
  id, studio_id, plan, status, starts_at, expires_at, max_managers, features_json, created_at, updated_at
)
SELECT 'license:' || id, id, 'pro', 'active', unixepoch() * 1000, (unixepoch() + 31536000) * 1000, 3, '{}', unixepoch() * 1000, unixepoch() * 1000
FROM studios;
