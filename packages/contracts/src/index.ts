import { z } from 'zod';

export const apiErrorSchema = z.object({
  code: z.string().min(1).optional(),
  message: z.string().min(1).optional(),
  fieldErrors: z.record(z.string(), z.string()).optional(),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export const studioRoleSchema = z.enum(['owner', 'manager', 'artist']);
export type StudioRole = z.infer<typeof studioRoleSchema>;

export const studioPermissionSchema = z.enum([
  'bookings.view',
  'bookings.manage',
  'calendar.manage',
  'services.manage',
  'hours.manage',
  'team.manage',
  'portfolio.manage',
  'analytics.view',
  'studio.settings.manage',
]);
export type StudioPermission = z.infer<typeof studioPermissionSchema>;

export const studioSummarySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  timezone: z.string().min(1),
  currency: z.string().regex(/^[A-Z]{3}$/),
  branding: z.object({
    accentColor: z.string().regex(/^#[0-9a-f]{6}$/i).nullable(),
    logoUrl: z.url().nullable(),
  }),
});
export type StudioSummary = z.infer<typeof studioSummarySchema>;

export const viewerSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  email: z.email(),
  avatarUrl: z.url().nullable(),
});
export type Viewer = z.infer<typeof viewerSchema>;

export const studioViewerContextSchema = z.object({
  studio: studioSummarySchema,
  viewer: viewerSchema,
  membership: z.object({
    role: studioRoleSchema,
    permissions: z.array(studioPermissionSchema),
  }),
});
export type StudioViewerContext = z.infer<typeof studioViewerContextSchema>;

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('studio-cener-api'),
  environment: z.string().min(1),
  checks: z.object({ database: z.literal('ok') }),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
