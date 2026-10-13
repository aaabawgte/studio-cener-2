import { artistValueAccountSchema, blockedSlotSchema, bookingAvailabilitySchema, bookingDetailSchema, bookingListResponseSchema, bookingSchema, healthResponseSchema, hourPackageSchema, managerInvitationCreatedSchema, notificationSchema, platformStudioCreatedSchema, portfolioProjectSchema, promoCodeSchema, promoQuoteSchema, serviceSchema, studioAccessSchema, studioAnalyticsSchema, studioOverviewSchema, teamMemberSchema, waitlistEntrySchema } from '@studio/contracts';
import { env, exports } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import identityMigration from '../../../db/migrations/0001_identity_and_tenancy.sql?raw';
import catalogMigration from '../../../db/migrations/0002_studio_catalog.sql?raw';
import bookingMigration from '../../../db/migrations/0003_booking_engine.sql?raw';
import platformMigration from '../../../db/migrations/0004_platform_onboarding.sql?raw';
import contentMigration from '../../../db/migrations/0005_studio_content.sql?raw';
import accessMigration from '../../../db/migrations/0006_studio_access_management.sql?raw';
import valueMigration from '../../../db/migrations/0007_value_ledger.sql?raw';
import promoMigration from '../../../db/migrations/0008_promo_codes.sql?raw';
import waitlistMigration from '../../../db/migrations/0009_waitlist_notifications.sql?raw';
import bookingNotesMigration from '../../../db/migrations/0010_booking_notes.sql?raw';
import bookingRescheduleMigration from '../../../db/migrations/0011_booking_rescheduled_events.sql?raw';
import bookingListIndexesMigration from '../../../db/migrations/0012_booking_list_indexes.sql?raw';
import bookingValueUsageMigration from '../../../db/migrations/0013_booking_value_usage.sql?raw';

beforeAll(async () => {
  const sql = `${identityMigration}\n${catalogMigration}\n${bookingMigration}\n${platformMigration}\n${contentMigration}\n${accessMigration}\n${valueMigration}\n${promoMigration}\n${waitlistMigration}\n${bookingNotesMigration}\n${bookingRescheduleMigration}\n${bookingListIndexesMigration}\n${bookingValueUsageMigration}`;
  const triggers = sql.match(/CREATE TRIGGER[\s\S]*?END;/g) ?? [];
  const statements = sql.replace(/CREATE TRIGGER[\s\S]*?END;/g, '')
    .split(';').map((statement) => statement.trim()).filter(Boolean).map((statement) => env.DB.prepare(statement));
  await env.DB.batch(statements);
  for (const trigger of triggers) await env.DB.prepare(trigger).run();
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

  it('initializes the value coordinator', async () => {
    await expect(env.VALUE_COORDINATOR.getByName('studio:value-user').health()).resolves.toEqual({ status: 'ok', schemaVersion: 1 });
  });

  it('keeps package minutes and prepaid credit auditable and non-negative', async () => {
    const signup = async (email: string, name: string) => {
      const response = await exports.default.fetch(new Request('https://api.example.test/api/auth/sign-up/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://api.example.test' },
        body: JSON.stringify({ name, email, password: 'correct-horse-value-password' }),
      }));
      expect(response.status).toBe(200);
      const user = await env.DB.prepare('SELECT id FROM user WHERE email=?1').bind(email).first<{ id: string }>();
      return { cookie: response.headers.get('set-cookie')?.split(';', 1)[0] ?? '', userId: user!.id };
    };
    const owner = await signup('value-owner@example.test', 'Value Owner');
    const artist = await signup('value-artist@example.test', 'Value Artist');
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO studios (id,slug,name,timezone,currency,status,created_at,updated_at) VALUES ('value_studio','value-studio','Value Studio','Europe/Zagreb','EUR','active',?1,?1)`).bind(now),
      env.DB.prepare(`INSERT INTO memberships (id,studio_id,user_id,role,status,created_at,updated_at) VALUES ('value_owner_membership','value_studio',?1,'owner','active',?2,?2)`).bind(owner.userId, now),
      env.DB.prepare(`INSERT INTO memberships (id,studio_id,user_id,role,status,created_at,updated_at) VALUES ('value_artist_membership','value_studio',?1,'artist','active',?2,?2)`).bind(artist.userId, now),
      env.DB.prepare(`INSERT INTO studio_licenses (id,studio_id,plan,status,starts_at,expires_at,grace_ends_at,created_at,updated_at) VALUES ('value_license','value_studio','pro','active',?1,?2,NULL,?1,?1)`).bind(now, now + 31_536_000_000),
      env.DB.prepare(`INSERT INTO bookable_resources (id,studio_id,name,status,sort_order,created_at,updated_at) VALUES ('value_resource','value_studio','Studio A','active',0,?1,?1)`).bind(now),
      env.DB.prepare(`INSERT INTO services (id,studio_id,name,description,duration_minutes,price_minor,currency,status,sort_order,created_at,updated_at) VALUES ('value_service','value_studio','Snimanje',NULL,60,5000,'EUR','active',0,?1,?1)`).bind(now),
      ...Array.from({ length: 7 }, (_, weekday) => env.DB.prepare(`INSERT INTO availability_rules (id,studio_id,resource_id,weekday,start_minute,end_minute,created_at,updated_at) VALUES (?1,'value_studio','value_resource',?2,600,1080,?3,?3)`).bind(`value_rule_${weekday}`, weekday, now)),
    ]);
    const ownerRequest = (path: string, body: unknown, key?: string) => exports.default.fetch(new Request(`https://api.example.test${path}`, {
      method: 'POST', headers: { Cookie: owner.cookie, 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, body: JSON.stringify(body),
    }));
    const packageResponse = await ownerRequest('/api/studios/value-studio/hour-packages', { name: 'Paket 10 sati', includedMinutes: 600, priceMinor: 50000, validityDays: 365 });
    expect(packageResponse.status).toBe(201);
    const pkg = hourPackageSchema.parse(await packageResponse.json());
    const grantBody = { userId: artist.userId, packageId: pkg.id, reason: 'Plaćeno u studiju' };
    const grant = await ownerRequest('/api/studios/value-studio/value/package-grants', grantBody, 'value-grant-key-0001');
    expect(grant.status).toBe(201);
    const granted = artistValueAccountSchema.parse(await grant.json());
    expect(granted.packageBalances[0]?.remainingMinutes).toBe(600);
    const replay = await ownerRequest('/api/studios/value-studio/value/package-grants', grantBody, 'value-grant-key-0001');
    expect(replay.status).toBe(200);
    expect(artistValueAccountSchema.parse(await replay.json()).packageBalances).toHaveLength(1);

    const balanceId = granted.packageBalances[0]!.id;
    const consume = (key: string) => ownerRequest(`/api/studios/value-studio/value/package-balances/${balanceId}/entries`, { amountMinutes: -450, kind: 'use', reason: 'Termin' }, key);
    const consumed = await Promise.all([consume('package-use-key-0001'), consume('package-use-key-0002')]);
    expect(consumed.map((response) => response.status).sort()).toEqual([201, 409]);

    const creditGrant = await ownerRequest('/api/studios/value-studio/value/credit-entries', { userId: artist.userId, amountMinor: 10000, kind: 'grant', reason: 'Uplata gotovine' }, 'credit-grant-key-0001');
    expect(creditGrant.status).toBe(201);
    expect(artistValueAccountSchema.parse(await creditGrant.json()).creditBalanceMinor).toBe(10000);
    const overspend = await ownerRequest('/api/studios/value-studio/value/credit-entries', { userId: artist.userId, amountMinor: -11000, kind: 'use', reason: 'Preskupi termin' }, 'credit-use-key-0001');
    expect(overspend.status).toBe(409);

    const own = await exports.default.fetch(new Request('https://api.example.test/api/studios/value-studio/value/me', { headers: { Cookie: artist.cookie } }));
    expect(own.status).toBe(200);
    expect(artistValueAccountSchema.parse(await own.json())).toMatchObject({ artist: { userId: artist.userId }, creditBalanceMinor: 10000 });

    const future = new Date(Date.now() + 7 * 86_400_000);
    const dateParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zagreb', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(future);
    const dateMap = Object.fromEntries(dateParts.map((part) => [part.type, part.value]));
    const date = `${dateMap.year}-${dateMap.month}-${dateMap.day}`;
    const availabilityResponse = await exports.default.fetch(`https://api.example.test/api/public/studios/value-studio/booking-availability?serviceId=value_service&date=${date}`);
    const availability = bookingAvailabilitySchema.parse(await availabilityResponse.json());
    const slot = availability.slots[0]!;
    const artistBookingRequest = (body: unknown, key: string) => exports.default.fetch(new Request('https://api.example.test/api/studios/value-studio/bookings', {
      method: 'POST', headers: { Cookie: artist.cookie, 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body),
    }));

    const creditBookingResponse = await artistBookingRequest({ serviceId: 'value_service', startAtUtc: slot.startAtUtc, paymentMethod: 'credit' }, 'credit-booking-key-0001');
    expect(creditBookingResponse.status).toBe(201);
    const creditBooking = bookingSchema.parse(await creditBookingResponse.json());
    expect(creditBooking).toMatchObject({ paymentMethod: 'credit', creditAmountMinor: 5000, packageMinutes: 0 });
    const afterCreditUse = await exports.default.fetch(new Request('https://api.example.test/api/studios/value-studio/value/me', { headers: { Cookie: artist.cookie } }));
    expect(artistValueAccountSchema.parse(await afterCreditUse.json()).creditBalanceMinor).toBe(5000);
    const cancelCredit = () => exports.default.fetch(new Request(`https://api.example.test/api/studios/value-studio/bookings/${creditBooking.id}/cancel`, { method: 'POST', headers: { Cookie: artist.cookie } }));
    expect((await cancelCredit()).status).toBe(200);
    expect((await cancelCredit()).status).toBe(200);
    const afterCreditRefund = await exports.default.fetch(new Request('https://api.example.test/api/studios/value-studio/value/me', { headers: { Cookie: artist.cookie } }));
    expect(artistValueAccountSchema.parse(await afterCreditRefund.json()).creditBalanceMinor).toBe(10000);

    const packageBookingResponse = await artistBookingRequest({ serviceId: 'value_service', startAtUtc: slot.startAtUtc, paymentMethod: 'package', packageBalanceId: balanceId }, 'package-booking-key-0001');
    expect(packageBookingResponse.status).toBe(201);
    const packageBooking = bookingSchema.parse(await packageBookingResponse.json());
    expect(packageBooking).toMatchObject({ paymentMethod: 'package', packageBalanceId: balanceId, packageMinutes: 60, creditAmountMinor: 0 });
    const afterPackageUse = await exports.default.fetch(new Request('https://api.example.test/api/studios/value-studio/value/me', { headers: { Cookie: artist.cookie } }));
    expect(artistValueAccountSchema.parse(await afterPackageUse.json()).packageBalances[0]?.remainingMinutes).toBe(90);
    const cancelPackage = await exports.default.fetch(new Request(`https://api.example.test/api/studios/value-studio/bookings/${packageBooking.id}/cancel`, { method: 'POST', headers: { Cookie: artist.cookie } }));
    expect(cancelPackage.status).toBe(200);
    const afterPackageRefund = await exports.default.fetch(new Request('https://api.example.test/api/studios/value-studio/value/me', { headers: { Cookie: artist.cookie } }));
    expect(artistValueAccountSchema.parse(await afterPackageRefund.json()).packageBalances[0]?.remainingMinutes).toBe(150);
    const bookingLedger = await env.DB.prepare(`SELECT kind,COUNT(*) AS total FROM credit_ledger WHERE studio_id='value_studio' AND booking_id=?1 GROUP BY kind ORDER BY kind`).bind(creditBooking.id).all();
    expect(bookingLedger.results).toEqual([{ kind: 'refund', total: 1 }, { kind: 'use', total: 1 }]);
    await expect(env.DB.prepare('UPDATE credit_ledger SET reason=?1 WHERE studio_id=?2').bind('Promijenjeno', 'value_studio').run()).rejects.toThrow(/append-only/);
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

    const settingsResponse = await exports.default.fetch(new Request(
      'https://api.example.test/api/studios/studio-a/settings',
      {
        method: 'PUT',
        headers: { Cookie: cookie ?? '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Studio A', description: 'Snimanje i produkcija u Zagrebu.', address: 'Zagreb', accentColor: '#76543b' }),
      },
    ));
    expect(settingsResponse.status).toBe(200);
    await expect(settingsResponse.json()).resolves.toMatchObject({ description: 'Snimanje i produkcija u Zagrebu.', branding: { accentColor: '#76543b' } });

    const createTeam = async (name: string, status: 'active' | 'hidden') => {
      const response = await exports.default.fetch(new Request('https://api.example.test/api/studios/studio-a/team-members', {
        method: 'POST', headers: { Cookie: cookie ?? '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, roleTitle: 'Producent', bio: 'Radi s artistima.', status, sortOrder: 0 }),
      }));
      expect(response.status).toBe(201);
      return teamMemberSchema.parse(await response.json());
    };
    const publicMember = await createTeam('Javni Producent', 'active');
    await createTeam('Skriveni Producent', 'hidden');

    const createProject = async (title: string, status: 'draft' | 'published') => {
      const response = await exports.default.fetch(new Request('https://api.example.test/api/studios/studio-a/portfolio-projects', {
        method: 'POST', headers: { Cookie: cookie ?? '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, artistName: 'Artist A', description: 'Projekt studija.', status, sortOrder: 0 }),
      }));
      expect(response.status).toBe(201);
      return portfolioProjectSchema.parse(await response.json());
    };
    await createProject('Objavljeni projekt', 'published');
    await createProject('Skica projekta', 'draft');

    const imageForm = new FormData();
    imageForm.set('file', new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], 'profile.png', { type: 'image/png' }));
    const imageUploadResponse = await exports.default.fetch(new Request(
      `https://api.example.test/api/studios/studio-a/team-members/${publicMember.id}/image`,
      { method: 'POST', headers: { Cookie: cookie ?? '' }, body: imageForm },
    ));
    expect(imageUploadResponse.status).toBe(200);
    const uploadedImage = await imageUploadResponse.json<{ imageUrl: string }>();
    const publicImageResponse = await exports.default.fetch(uploadedImage.imageUrl);
    expect(publicImageResponse.status).toBe(200);
    expect(publicImageResponse.headers.get('content-type')).toBe('image/png');

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
      teamMembers: [{ name: 'Javni Producent', status: 'active' }],
      portfolioProjects: [{ title: 'Objavljeni projekt', status: 'published' }],
    });

    const crossTenantCatalogResponse = await exports.default.fetch(new Request(
      'https://api.example.test/api/studios/studio-b/services',
      { headers: { Cookie: cookie ?? '' } },
    ));
    expect(crossTenantCatalogResponse.status).toBe(403);

    await env.DB.prepare('UPDATE studio_licenses SET max_managers = 1 WHERE studio_id = ?1').bind('studio_a').run();
    const managerInviteResponse = await exports.default.fetch(new Request(
      'https://api.example.test/api/studios/studio-a/manager-invitations',
      {
        method: 'POST',
        headers: { Cookie: cookie ?? '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'manager@example.test', teamMemberId: publicMember.id }),
      },
    ));
    expect(managerInviteResponse.status).toBe(201);
    const managerInvite = managerInvitationCreatedSchema.parse(await managerInviteResponse.json());

    const managerSignup = await exports.default.fetch(new Request('https://api.example.test/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://api.example.test' },
      body: JSON.stringify({ name: 'Studio Manager', email: 'manager@example.test', password: 'manager-correct-horse-password' }),
    }));
    expect(managerSignup.status).toBe(200);
    const managerCookie = managerSignup.headers.get('set-cookie')?.split(';', 1)[0];
    const acceptManager = await exports.default.fetch(new Request('https://api.example.test/api/invitations/accept', {
      method: 'POST',
      headers: { Cookie: managerCookie ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: managerInvite.invitationToken }),
    }));
    expect(acceptManager.status).toBe(200);
    await expect(acceptManager.json()).resolves.toEqual({ studioSlug: 'studio-a', role: 'manager' });

    const managerViewer = await exports.default.fetch(new Request('https://api.example.test/api/studios/studio-a/viewer-context', { headers: { Cookie: managerCookie ?? '' } }));
    expect(managerViewer.status).toBe(200);
    await expect(managerViewer.json()).resolves.toMatchObject({ membership: { role: 'manager' } });
    const managerSettings = await exports.default.fetch(new Request('https://api.example.test/api/studios/studio-a/settings', { headers: { Cookie: managerCookie ?? '' } }));
    expect(managerSettings.status).toBe(403);
    const managerTeam = await exports.default.fetch(new Request('https://api.example.test/api/studios/studio-a/team-members', { headers: { Cookie: managerCookie ?? '' } }));
    expect(managerTeam.status).toBe(200);

    const managerLimitResponse = await exports.default.fetch(new Request(
      'https://api.example.test/api/studios/studio-a/manager-invitations',
      {
        method: 'POST',
        headers: { Cookie: cookie ?? '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'second-manager@example.test' }),
      },
    ));
    expect(managerLimitResponse.status).toBe(409);
    await expect(managerLimitResponse.json()).resolves.toMatchObject({ code: 'MANAGER_LIMIT_REACHED' });

    const accessResponse = await exports.default.fetch(new Request('https://api.example.test/api/studios/studio-a/access', { headers: { Cookie: cookie ?? '' } }));
    expect(accessResponse.status).toBe(200);
    const studioAccess = studioAccessSchema.parse(await accessResponse.json());
    const managerMembership = studioAccess.members.find((member) => member.role === 'manager');
    expect(managerMembership).toMatchObject({ email: 'manager@example.test', teamMemberId: publicMember.id });
    const revokeManager = await exports.default.fetch(new Request(
      `https://api.example.test/api/studios/studio-a/memberships/${managerMembership?.membershipId ?? ''}`,
      { method: 'DELETE', headers: { Cookie: cookie ?? '' } },
    ));
    expect(revokeManager.status).toBe(204);
    const revokedManagerViewer = await exports.default.fetch(new Request('https://api.example.test/api/studios/studio-a/viewer-context', { headers: { Cookie: managerCookie ?? '' } }));
    expect(revokedManagerViewer.status).toBe(403);
    const teamLink = await env.DB.prepare('SELECT user_id FROM team_members WHERE id = ?1').bind(publicMember.id).first<{ user_id: string | null }>();
    expect(teamLink?.user_id).toBeNull();

    const reInviteResponse = await exports.default.fetch(new Request('https://api.example.test/api/studios/studio-a/manager-invitations', {
      method: 'POST', headers: { Cookie: cookie ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'manager@example.test', teamMemberId: publicMember.id }),
    }));
    expect(reInviteResponse.status).toBe(201);
    const reInvite = managerInvitationCreatedSchema.parse(await reInviteResponse.json());
    const reAccept = await exports.default.fetch(new Request('https://api.example.test/api/invitations/accept', {
      method: 'POST', headers: { Cookie: managerCookie ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: reInvite.invitationToken }),
    }));
    expect(reAccept.status).toBe(200);

    await env.DB.prepare('UPDATE studio_licenses SET max_managers = 2 WHERE studio_id = ?1').bind('studio_a').run();
    const pendingInviteResponse = await exports.default.fetch(new Request('https://api.example.test/api/studios/studio-a/manager-invitations', {
      method: 'POST', headers: { Cookie: cookie ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pending-manager@example.test' }),
    }));
    expect(pendingInviteResponse.status).toBe(201);
    const pendingInvite = managerInvitationCreatedSchema.parse(await pendingInviteResponse.json());
    const revokeInviteResponse = await exports.default.fetch(new Request(
      `https://api.example.test/api/studios/studio-a/manager-invitations/${pendingInvite.invitation.id}`,
      { method: 'DELETE', headers: { Cookie: cookie ?? '' } },
    ));
    expect(revokeInviteResponse.status).toBe(204);

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

    const createPromoResponse = await exports.default.fetch(new Request('https://api.example.test/api/studios/studio-a/promo-codes', {
      method: 'POST', headers: { Cookie: cookie ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'WELCOME20', description: 'Popust dobrodošlice', discountType: 'percentage', discountValue: 20,
        minimumSpendMinor: 5000, validFrom: new Date(Date.now() - 60_000).toISOString(), validUntil: new Date(Date.now() + 86_400_000).toISOString(),
        maxRedemptions: 1, maxRedemptionsPerUser: 1 }),
    }));
    expect(createPromoResponse.status).toBe(201);
    expect(promoCodeSchema.parse(await createPromoResponse.json())).toMatchObject({ code: 'WELCOME20', redemptionCount: 0 });
    const quoteResponse = await exports.default.fetch(new Request('https://api.example.test/api/studios/studio-a/promo-codes/validate', {
      method: 'POST', headers: { Cookie: artistCookie ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: createdService.id, code: 'welcome20' }),
    }));
    expect(quoteResponse.status).toBe(200);
    expect(promoQuoteSchema.parse(await quoteResponse.json())).toMatchObject({ discountMinor: 2000, totalPriceMinor: 8000 });

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
        body: JSON.stringify({ serviceId: createdService.id, startAtUtc: availableSlot, promoCode: 'WELCOME20' }),
      },
    ));
    const bookingKeys = ['booking-test-key-0001', 'booking-test-key-0002'];
    const concurrent = await Promise.all(bookingKeys.map(bookingRequest));
    expect(concurrent.map((response) => response.status).sort()).toEqual([201, 409]);
    const winnerIndex = concurrent.findIndex((response) => response.status === 201);
    const booking = bookingSchema.parse(await concurrent[winnerIndex]!.json());
    expect(booking).toMatchObject({ subtotalPriceMinor: 10000, discountMinor: 2000, priceMinor: 8000, promoCode: 'WELCOME20' });

    const waitingSignup = await exports.default.fetch(new Request('https://api.example.test/api/auth/sign-up/email', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://api.example.test' },
      body: JSON.stringify({ name: 'Waiting Artist', email: 'waiting@example.test', password: 'waiting-correct-horse-password' }),
    }));
    expect(waitingSignup.status).toBe(200);
    const waitingCookie = waitingSignup.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
    const waitingJoin = await exports.default.fetch(new Request('https://api.example.test/api/studios/studio-a/artist-membership', { method: 'POST', headers: { Cookie: waitingCookie } }));
    expect(waitingJoin.status).toBe(200);

    const toStudioLocalInput = (iso: string) => {
      const parts = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Zagreb', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }).formatToParts(new Date(iso));
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
    };
    const desiredDate = toStudioLocalInput(booking.startAtUtc).slice(0, 10);
    const waitlistResponse = await exports.default.fetch(new Request('https://api.example.test/api/studios/studio-a/waitlist', {
      method: 'POST', headers: { Cookie: waitingCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: createdService.id, desiredDate }),
    }));
    expect(waitlistResponse.status).toBe(201);
    expect(waitlistEntrySchema.parse(await waitlistResponse.json())).toMatchObject({ desiredDate, status: 'active', notificationCount: 0 });
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
    const redemption = await env.DB.prepare('SELECT status FROM promo_redemptions WHERE booking_id=?1').bind(booking.id).first<{ status: string }>();
    expect(redemption?.status).toBe('reversed');
    const waitingNotifications = await exports.default.fetch(new Request('https://api.example.test/api/studios/studio-a/notifications', { headers: { Cookie: waitingCookie } }));
    expect(waitingNotifications.status).toBe(200);
    const notificationBody = await waitingNotifications.json<{ notifications: unknown[] }>();
    expect(notificationSchema.parse(notificationBody.notifications[0])).toMatchObject({ type: 'waitlist_slot_available', readAt: null });
    const waitingEntries = await exports.default.fetch(new Request('https://api.example.test/api/studios/studio-a/waitlist/me', { headers: { Cookie: waitingCookie } }));
    expect(waitingEntries.status).toBe(200);
    await expect(waitingEntries.json()).resolves.toMatchObject({ waitlistEntries: [{ status: 'notified', notificationCount: 1 }] });
    const analyticsResponse = await exports.default.fetch(new Request('https://api.example.test/api/studios/studio-a/analytics?range=30d', { headers: { Cookie: cookie ?? '' } }));
    expect(analyticsResponse.status).toBe(200);
    expect(studioAnalyticsSchema.parse(await analyticsResponse.json())).toMatchObject({ range: '30d', currency: 'EUR', timezone: 'Europe/Zagreb' });
    const overviewResponse = await exports.default.fetch(new Request('https://api.example.test/api/studios/studio-a/overview', { headers: { Cookie: cookie ?? '' } }));
    expect(overviewResponse.status).toBe(200);
    expect(studioOverviewSchema.parse(await overviewResponse.json())).toMatchObject({ currency: 'EUR', timezone: 'Europe/Zagreb', attention: { hasActiveServices: true, hasAvailabilityRules: true } });

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

    const artistUser = await env.DB.prepare('SELECT id FROM user WHERE email=?1').bind('artist@example.test').first<{ id: string }>();
    const managedBookingResponse = await exports.default.fetch(new Request('https://api.example.test/api/studios/studio-a/bookings/managed', {
      method: 'POST', headers: { Cookie: cookie ?? '', 'Content-Type': 'application/json', 'Idempotency-Key': 'managed-booking-key-0001' },
      body: JSON.stringify({ artistUserId: artistUser!.id, serviceId: createdService.id, startAtUtc: availableSlot }),
    }));
    expect(managedBookingResponse.status).toBe(201);
    const managedBooking = bookingSchema.parse(await managedBookingResponse.json());
    expect(managedBooking.artistUserId).toBe(artistUser!.id);
    const managedEvent = await env.DB.prepare('SELECT actor_user_id FROM booking_events WHERE booking_id=?1 AND event_type=\'created\'')
      .bind(managedBooking.id).first<{ actor_user_id: string }>();
    expect(managedEvent?.actor_user_id).toBe(user.id);

    const rescheduleDate = toStudioLocalInput(managedBooking.startAtUtc).slice(0, 10);
    const artistRescheduleAvailability = await exports.default.fetch(new Request(
      `https://api.example.test/api/studios/studio-a/bookings/${managedBooking.id}/reschedule-availability?date=${rescheduleDate}`,
      { headers: { Cookie: artistCookie ?? '' } },
    ));
    expect(artistRescheduleAvailability.status).toBe(403);
    const rescheduleAvailabilityResponse = await exports.default.fetch(new Request(
      `https://api.example.test/api/studios/studio-a/bookings/${managedBooking.id}/reschedule-availability?date=${rescheduleDate}`,
      { headers: { Cookie: cookie ?? '' } },
    ));
    expect(rescheduleAvailabilityResponse.status).toBe(200);
    const rescheduleAvailability = bookingAvailabilitySchema.parse(await rescheduleAvailabilityResponse.json());
    const rescheduledStart = rescheduleAvailability.slots.find((slot) => slot.startAtUtc !== managedBooking.startAtUtc)?.startAtUtc;
    expect(rescheduledStart).toBeTruthy();
    const artistReschedule = await exports.default.fetch(new Request(
      `https://api.example.test/api/studios/studio-a/bookings/${managedBooking.id}/reschedule`,
      { method: 'POST', headers: { Cookie: artistCookie ?? '', 'Content-Type': 'application/json' }, body: JSON.stringify({ startAtUtc: rescheduledStart }) },
    ));
    expect(artistReschedule.status).toBe(403);
    const rescheduleResponse = await exports.default.fetch(new Request(
      `https://api.example.test/api/studios/studio-a/bookings/${managedBooking.id}/reschedule`,
      { method: 'POST', headers: { Cookie: cookie ?? '', 'Content-Type': 'application/json' }, body: JSON.stringify({ startAtUtc: rescheduledStart }) },
    ));
    expect(rescheduleResponse.status).toBe(200);
    expect(bookingSchema.parse(await rescheduleResponse.json()).startAtUtc).toBe(rescheduledStart);
    const oldClaim = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM slot_claims WHERE booking_id=?1 AND slot_start_utc=?2',
    ).bind(managedBooking.id, new Date(managedBooking.startAtUtc).getTime()).first<{ count: number }>();
    const newClaims = await env.DB.prepare('SELECT COUNT(*) AS count FROM slot_claims WHERE booking_id=?1')
      .bind(managedBooking.id).first<{ count: number }>();
    expect(oldClaim?.count).toBe(0);
    expect(newClaims?.count).toBe(managedBooking.durationMinutes / 15);
    const rescheduleReplay = await exports.default.fetch(new Request(
      `https://api.example.test/api/studios/studio-a/bookings/${managedBooking.id}/reschedule`,
      { method: 'POST', headers: { Cookie: cookie ?? '', 'Content-Type': 'application/json' }, body: JSON.stringify({ startAtUtc: rescheduledStart }) },
    ));
    expect(rescheduleReplay.status).toBe(200);
    const rescheduleEvent = await env.DB.prepare(
      'SELECT actor_user_id,COUNT(*) OVER () AS event_count FROM booking_events WHERE booking_id=?1 AND event_type=\'rescheduled\'',
    ).bind(managedBooking.id).first<{ actor_user_id: string; event_count: number }>();
    expect(rescheduleEvent?.actor_user_id).toBe(user.id);
    expect(rescheduleEvent?.event_count).toBe(1);
    const artistNotificationsResponse = await exports.default.fetch(new Request(
      'https://api.example.test/api/studios/studio-a/notifications', { headers: { Cookie: artistCookie ?? '' } },
    ));
    expect(artistNotificationsResponse.status).toBe(200);
    const artistNotifications = await artistNotificationsResponse.json<{ notifications: unknown[] }>();
    expect(notificationSchema.parse(artistNotifications.notifications[0])).toMatchObject({ type: 'booking_rescheduled', entityId: managedBooking.id });

    const earlyCompletionResponse = await exports.default.fetch(new Request(
      `https://api.example.test/api/studios/studio-a/bookings/${managedBooking.id}/status`,
      { method: 'POST', headers: { Cookie: cookie ?? '', 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'completed' }) },
    ));
    expect(earlyCompletionResponse.status).toBe(409);

    const artistStatusResponse = await exports.default.fetch(new Request(
      `https://api.example.test/api/studios/studio-a/bookings/${managedBooking.id}/status`,
      { method: 'POST', headers: { Cookie: artistCookie ?? '', 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'no_show' }) },
    ));
    expect(artistStatusResponse.status).toBe(403);

    const pastStart = Date.now() - 120 * 60_000;
    const pastEnd = Date.now() - 60 * 60_000;
    await env.DB.prepare('UPDATE bookings SET start_at_utc=?1,end_at_utc=?2 WHERE id=?3')
      .bind(pastStart, pastEnd, managedBooking.id).run();
    const completionResponse = await exports.default.fetch(new Request(
      `https://api.example.test/api/studios/studio-a/bookings/${managedBooking.id}/status`,
      { method: 'POST', headers: { Cookie: cookie ?? '', 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'completed' }) },
    ));
    expect(completionResponse.status).toBe(200);
    expect(bookingSchema.parse(await completionResponse.json()).status).toBe('completed');
    const completionEvent = await env.DB.prepare(
      'SELECT actor_user_id FROM booking_events WHERE booking_id=?1 AND event_type=\'completed\'',
    ).bind(managedBooking.id).first<{ actor_user_id: string }>();
    expect(completionEvent?.actor_user_id).toBe(user.id);

    const artistDetailResponse = await exports.default.fetch(new Request(
      `https://api.example.test/api/studios/studio-a/bookings/${managedBooking.id}`,
      { headers: { Cookie: artistCookie ?? '' } },
    ));
    expect(artistDetailResponse.status).toBe(403);
    const noteResponse = await exports.default.fetch(new Request(
      `https://api.example.test/api/studios/studio-a/bookings/${managedBooking.id}/notes`,
      { method: 'POST', headers: { Cookie: cookie ?? '', 'Content-Type': 'application/json' }, body: JSON.stringify({ body: 'Artist preferira tiši monitoring.' }) },
    ));
    expect(noteResponse.status).toBe(201);
    const detailResponse = await exports.default.fetch(new Request(
      `https://api.example.test/api/studios/studio-a/bookings/${managedBooking.id}`,
      { headers: { Cookie: cookie ?? '' } },
    ));
    expect(detailResponse.status).toBe(200);
    const detail = bookingDetailSchema.parse(await detailResponse.json());
    expect(detail.booking.id).toBe(managedBooking.id);
    expect(detail.timeline).toHaveLength(4);
    expect(detail.timeline.map((entry) => entry.kind === 'event' ? entry.eventType : entry.body))
      .toEqual(expect.arrayContaining(['created', 'rescheduled', 'completed', 'Artist preferira tiši monitoring.']));
    await expect(env.DB.prepare('UPDATE booking_notes SET body=?1 WHERE booking_id=?2')
      .bind('Promijenjeno', managedBooking.id).run()).rejects.toThrow(/append-only/);

    const auditCount = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM audit_logs WHERE studio_id = ?1',
    ).bind('studio_a').first<{ count: number }>();
    expect(auditCount?.count).toBe(28);

    const filteredBookingsResponse = await exports.default.fetch(new Request(
      'https://api.example.test/api/studios/studio-a/bookings?status=completed&search=Studio%20Artist',
      { headers: { Cookie: cookie ?? '' } },
    ));
    expect(filteredBookingsResponse.status).toBe(200);
    expect(bookingListResponseSchema.parse(await filteredBookingsResponse.json()).bookings.map((item) => item.id))
      .toContain(managedBooking.id);
    const invalidCursorResponse = await exports.default.fetch(new Request(
      'https://api.example.test/api/studios/studio-a/bookings?cursor=not-a-cursor',
      { headers: { Cookie: cookie ?? '' } },
    ));
    expect(invalidCursorResponse.status).toBe(422);

    const fixtureNow = Date.now();
    await env.DB.batch(Array.from({ length: 26 }, (_, index) => env.DB.prepare(
      `INSERT INTO bookings
       (id,studio_id,resource_id,artist_user_id,service_id,start_at_utc,end_at_utc,status,
        service_name_snapshot,duration_minutes_snapshot,price_minor_snapshot,subtotal_price_minor_snapshot,
        discount_minor_snapshot,promo_code_id,promo_code_snapshot,currency_snapshot,idempotency_key,request_fingerprint,
        version,created_at,updated_at)
       VALUES (?1,'studio_a',?2,?3,?4,?5,?6,'completed',?7,?8,?9,?10,?11,NULL,NULL,?12,?13,?14,1,?15,?15)`,
    ).bind(`pagination_booking_${index}`, managedBooking.resourceId, managedBooking.artistUserId, managedBooking.serviceId,
      fixtureNow - (index + 10) * 86_400_000, fixtureNow - (index + 10) * 86_400_000 + managedBooking.durationMinutes * 60_000,
      managedBooking.serviceName, managedBooking.durationMinutes, managedBooking.priceMinor, managedBooking.subtotalPriceMinor,
      managedBooking.discountMinor, managedBooking.currency, `pagination-key-${index}`, `pagination-fingerprint-${index}`, fixtureNow)));
    const firstPageResponse = await exports.default.fetch(new Request(
      'https://api.example.test/api/studios/studio-a/bookings?status=completed', { headers: { Cookie: cookie ?? '' } },
    ));
    const firstPage = bookingListResponseSchema.parse(await firstPageResponse.json());
    expect(firstPage.bookings).toHaveLength(25);
    expect(firstPage.nextCursor).toBeTruthy();
    const secondPageResponse = await exports.default.fetch(new Request(
      `https://api.example.test/api/studios/studio-a/bookings?status=completed&cursor=${encodeURIComponent(firstPage.nextCursor!)}`,
      { headers: { Cookie: cookie ?? '' } },
    ));
    const secondPage = bookingListResponseSchema.parse(await secondPageResponse.json());
    expect(secondPage.bookings.length).toBeGreaterThan(0);
    expect(secondPage.bookings.some((item) => firstPage.bookings.some((first) => first.id === item.id))).toBe(false);

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
