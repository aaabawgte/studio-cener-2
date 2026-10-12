import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          BETTER_AUTH_SECRET: 'test-only-secret-with-at-least-thirty-two-characters',
          AUTH_BASE_URL: 'https://api.example.test',
          TRUSTED_ORIGINS: 'https://api.example.test',
        },
      },
    }),
  ],
});
