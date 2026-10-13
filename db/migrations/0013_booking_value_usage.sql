ALTER TABLE bookings ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'none'
  CHECK (payment_method IN ('none', 'credit', 'package'));
ALTER TABLE bookings ADD COLUMN package_balance_id TEXT;
ALTER TABLE bookings ADD COLUMN credit_amount_minor INTEGER NOT NULL DEFAULT 0
  CHECK (credit_amount_minor >= 0);
ALTER TABLE bookings ADD COLUMN package_minutes INTEGER NOT NULL DEFAULT 0
  CHECK (package_minutes >= 0);
ALTER TABLE bookings ADD COLUMN value_refunded_at INTEGER;

CREATE INDEX bookings_studio_artist_payment_idx
  ON bookings(studio_id, artist_user_id, payment_method, created_at DESC);
