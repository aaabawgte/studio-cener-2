import { healthResponseSchema, type ApiErrorBody } from '@studio/contracts';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { BookingCoordinator } from './durable-objects/booking-coordinator';

type AppEnvironment = {
  Bindings: Env;
  Variables: { requestId: string };
};

const app = new Hono<AppEnvironment>();

app.use('*', secureHeaders());
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
