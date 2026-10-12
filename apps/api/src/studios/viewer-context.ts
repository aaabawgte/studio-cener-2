import { studioRoleSchema, studioViewerContextSchema, type ApiErrorBody } from '@studio/contracts';
import type { Context } from 'hono';
import type { AuthBindings } from '../auth';
import { createAuth } from '../auth';
import { permissionsForRole } from '../authorization/permissions';

type ViewerContextEnvironment = {
  Bindings: AuthBindings;
  Variables: { requestId: string };
};

type ViewerContextRow = {
  studio_id: string;
  studio_slug: string;
  studio_name: string;
  studio_timezone: string;
  studio_currency: string;
  studio_accent_color: string | null;
  studio_logo_r2_key: string | null;
  membership_role: string;
};

export async function getStudioViewerContext(
  context: Context<ViewerContextEnvironment, '/api/studios/:slug/viewer-context'>,
) {
  const auth = createAuth(context.env);
  const session = await auth.api.getSession({ headers: context.req.raw.headers });

  if (!session) {
    return context.json<ApiErrorBody>({ code: 'UNAUTHENTICATED', message: 'Authentication required.' }, 401);
  }

  const slug = context.req.param('slug').trim().toLowerCase();
  const studio = await context.env.DB.prepare(
    `SELECT
       s.id AS studio_id,
       s.slug AS studio_slug,
       s.name AS studio_name,
       s.timezone AS studio_timezone,
       s.currency AS studio_currency,
       s.accent_color AS studio_accent_color,
       s.logo_r2_key AS studio_logo_r2_key,
       m.role AS membership_role
     FROM studios s
     LEFT JOIN memberships m
       ON m.studio_id = s.id
      AND m.user_id = ?1
      AND m.status = 'active'
     WHERE s.slug = ?2 COLLATE NOCASE
       AND s.status = 'active'
     LIMIT 1`,
  )
    .bind(session.user.id, slug)
    .first<ViewerContextRow>();

  if (!studio) {
    return context.json<ApiErrorBody>({ code: 'STUDIO_NOT_FOUND', message: 'Studio not found.' }, 404);
  }

  if (!studio.membership_role) {
    return context.json<ApiErrorBody>({ code: 'MEMBERSHIP_REQUIRED', message: 'Studio membership required.' }, 403);
  }

  const role = studioRoleSchema.parse(studio.membership_role);
  const logoUrl = studio.studio_logo_r2_key
    ? new URL(`/api/public/studios/${encodeURIComponent(studio.studio_slug)}/logo`, context.req.url).toString()
    : null;

  return context.json(studioViewerContextSchema.parse({
    studio: {
      id: studio.studio_id,
      slug: studio.studio_slug,
      name: studio.studio_name,
      timezone: studio.studio_timezone,
      currency: studio.studio_currency,
      branding: { accentColor: studio.studio_accent_color, logoUrl },
    },
    viewer: {
      userId: session.user.id,
      name: session.user.name,
      email: session.user.email,
      avatarUrl: session.user.image ?? null,
    },
    membership: { role, permissions: permissionsForRole(role) },
  }));
}
