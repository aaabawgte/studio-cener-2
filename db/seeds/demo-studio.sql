INSERT OR IGNORE INTO studios (
  id, slug, name, timezone, currency, status, accent_color, description, address, created_at, updated_at
) VALUES (
  'studio-demo', 'demo', 'Studio Cener Demo', 'Europe/Zagreb', 'EUR', 'active', '#76543b',
  'Premium recording prostor za vokale, produkciju i mix. Isprobajte stvarni Studio Cener booking tok.',
  'Zagreb, Hrvatska', 1791820800000, 1791820800000
);

INSERT OR IGNORE INTO bookable_resources (
  id, studio_id, name, status, sort_order, created_at, updated_at
) VALUES (
  'main:studio-demo', 'studio-demo', 'Glavni studio', 'active', 0, 1791820800000, 1791820800000
);

INSERT OR IGNORE INTO services (
  id, studio_id, name, description, duration_minutes, price_minor, currency, status, sort_order, created_at, updated_at
) VALUES
  ('demo-vocal', 'studio-demo', 'Snimanje vokala', 'Studio, inženjer i osnovna priprema sessiona.', 120, 9000, 'EUR', 'active', 0, 1791820800000, 1791820800000),
  ('demo-mix', 'studio-demo', 'Mix', 'Detaljan balans, obrada i priprema za mastering.', 180, 15000, 'EUR', 'active', 1, 1791820800000, 1791820800000),
  ('demo-production', 'studio-demo', 'Produkcijski session', 'Razrada aranžmana i produkcija pjesme u studiju.', 240, 22000, 'EUR', 'active', 2, 1791820800000, 1791820800000);

INSERT OR IGNORE INTO availability_rules (
  id, studio_id, resource_id, weekday, start_minute, end_minute, created_at, updated_at
) VALUES
  ('demo-hours-1', 'studio-demo', 'main:studio-demo', 1, 600, 1200, 1791820800000, 1791820800000),
  ('demo-hours-2', 'studio-demo', 'main:studio-demo', 2, 600, 1200, 1791820800000, 1791820800000),
  ('demo-hours-3', 'studio-demo', 'main:studio-demo', 3, 600, 1200, 1791820800000, 1791820800000),
  ('demo-hours-4', 'studio-demo', 'main:studio-demo', 4, 600, 1200, 1791820800000, 1791820800000),
  ('demo-hours-5', 'studio-demo', 'main:studio-demo', 5, 600, 1200, 1791820800000, 1791820800000),
  ('demo-hours-6', 'studio-demo', 'main:studio-demo', 6, 660, 1080, 1791820800000, 1791820800000);
