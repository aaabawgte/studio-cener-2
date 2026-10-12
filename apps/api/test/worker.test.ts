import { healthResponseSchema } from '@studio/contracts';
import { env, exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('Studio Cener API foundation', () => {
  it('reports a healthy D1 binding', async () => {
    const response = await exports.default.fetch('https://api.example.test/api/health');

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(healthResponseSchema.parse(await response.json())).toEqual({
      status: 'ok',
      service: 'studio-cener-api',
      environment: 'local',
      checks: { database: 'ok' },
    });
  });

  it('initializes an isolated SQLite Durable Object', async () => {
    const stub = env.BOOKING_COORDINATOR.getByName('studio_test:resource_test');

    await expect(stub.health()).resolves.toEqual({ status: 'ok', schemaVersion: 1 });
  });

  it('uses the shared API error shape for unknown routes', async () => {
    const response = await exports.default.fetch('https://api.example.test/api/missing');

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ code: 'NOT_FOUND', message: 'Resource not found.' });
  });
});
