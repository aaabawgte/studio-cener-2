CREATE TABLE "user" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE COLLATE NOCASE,
  "emailVerified" INTEGER NOT NULL DEFAULT 0 CHECK ("emailVerified" IN (0, 1)),
  "image" TEXT,
  "platformRole" TEXT CHECK ("platformRole" IS NULL OR "platformRole" = 'platform_admin'),
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL
);

CREATE TABLE "session" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "expiresAt" INTEGER NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE INDEX "session_user_id_idx" ON "session"("userId");

CREATE TABLE "account" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" INTEGER,
  "refreshTokenExpiresAt" INTEGER,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL
);

CREATE INDEX "account_user_id_idx" ON "account"("userId");
CREATE UNIQUE INDEX "account_provider_account_idx" ON "account"("providerId", "accountId");

CREATE TABLE "verification" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" INTEGER NOT NULL,
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL
);

CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

CREATE TABLE "studios" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "slug" TEXT NOT NULL UNIQUE COLLATE NOCASE,
  "name" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "currency" TEXT NOT NULL CHECK (length("currency") = 3 AND "currency" = upper("currency")),
  "status" TEXT NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'suspended', 'archived')),
  "accent_color" TEXT,
  "logo_r2_key" TEXT,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL
);

CREATE TABLE "memberships" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studio_id" TEXT NOT NULL REFERENCES "studios"("id") ON DELETE RESTRICT,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "role" TEXT NOT NULL CHECK ("role" IN ('owner', 'manager', 'artist')),
  "status" TEXT NOT NULL DEFAULT 'active' CHECK ("status" IN ('invited', 'active', 'suspended', 'revoked')),
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL,
  UNIQUE ("studio_id", "user_id")
);

CREATE INDEX "memberships_studio_role_idx" ON "memberships"("studio_id", "role", "status");
CREATE INDEX "memberships_studio_user_idx" ON "memberships"("studio_id", "user_id", "status");

CREATE TABLE "audit_logs" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studio_id" TEXT NOT NULL REFERENCES "studios"("id") ON DELETE RESTRICT,
  "actor_user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT,
  "diff_json" TEXT,
  "request_id" TEXT NOT NULL,
  "created_at" INTEGER NOT NULL
);

CREATE INDEX "audit_logs_studio_created_idx" ON "audit_logs"("studio_id", "created_at" DESC);
