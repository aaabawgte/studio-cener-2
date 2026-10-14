import { betterAuth } from 'better-auth';

export type AuthBindings = Env & {
  BETTER_AUTH_SECRET: string;
  PLATFORM_ADMIN_EMAILS: string;
};

export function createAuth(env: AuthBindings) {
  const configuredOrigins = env.TRUSTED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.AUTH_BASE_URL,
    basePath: '/api/auth',
    trustedOrigins: async (request) => {
      const origin = request?.headers.get('origin');
      if (!origin || configuredOrigins.includes(origin)) return configuredOrigins;
      let hostname: string;
      try {
        const url = new URL(origin);
        if (url.protocol !== 'https:' || url.port) return configuredOrigins;
        hostname = url.hostname.toLowerCase();
      } catch { return configuredOrigins; }
      const domain = await env.DB.prepare(
        `SELECT d.id FROM studio_domains d
         JOIN studios s ON s.id=d.studio_id
         JOIN studio_licenses l ON l.studio_id=d.studio_id
         WHERE d.hostname=?1 COLLATE NOCASE AND d.status='active' AND d.ssl_status='active'
           AND d.is_primary=1 AND s.status='active'
           AND ((l.status IN ('trial','active') AND l.expires_at>?2)
             OR (l.status='grace' AND COALESCE(l.grace_ends_at,l.expires_at)>?2))
         LIMIT 1`,
      ).bind(hostname, Date.now()).first();
      return domain ? [...configuredOrigins, origin] : configuredOrigins;
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
    },
    user: {
      additionalFields: {
        platformRole: {
          type: 'string',
          required: false,
          input: false,
          fieldName: 'platformRole',
        },
      },
    },
    advanced: {
      database: {
        generateId: () => crypto.randomUUID(),
        joins: true,
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
