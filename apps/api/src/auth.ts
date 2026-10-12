import { betterAuth } from 'better-auth';

export type AuthBindings = Env & {
  BETTER_AUTH_SECRET: string;
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
    trustedOrigins: configuredOrigins,
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
