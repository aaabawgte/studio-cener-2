CREATE TABLE "booking_notes" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studio_id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "author_user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "body" TEXT NOT NULL CHECK (length("body") BETWEEN 1 AND 1000),
  "created_at" INTEGER NOT NULL,
  FOREIGN KEY ("studio_id", "booking_id") REFERENCES "bookings"("studio_id", "id") ON DELETE RESTRICT
);

CREATE INDEX "booking_notes_studio_booking_created_idx"
  ON "booking_notes"("studio_id", "booking_id", "created_at");

CREATE TRIGGER "booking_notes_no_update"
BEFORE UPDATE ON "booking_notes"
BEGIN
  SELECT RAISE(ABORT, 'booking notes are append-only');
END;

CREATE TRIGGER "booking_notes_no_delete"
BEFORE DELETE ON "booking_notes"
BEGIN
  SELECT RAISE(ABORT, 'booking notes are append-only');
END;
