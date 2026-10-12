import type { ApiErrorBody, StudioPermission, StudioRole } from '@studio/contracts';
import { studioRoleSchema } from '@studio/contracts';
import type { AuthBindings } from '../auth';
import { createAuth } from '../auth';
import { permissionsForRole } from './permissions';

export type StudioAccess = {
  studio: {
    id: string;
    slug: string;
    name: string;
    timezone: string;
    currency: string;
  };
  actor: { userId: string; role: StudioRole };
};

type AccessFailure = { status: 401 | 403 | 404; body: ApiErrorBody };
type AccessResult = { ok: true; value: StudioAccess } | { ok: false; error: AccessFailure };

type AccessRow = StudioAccess['studio'] & { membership_role: string | null };

export async function resolveStudioAccess(
  env: AuthBindings,
  request: Request,
  slug: string,
  permission?: StudioPermission,
): Promise<AccessResult> {
  const session = await createAuth(env).api.getSession({ headers: request.headers });
  if (!session) {
    return { ok: false, error: { status: 401, body: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } } };
  }

  const row = await env.DB.prepare(
    `SELECT s.id, s.slug, s.name, s.timezone, s.currency, m.role AS membership_role
     FROM studios s
     LEFT JOIN memberships m
       ON m.studio_id = s.id AND m.user_id = ?1 AND m.status = 'active'
     WHERE s.slug = ?2 COLLATE NOCASE AND s.status = 'active'
     LIMIT 1`,
  ).bind(session.user.id, slug.trim().toLowerCase()).first<AccessRow>();

  if (!row) {
    return { ok: false, error: { status: 404, body: { code: 'STUDIO_NOT_FOUND', message: 'Studio not found.' } } };
  }
  if (!row.membership_role) {
    return { ok: false, error: { status: 403, body: { code: 'MEMBERSHIP_REQUIRED', message: 'Studio membership required.' } } };
  }

  const role = studioRoleSchema.parse(row.membership_role);
  if (permission && !permissionsForRole(role).includes(permission)) {
    return { ok: false, error: { status: 403, body: { code: 'FORBIDDEN', message: 'Permission denied.' } } };
  }

  return {
    ok: true,
    value: {
      studio: { id: row.id, slug: row.slug, name: row.name, timezone: row.timezone, currency: row.currency },
      actor: { userId: session.user.id, role },
    },
  };
}
