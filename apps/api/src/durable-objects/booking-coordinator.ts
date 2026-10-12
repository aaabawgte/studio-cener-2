import { DurableObject } from 'cloudflare:workers';

export class BookingCoordinator extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS _sql_schema_migrations (
          id INTEGER PRIMARY KEY,
          applied_at INTEGER NOT NULL
        );
        INSERT OR IGNORE INTO _sql_schema_migrations (id, applied_at)
        VALUES (1, unixepoch() * 1000);
      `);
    });
  }

  health(): { status: 'ok'; schemaVersion: number } {
    const row = this.ctx.storage.sql
      .exec<{ version: number }>('SELECT MAX(id) AS version FROM _sql_schema_migrations')
      .one();
    return { status: 'ok', schemaVersion: row.version };
  }
}
