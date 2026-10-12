import type {
  PortfolioProject,
  PortfolioProjectWrite,
  StudioSettings,
  StudioSettingsWrite,
  TeamMember,
  TeamMemberWrite,
} from '@studio/contracts';
import { apiFetch } from '../../lib/api/client';
import { USE_MOCKS } from '../../lib/env';

const studioPath = (slug: string) => `/api/studios/${encodeURIComponent(slug)}`;

export async function fetchStudioSettings(slug: string, signal?: AbortSignal) {
  if (USE_MOCKS) return (await import('../../mocks/content')).mockStudioSettings(signal);
  return apiFetch<StudioSettings>(`${studioPath(slug)}/settings`, { signal });
}

export async function saveStudioSettings(slug: string, input: StudioSettingsWrite) {
  if (USE_MOCKS) return (await import('../../mocks/content')).mockSaveStudioSettings(input);
  return apiFetch<StudioSettings>(`${studioPath(slug)}/settings`, { method: 'PUT', body: input });
}

export async function fetchTeamMembers(slug: string, signal?: AbortSignal) {
  if (USE_MOCKS) return (await import('../../mocks/content')).mockTeamMembers(signal);
  return apiFetch<{ teamMembers: TeamMember[] }>(`${studioPath(slug)}/team-members`, { signal });
}

export async function createTeamMember(slug: string, input: TeamMemberWrite) {
  if (USE_MOCKS) return (await import('../../mocks/content')).mockCreateTeamMember(input);
  return apiFetch<TeamMember>(`${studioPath(slug)}/team-members`, { method: 'POST', body: input });
}

export async function updateTeamMember(slug: string, id: string, input: TeamMemberWrite) {
  if (USE_MOCKS) return (await import('../../mocks/content')).mockUpdateTeamMember(id, input);
  return apiFetch<TeamMember>(`${studioPath(slug)}/team-members/${encodeURIComponent(id)}`, { method: 'PUT', body: input });
}

export async function fetchPortfolioProjects(slug: string, signal?: AbortSignal) {
  if (USE_MOCKS) return (await import('../../mocks/content')).mockPortfolioProjects(signal);
  return apiFetch<{ portfolioProjects: PortfolioProject[] }>(`${studioPath(slug)}/portfolio-projects`, { signal });
}

export async function createPortfolioProject(slug: string, input: PortfolioProjectWrite) {
  if (USE_MOCKS) return (await import('../../mocks/content')).mockCreatePortfolioProject(input);
  return apiFetch<PortfolioProject>(`${studioPath(slug)}/portfolio-projects`, { method: 'POST', body: input });
}

export async function updatePortfolioProject(slug: string, id: string, input: PortfolioProjectWrite) {
  if (USE_MOCKS) return (await import('../../mocks/content')).mockUpdatePortfolioProject(id, input);
  return apiFetch<PortfolioProject>(`${studioPath(slug)}/portfolio-projects/${encodeURIComponent(id)}`, { method: 'PUT', body: input });
}

export async function uploadContentImage(slug: string, target: 'logo' | 'team-members' | 'portfolio-projects', id: string | null, file: File) {
  if (USE_MOCKS) return (await import('../../mocks/content')).mockUploadImage(target, id, file);
  const form = new FormData();
  form.set('file', file);
  const suffix = target === 'logo' ? '/logo' : `/${target}/${encodeURIComponent(id ?? '')}/image`;
  return apiFetch<{ imageUrl: string }>(`${studioPath(slug)}${suffix}`, { method: 'POST', body: form });
}
