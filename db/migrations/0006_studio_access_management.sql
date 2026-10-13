ALTER TABLE "team_members" ADD COLUMN "user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL;
ALTER TABLE "studio_invitations" ADD COLUMN "team_member_id" TEXT;

CREATE UNIQUE INDEX "team_members_studio_user_idx"
  ON "team_members"("studio_id", "user_id") WHERE "user_id" IS NOT NULL;

CREATE INDEX "studio_invitations_studio_role_status_expiry_idx"
  ON "studio_invitations"("studio_id", "role", "status", "expires_at");
