import type { ApiErrorBody } from '@studio/contracts';
import type { MiddlewareHandler } from 'hono';
import type { AuthBindings } from '../auth';

type SecurityEnvironment = {
  Bindings: AuthBindings;
  Variables: { requestId: string };
};

async function hashKey(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function rateLimitedResponse(context: Parameters<MiddlewareHandler<SecurityEnvironment>>[0], scope: 'auth' | 'booking') {
  console.warn(JSON.stringify({
    level: 'warn',
    message: 'Request rate limited',
    requestId: context.get('requestId'),
    scope,
    path: context.req.path,
  }));
  const response = context.json<ApiErrorBody>({
    code: 'RATE_LIMITED',
    message: 'Previše pokušaja. Pričekajte minutu i pokušajte ponovno.',
  }, 429);
  response.headers.set('Retry-After', '60');
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

async function authIdentity(request: Request) {
  let email = '';
  if (request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    try {
      const body: unknown = await request.clone().json();
      if (typeof body === 'object' && body !== null && 'email' in body && typeof body.email === 'string') {
        email = body.email.trim().toLowerCase().slice(0, 320);
      }
    } catch { /* Better Auth returns the validation response. */ }
  }
  const fallback = `${request.headers.get('origin') ?? 'no-origin'}:${request.headers.get('user-agent') ?? 'no-agent'}`;
  return hashKey(email ? `email:${email}` : `fallback:${fallback}`);
}

export const authRateLimit: MiddlewareHandler<SecurityEnvironment> = async (context, next) => {
  const sensitivePath = context.req.path === '/api/auth/sign-in/email' || context.req.path === '/api/auth/sign-up/email';
  if (context.req.method !== 'POST' || !sensitivePath) return next();
  const key = await authIdentity(context.req.raw);
  const { success } = await context.env.AUTH_RATE_LIMITER.limit({ key });
  if (!success) return rateLimitedResponse(context, 'auth');
  if (context.req.path === '/api/auth/sign-up/email') {
    const client = `${context.req.header('CF-Connecting-IP') ?? 'unknown-client'}:${context.req.header('User-Agent') ?? 'unknown-agent'}`;
    const clientKey = await hashKey(`signup-client:${client}`);
    const signupLimit = await context.env.AUTH_RATE_LIMITER.limit({ key: clientKey });
    if (!signupLimit.success) return rateLimitedResponse(context, 'auth');
  }
  await next();
};

export const bookingRateLimit: MiddlewareHandler<SecurityEnvironment> = async (context, next) => {
  const slug = context.req.param('slug') ?? 'unknown-studio';
  const session = context.req.header('Cookie') ?? 'anonymous';
  const key = await hashKey(`studio:${slug}:session:${session}`);
  const { success } = await context.env.BOOKING_RATE_LIMITER.limit({ key });
  if (!success) return rateLimitedResponse(context, 'booking');
  await next();
};
