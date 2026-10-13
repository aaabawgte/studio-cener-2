CREATE INDEX "bookings_studio_start_id_idx"
  ON "bookings"("studio_id", "start_at_utc" DESC, "id" DESC);

CREATE INDEX "bookings_studio_status_start_id_idx"
  ON "bookings"("studio_id", "status", "start_at_utc" DESC, "id" DESC);

CREATE INDEX "bookings_studio_artist_status_start_id_idx"
  ON "bookings"("studio_id", "artist_user_id", "status", "start_at_utc" DESC, "id" DESC);
