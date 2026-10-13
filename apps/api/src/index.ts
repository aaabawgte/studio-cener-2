import { healthResponseSchema, type ApiErrorBody } from '@studio/contracts';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { createAuth, type AuthBindings } from './auth';
import {
  cancelBooking,
  createBookingNote,
  createArtistMembership,
  createBlockedSlot,
  createBooking,
  createManagedBooking,
  deleteBlockedSlot,
  getBookingAvailability,
  getBookingDetail,
  listBlockedSlots,
  listBookings,
  listBookingArtists,
  updateBookingStatus,
} from './bookings/routes';
import { BookingCoordinator } from './durable-objects/booking-coordinator';
import { ValueCoordinator } from './durable-objects/value-coordinator';
import { acceptStudioInvitation, createPlatformStudio, listPlatformStudios, updateStudioLicense } from './platform/routes';
import {
  createService,
  getPublicStudio,
  listAvailabilityRules,
  listServices,
  replaceAvailabilityRules,
  updateService,
} from './studios/catalog';
import { getStudioViewerContext } from './studios/viewer-context';
import { createManagerInvitation, listStudioAccess, revokeManagerAccess, revokeManagerInvitation } from './studios/access';
import {
  createPortfolioProject,
  createTeamMember,
  getPublicLogo,
  getPublicPortfolioImage,
  getPublicTeamImage,
  getStudioSettings,
  listPortfolioProjects,
  listTeamMembers,
  updatePortfolioProject,
  updateStudioSettings,
  updateTeamMember,
  uploadStudioImage,
} from './studios/content';
import {
  createCreditEntry,
  createHourPackage,
  createPackageEntry,
  getManagedValueAccount,
  getOwnValueAccount,
  grantPackage,
  listHourPackages,
  listValueArtists,
  updateHourPackage,
} from './value/routes';
import { createPromoCode, listPromoCodes, updatePromoCode, validatePromoCode } from './promos/routes';
import { cancelWaitlistEntry, createWaitlistEntry, listOwnWaitlist, listStudioWaitlist } from './waitlist/routes';
import { listNotifications, markNotificationRead } from './notifications/routes';
import { getStudioAnalytics } from './analytics/routes';
import { getStudioOverview } from './overview/routes';

type AppEnvironment = {
  Bindings: AuthBindings;
  Variables: { requestId: string };
};

const app = new Hono<AppEnvironment>();

app.use('*', secureHeaders());
app.use('/api/*', cors({
  origin: (origin, context) => {
    const allowed = (context.env as AuthBindings).TRUSTED_ORIGINS.split(',').map((value) => value.trim());
    return allowed.includes(origin) ? origin : null;
  },
  allowHeaders: ['Content-Type', 'X-Request-Id', 'Idempotency-Key'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['X-Request-Id'],
  credentials: true,
  maxAge: 600,
}));
app.use('*', async (context, next) => {
  const requestId = context.req.header('X-Request-Id') ?? crypto.randomUUID();
  context.set('requestId', requestId);
  await next();
  context.header('X-Request-Id', requestId);
});

app.get('/api/health', async (context) => {
  const database = await context.env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
  if (database?.ok !== 1) {
    return context.json<ApiErrorBody>({ code: 'DATABASE_UNAVAILABLE', message: 'Service unavailable.' }, 503);
  }

  const payload = healthResponseSchema.parse({
    status: 'ok',
    service: 'studio-cener-api',
    environment: context.env.ENVIRONMENT,
    checks: { database: 'ok' },
  });
  return context.json(payload);
});

app.all('/api/auth/*', (context) => createAuth(context.env).handler(context.req.raw));

app.get('/api/studios/:slug/viewer-context', getStudioViewerContext);
app.get('/api/public/studios/:slug', getPublicStudio);
app.get('/api/public/studios/:slug/logo', getPublicLogo);
app.get('/api/public/studios/:slug/team-members/:memberId/image', getPublicTeamImage);
app.get('/api/public/studios/:slug/portfolio-projects/:projectId/image', getPublicPortfolioImage);
app.get('/api/studios/:slug/settings', getStudioSettings);
app.put('/api/studios/:slug/settings', updateStudioSettings);
app.post('/api/studios/:slug/logo', (context) => uploadStudioImage(context, 'logo'));
app.get('/api/studios/:slug/access', listStudioAccess);
app.post('/api/studios/:slug/manager-invitations', createManagerInvitation);
app.delete('/api/studios/:slug/manager-invitations/:invitationId', revokeManagerInvitation);
app.delete('/api/studios/:slug/memberships/:membershipId', revokeManagerAccess);
app.get('/api/studios/:slug/team-members', listTeamMembers);
app.post('/api/studios/:slug/team-members', createTeamMember);
app.put('/api/studios/:slug/team-members/:memberId', updateTeamMember);
app.post('/api/studios/:slug/team-members/:memberId/image', (context) => uploadStudioImage(context, 'team'));
app.get('/api/studios/:slug/portfolio-projects', listPortfolioProjects);
app.post('/api/studios/:slug/portfolio-projects', createPortfolioProject);
app.put('/api/studios/:slug/portfolio-projects/:projectId', updatePortfolioProject);
app.post('/api/studios/:slug/portfolio-projects/:projectId/image', (context) => uploadStudioImage(context, 'portfolio'));
app.get('/api/studios/:slug/services', listServices);
app.post('/api/studios/:slug/services', createService);
app.put('/api/studios/:slug/services/:serviceId', updateService);
app.get('/api/studios/:slug/availability-rules', listAvailabilityRules);
app.put('/api/studios/:slug/availability-rules', replaceAvailabilityRules);
app.get('/api/public/studios/:slug/booking-availability', getBookingAvailability);
app.post('/api/studios/:slug/artist-membership', createArtistMembership);
app.post('/api/studios/:slug/bookings', createBooking);
app.post('/api/studios/:slug/bookings/managed', createManagedBooking);
app.get('/api/studios/:slug/bookings', listBookings);
app.get('/api/studios/:slug/booking-artists', listBookingArtists);
app.get('/api/studios/:slug/bookings/:bookingId', getBookingDetail);
app.post('/api/studios/:slug/bookings/:bookingId/notes', createBookingNote);
app.post('/api/studios/:slug/bookings/:bookingId/cancel', cancelBooking);
app.post('/api/studios/:slug/bookings/:bookingId/status', updateBookingStatus);
app.get('/api/studios/:slug/blocked-slots', listBlockedSlots);
app.post('/api/studios/:slug/blocked-slots', createBlockedSlot);
app.delete('/api/studios/:slug/blocked-slots/:blockId', deleteBlockedSlot);
app.get('/api/studios/:slug/hour-packages', listHourPackages);
app.post('/api/studios/:slug/hour-packages', createHourPackage);
app.put('/api/studios/:slug/hour-packages/:packageId', updateHourPackage);
app.get('/api/studios/:slug/value/artists', listValueArtists);
app.get('/api/studios/:slug/value/accounts/:userId', getManagedValueAccount);
app.get('/api/studios/:slug/value/me', getOwnValueAccount);
app.post('/api/studios/:slug/value/package-grants', grantPackage);
app.post('/api/studios/:slug/value/package-balances/:balanceId/entries', createPackageEntry);
app.post('/api/studios/:slug/value/credit-entries', createCreditEntry);
app.get('/api/studios/:slug/promo-codes', listPromoCodes);
app.post('/api/studios/:slug/promo-codes', createPromoCode);
app.put('/api/studios/:slug/promo-codes/:promoId', updatePromoCode);
app.post('/api/studios/:slug/promo-codes/validate', validatePromoCode);
app.get('/api/studios/:slug/waitlist', listStudioWaitlist);
app.get('/api/studios/:slug/waitlist/me', listOwnWaitlist);
app.post('/api/studios/:slug/waitlist', createWaitlistEntry);
app.delete('/api/studios/:slug/waitlist/:entryId', cancelWaitlistEntry);
app.get('/api/studios/:slug/notifications', listNotifications);
app.patch('/api/studios/:slug/notifications/:notificationId/read', markNotificationRead);
app.get('/api/studios/:slug/analytics', getStudioAnalytics);
app.get('/api/studios/:slug/overview', getStudioOverview);
app.get('/api/platform/studios', listPlatformStudios);
app.post('/api/platform/studios', createPlatformStudio);
app.put('/api/platform/studios/:studioId/license', updateStudioLicense);
app.post('/api/invitations/accept', acceptStudioInvitation);

app.notFound((context) => context.json<ApiErrorBody>({ code: 'NOT_FOUND', message: 'Resource not found.' }, 404));

app.onError((error, context) => {
  console.error(JSON.stringify({
    level: 'error',
    message: 'Unhandled request error',
    requestId: context.get('requestId'),
    method: context.req.method,
    path: context.req.path,
    error: error instanceof Error ? error.message : String(error),
  }));
  return context.json<ApiErrorBody>({ code: 'INTERNAL_ERROR', message: 'Internal server error.' }, 500);
});

export { BookingCoordinator, ValueCoordinator };
export default app;
