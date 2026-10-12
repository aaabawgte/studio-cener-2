import { healthResponseSchema } from '@studio/contracts';
import { env, exports } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import identityMigration from '../../../db/migrations/0001_identity_and_tenancy.sql?raw';

beforeAll(async () => {
  const statements = identityMigration
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)
    .map((statement) => env.DB.prepare(statement));
  await env.DB.batch(statements);
});

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

  it('creates a Better Auth session and resolves only its own studio membership', async () => {
    const signupResponse = await exports.default.fetch(new Request('https://api.example.test/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://api.example.test' },
      body: JSON.stringify({
        name: 'Studio Owner',
        email: 'owner@example.test',
        password: 'correct-horse-battery-staple',
      }),
    }));

    expect(signupResponse.status).toBe(200);
    const cookie = signupResponse.headers.get('set-cookie')?.split(';', 1)[0];
    expect(cookie).toBeTruthy();

    const user = await env.DB.prepare('SELECT id FROM "user" WHERE email = ?1')
      .bind('owner@example.test')
      .first<{ id: string }>();
    if (!user) throw new Error('Better Auth did not create the expected user.');

    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO studios (id, slug, name, timezone, currency, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'active', ?6, ?6)`,
      ).bind('studio_a', 'studio-a', 'Studio A', 'Europe/Zagreb', 'EUR', now),
      env.DB.prepare(
        `INSERT INTO studios (id, slug, name, timezone, currency, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'active', ?6, ?6)`,
      ).bind('studio_b', 'studio-b', 'Studio B', 'Europe/Zagreb', 'EUR', now),
      env.DB.prepare(
        `INSERT INTO memberships (id, studio_id, user_id, role, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'owner', 'active', ?4, ?4)`,
      ).bind('membership_a', 'studio_a', user.id, now),
    ]);

    const ownStudioResponse = await exports.default.fetch(new Request(
      'https://api.example.test/api/studios/studio-a/viewer-context',
      { headers: { Cookie: cookie ?? '' } },
    ));
    expect(ownStudioResponse.status).toBe(200);
    await expect(ownStudioResponse.json()).resolves.toMatchObject({
      studio: { id: 'studio_a', slug: 'studio-a' },
      membership: { role: 'owner' },
      viewer: { email: 'owner@example.test' },
    });

    const otherStudioResponse = await exports.default.fetch(new Request(
      'https://api.example.test/api/studios/studio-b/viewer-context',
      { headers: { Cookie: cookie ?? '' } },
    ));
    expect(otherStudioResponse.status).toBe(403);
    await expect(otherStudioResponse.json()).resolves.toEqual({
      code: 'MEMBERSHIP_REQUIRED',
      message: 'Studio membership required.',
    });
  });
});
