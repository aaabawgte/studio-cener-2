import { healthResponseSchema, type ApiErrorBody } from '@studio/contracts';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { createAuth, type AuthBindings } from './auth';
import {
  cancelBooking,
  createArtistMembership,
  createBlockedSlot,
  createBooking,
  deleteBlockedSlot,
  getBookingAvailability,
  listBlockedSlots,
  listBookings,
} from './bookings/routes';
import { BookingCoordinator } from './durable-objects/booking-coordinator';
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
app.get('/api/studios/:slug/bookings', listBookings);
app.post('/api/studios/:slug/bookings/:bookingId/cancel', cancelBooking);
app.get('/api/studios/:slug/blocked-slots', listBlockedSlots);
app.post('/api/studios/:slug/blocked-slots', createBlockedSlot);
app.delete('/api/studios/:slug/blocked-slots/:blockId', deleteBlockedSlot);
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

export { BookingCoordinator };
export default app;
