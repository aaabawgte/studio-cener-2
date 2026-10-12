import { blockedSlotSchema, bookingAvailabilitySchema, bookingSchema, healthResponseSchema, platformStudioCreatedSchema, serviceSchema } from '@studio/contracts';
import { env, exports } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import identityMigration from '../../../db/migrations/0001_identity_and_tenancy.sql?raw';
import catalogMigration from '../../../db/migrations/0002_studio_catalog.sql?raw';
import bookingMigration from '../../../db/migrations/0003_booking_engine.sql?raw';
import platformMigration from '../../../db/migrations/0004_platform_onboarding.sql?raw';

beforeAll(async () => {
  const statements = `${identityMigration}\n${catalogMigration}\n${bookingMigration}\n${platformMigration}`
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

  it('allows credentialed API requests only from configured origins', async () => {
    const trusted = await exports.default.fetch(new Request('https://api.example.test/api/health', {
      method: 'OPTIONS',
      headers: { Origin: 'https://api.example.test', 'Access-Control-Request-Method': 'GET' },
    }));
    expect(trusted.headers.get('access-control-allow-origin')).toBe('https://api.example.test');
    expect(trusted.headers.get('access-control-allow-credentials')).toBe('true');

    const untrusted = await exports.default.fetch(new Request('https://api.example.test/api/health', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET' },
    }));
    expect(untrusted.headers.get('access-control-allow-origin')).toBeNull();
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
      env.DB.prepare(
        `INSERT INTO studio_licenses (id, studio_id, plan, status, starts_at, expires_at, max_managers, features_json, created_by_user_id, created_at, updated_at)
         VALUES (?1, ?2, 'pro', 'active', ?3, ?4, 3, '{}', ?5, ?3, ?3)`,
      ).bind('license_a', 'studio_a', now, now + 365 * 86_400_000, user.id),
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

    const createServiceResponse = await exports.default.fetch(new Request(
      'https://api.example.test/api/studios/studio-a/services',
      {
        method: 'POST',
        headers: { Cookie: cookie ?? '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Snimanje vokala', durationMinutes: 120, priceMinor: 9000 }),
      },
    ));
    expect(createServiceResponse.status).toBe(201);
    const createdService = serviceSchema.parse(await createServiceResponse.json());
    expect(createdService).toMatchObject({
      name: 'Snimanje vokala',
      durationMinutes: 120,
      priceMinor: 9000,
      currency: 'EUR',
    });

    const updateServiceResponse = await exports.default.fetch(new Request(
      `https://api.example.test/api/studios/studio-a/services/${createdService.id}`,
      {
        method: 'PUT',
        headers: { Cookie: cookie ?? '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Snimanje i produkcija vokala', durationMinutes: 120, priceMinor: 10000 }),
      },
    ));
    expect(updateServiceResponse.status).toBe(200);
    await expect(updateServiceResponse.json()).resolves.toMatchObject({ name: 'Snimanje i produkcija vokala', priceMinor: 10000 });

    const replaceHoursResponse = await exports.default.fetch(new Request(
      'https://api.example.test/api/studios/studio-a/availability-rules',
      {
        method: 'PUT',
        headers: { Cookie: cookie ?? '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: [
          { weekday: 1, startMinute: 600, endMinute: 1080 },
          { weekday: 2, startMinute: 600, endMinute: 1080 },
        ] }),
      },
    ));
    expect(replaceHoursResponse.status).toBe(200);
    await expect(replaceHoursResponse.json()).resolves.toMatchObject({
      timezone: 'Europe/Zagreb',
      rules: [
        { weekday: 1, startMinute: 600, endMinute: 1080 },
        { weekday: 2, startMinute: 600, endMinute: 1080 },
      ],
    });

    const publicStudioResponse = await exports.default.fetch(
      'https://api.example.test/api/public/studios/studio-a',
    );
    expect(publicStudioResponse.status).toBe(200);
    await expect(publicStudioResponse.json()).resolves.toMatchObject({
      studio: { slug: 'studio-a', name: 'Studio A' },
      services: [{ name: 'Snimanje i produkcija vokala', priceMinor: 10000 }],
      availabilityRules: [
        { weekday: 1, startMinute: 600, endMinute: 1080 },
        { weekday: 2, startMinute: 600, endMinute: 1080 },
      ],
    });

    const crossTenantCatalogResponse = await exports.default.fetch(new Request(
      'https://api.example.test/api/studios/studio-b/services',
      { headers: { Cookie: cookie ?? '' } },
    ));
    expect(crossTenantCatalogResponse.status).toBe(403);

    const artistSignupResponse = await exports.default.fetch(new Request('https://api.example.test/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://api.example.test' },
      body: JSON.stringify({
        name: 'Studio Artist',
        email: 'artist@example.test',
        password: 'another-correct-horse-battery-staple',
      }),
    }));
    expect(artistSignupResponse.status).toBe(200);
    const artistCookie = artistSignupResponse.headers.get('set-cookie')?.split(';', 1)[0];
    expect(artistCookie).toBeTruthy();
    const artistJoinResponse = await exports.default.fetch(new Request(
      'https://api.example.test/api/studios/studio-a/artist-membership',
      { method: 'POST', headers: { Cookie: artistCookie ?? '' } },
    ));
    expect(artistJoinResponse.status).toBe(200);

    const forbiddenArtistBlocks = await exports.default.fetch(new Request(
      'https://api.example.test/api/studios/studio-a/blocked-slots',
      { headers: { Cookie: artistCookie ?? '' } },
    ));
    expect(forbiddenArtistBlocks.status).toBe(403);

    let availableSlot: string | undefined;
    for (let offset = 0; offset < 14 && !availableSlot; offset += 1) {
      const candidate = new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
      const availabilityResponse = await exports.default.fetch(
        `https://api.example.test/api/public/studios/studio-a/booking-availability?serviceId=${createdService.id}&date=${candidate}`,
      );
      if (availabilityResponse.status !== 200) continue;
      const availability = bookingAvailabilitySchema.parse(await availabilityResponse.json());
      availableSlot = availability.slots[0]?.startAtUtc;
    }
    expect(availableSlot).toBeTruthy();

    const bookingRequest = (key: string) => exports.default.fetch(new Request(
      'https://api.example.test/api/studios/studio-a/bookings',
      {
        method: 'POST',
        headers: { Cookie: artistCookie ?? '', 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({ serviceId: createdService.id, startAtUtc: availableSlot }),
      },
    ));
    const bookingKeys = ['booking-test-key-0001', 'booking-test-key-0002'];
    const concurrent = await Promise.all(bookingKeys.map(bookingRequest));
    expect(concurrent.map((response) => response.status).sort()).toEqual([201, 409]);
    const winnerIndex = concurrent.findIndex((response) => response.status === 201);
    const booking = bookingSchema.parse(await concurrent[winnerIndex]!.json());

    const toStudioLocalInput = (iso: string) => {
      const parts = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Zagreb', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }).formatToParts(new Date(iso));
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
    };
    const blockBody = {
      startLocal: toStudioLocalInput(booking.startAtUtc),
      endLocal: toStudioLocalInput(booking.endAtUtc),
      reason: 'Održavanje studija',
    };
    const conflictingBlock = await exports.default.fetch(new Request(
      'https://api.example.test/api/studios/studio-a/blocked-slots',
      {
        method: 'POST',
        headers: { Cookie: cookie ?? '', 'Content-Type': 'application/json' },
        body: JSON.stringify(blockBody),
      },
    ));
    expect(conflictingBlock.status).toBe(409);

    const replay = await bookingRequest(bookingKeys[winnerIndex]!);
    expect(replay.status).toBe(200);
    expect(bookingSchema.parse(await replay.json()).id).toBe(booking.id);

    const listResponse = await exports.default.fetch(new Request(
      'https://api.example.test/api/studios/studio-a/bookings',
      { headers: { Cookie: artistCookie ?? '' } },
    ));
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({ bookings: [{ id: booking.id, status: 'confirmed' }] });

    const cancelResponse = await exports.default.fetch(new Request(
      `https://api.example.test/api/studios/studio-a/bookings/${booking.id}/cancel`,
      { method: 'POST', headers: { Cookie: artistCookie ?? '' } },
    ));
    expect(cancelResponse.status).toBe(200);
    await expect(cancelResponse.json()).resolves.toMatchObject({ id: booking.id, status: 'cancelled' });

    const claims = await env.DB.prepare('SELECT COUNT(*) AS count FROM slot_claims WHERE booking_id = ?1')
      .bind(booking.id).first<{ count: number }>();
    expect(claims?.count).toBe(0);
    const events = await env.DB.prepare('SELECT event_type FROM booking_events WHERE booking_id = ?1 ORDER BY created_at')
      .bind(booking.id).all<{ event_type: string }>();
    expect(events.results.map((event) => event.event_type)).toEqual(['created', 'cancelled']);

    const createBlockResponse = await exports.default.fetch(new Request(
      'https://api.example.test/api/studios/studio-a/blocked-slots',
      {
        method: 'POST',
        headers: { Cookie: cookie ?? '', 'Content-Type': 'application/json' },
        body: JSON.stringify(blockBody),
      },
    ));
    expect(createBlockResponse.status).toBe(201);
    const block = blockedSlotSchema.parse(await createBlockResponse.json());

    const blockedBooking = await bookingRequest('booking-test-key-0003');
    expect(blockedBooking.status).toBe(409);
    const blocksResponse = await exports.default.fetch(new Request(
      'https://api.example.test/api/studios/studio-a/blocked-slots',
      { headers: { Cookie: cookie ?? '' } },
    ));
    expect(blocksResponse.status).toBe(200);
    await expect(blocksResponse.json()).resolves.toMatchObject({ blockedSlots: [{ id: block.id }] });

    const deleteBlockResponse = await exports.default.fetch(new Request(
      `https://api.example.test/api/studios/studio-a/blocked-slots/${block.id}`,
      { method: 'DELETE', headers: { Cookie: cookie ?? '' } },
    ));
    expect(deleteBlockResponse.status).toBe(204);

    const auditCount = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM audit_logs WHERE studio_id = ?1',
    ).bind('studio_a').first<{ count: number }>();
    expect(auditCount?.count).toBe(8);

    const createManagedStudioResponse = await exports.default.fetch(new Request(
      'https://api.example.test/api/platform/studios',
      {
        method: 'POST',
        headers: { Cookie: cookie ?? '', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Managed Studio',
          slug: 'managed-studio',
          ownerEmail: 'managed-owner@example.test',
          timezone: 'Europe/Zagreb',
          currency: 'EUR',
          plan: 'pro',
          expiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString(),
          hostname: 'booking.managed-studio.test',
        }),
      },
    ));
    expect(createManagedStudioResponse.status).toBe(201);
    const managedStudio = platformStudioCreatedSchema.parse(await createManagedStudioResponse.json());
    expect(managedStudio.studio).toMatchObject({ slug: 'managed-studio', ownerEmail: 'managed-owner@example.test' });
    expect(managedStudio.studio.domain).toMatchObject({ hostname: 'booking.managed-studio.test', status: 'pending' });

    const renewedExpiry = new Date(Date.now() + 730 * 86_400_000).toISOString();
    const renewLicenseResponse = await exports.default.fetch(new Request(
      `https://api.example.test/api/platform/studios/${managedStudio.studio.id}/license`,
      {
        method: 'PUT',
        headers: { Cookie: cookie ?? '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'pro', status: 'active', expiresAt: renewedExpiry }),
      },
    ));
    expect(renewLicenseResponse.status).toBe(200);
    await expect(renewLicenseResponse.json()).resolves.toMatchObject({
      id: managedStudio.studio.id,
      license: { plan: 'pro', status: 'active', expiresAt: renewedExpiry },
    });

    const forbiddenPlatformResponse = await exports.default.fetch(new Request(
      'https://api.example.test/api/platform/studios',
      { headers: { Cookie: artistCookie ?? '' } },
    ));
    expect(forbiddenPlatformResponse.status).toBe(403);

    const managedOwnerSignup = await exports.default.fetch(new Request('https://api.example.test/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://api.example.test' },
      body: JSON.stringify({
        name: 'Managed Owner',
        email: 'managed-owner@example.test',
        password: 'managed-owner-correct-password',
      }),
    }));
    expect(managedOwnerSignup.status).toBe(200);
    const managedOwnerCookie = managedOwnerSignup.headers.get('set-cookie')?.split(';', 1)[0];
    const acceptInvitationResponse = await exports.default.fetch(new Request(
      'https://api.example.test/api/invitations/accept',
      {
        method: 'POST',
        headers: { Cookie: managedOwnerCookie ?? '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: managedStudio.invitationToken }),
      },
    ));
    expect(acceptInvitationResponse.status).toBe(200);
    await expect(acceptInvitationResponse.json()).resolves.toEqual({ studioSlug: 'managed-studio', role: 'owner' });

    const managedViewerResponse = await exports.default.fetch(new Request(
      'https://api.example.test/api/studios/managed-studio/viewer-context',
      { headers: { Cookie: managedOwnerCookie ?? '' } },
    ));
    expect(managedViewerResponse.status).toBe(200);
    await expect(managedViewerResponse.json()).resolves.toMatchObject({ membership: { role: 'owner' } });
  });
});
