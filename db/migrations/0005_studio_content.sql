CREATE TABLE "team_members" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studio_id" TEXT NOT NULL REFERENCES "studios"("id") ON DELETE RESTRICT,
  "name" TEXT NOT NULL,
  "role_title" TEXT NOT NULL,
  "bio" TEXT,
  "image_r2_key" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'hidden')),
  "sort_order" INTEGER NOT NULL DEFAULT 0 CHECK ("sort_order" >= 0),
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL,
  UNIQUE ("studio_id", "id")
);

CREATE INDEX "team_members_studio_status_sort_idx"
  ON "team_members"("studio_id", "status", "sort_order", "name");

CREATE TABLE "portfolio_projects" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studio_id" TEXT NOT NULL REFERENCES "studios"("id") ON DELETE RESTRICT,
  "title" TEXT NOT NULL,
  "artist_name" TEXT NOT NULL,
  "description" TEXT,
  "image_r2_key" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft', 'published')),
  "sort_order" INTEGER NOT NULL DEFAULT 0 CHECK ("sort_order" >= 0),
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL,
  UNIQUE ("studio_id", "id")
);

CREATE INDEX "portfolio_projects_studio_status_sort_idx"
  ON "portfolio_projects"("studio_id", "status", "sort_order", "title");
