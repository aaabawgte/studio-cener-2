import type { PortfolioProject, PortfolioProjectWrite, StudioSettings, StudioSettingsWrite, TeamMember, TeamMemberWrite } from '@studio/contracts';

let settings: StudioSettings = {
  id: 'studio-demo', slug: 'demo', name: 'Studio Cener Demo', timezone: 'Europe/Zagreb', currency: 'EUR',
  description: 'Premium recording prostor za vokale, produkciju i mix.', address: 'Zagreb, Hrvatska',
  branding: { accentColor: '#76543b', logoUrl: null },
};
let teamMembers: TeamMember[] = [
  { id: 'team-1', name: 'Luka Horvat', roleTitle: 'Producent i mix inženjer', bio: 'Vodi session od prve ideje do završnog miksa.', imageUrl: null, status: 'active', sortOrder: 0 },
];
let portfolioProjects: PortfolioProject[] = [
  { id: 'project-1', title: 'Noćni grad', artistName: 'Mia', description: 'Produkcija, snimanje vokala i mix.', imageUrl: null, status: 'published', sortOrder: 0 },
];

function wait(signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, 150);
    signal?.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });
}

export async function mockStudioSettings(signal?: AbortSignal) { await wait(signal); return structuredClone(settings); }
export async function mockSaveStudioSettings(input: StudioSettingsWrite) {
  await wait();
  settings = { ...settings, ...input, branding: { ...settings.branding, accentColor: input.accentColor } };
  return structuredClone(settings);
}
export async function mockTeamMembers(signal?: AbortSignal) { await wait(signal); return { teamMembers: structuredClone(teamMembers) }; }
export async function mockCreateTeamMember(input: TeamMemberWrite) {
  await wait();
  const value: TeamMember = { ...input, id: crypto.randomUUID(), imageUrl: null, bio: input.bio ?? null, status: input.status ?? 'active', sortOrder: input.sortOrder ?? teamMembers.length };
  teamMembers = [...teamMembers, value];
  return structuredClone(value);
}
export async function mockUpdateTeamMember(id: string, input: TeamMemberWrite) {
  await wait();
  const current = teamMembers.find((item) => item.id === id);
  if (!current) throw new Error('Član tima nije pronađen.');
  const value = { ...current, ...input };
  teamMembers = teamMembers.map((item) => item.id === id ? value : item);
  return structuredClone(value);
}
export async function mockPortfolioProjects(signal?: AbortSignal) { await wait(signal); return { portfolioProjects: structuredClone(portfolioProjects) }; }
export async function mockCreatePortfolioProject(input: PortfolioProjectWrite) {
  await wait();
  const value: PortfolioProject = { ...input, id: crypto.randomUUID(), imageUrl: null, description: input.description ?? null, status: input.status ?? 'draft', sortOrder: input.sortOrder ?? portfolioProjects.length };
  portfolioProjects = [...portfolioProjects, value];
  return structuredClone(value);
}
export async function mockUpdatePortfolioProject(id: string, input: PortfolioProjectWrite) {
  await wait();
  const current = portfolioProjects.find((item) => item.id === id);
  if (!current) throw new Error('Projekt nije pronađen.');
  const value = { ...current, ...input };
  portfolioProjects = portfolioProjects.map((item) => item.id === id ? value : item);
  return structuredClone(value);
}
export async function mockUploadImage(target: 'logo' | 'team-members' | 'portfolio-projects', id: string | null, file: File) {
  await wait();
  const imageUrl = URL.createObjectURL(file);
  if (target === 'logo') settings = { ...settings, branding: { ...settings.branding, logoUrl: imageUrl } };
  if (target === 'team-members') teamMembers = teamMembers.map((item) => item.id === id ? { ...item, imageUrl } : item);
  if (target === 'portfolio-projects') portfolioProjects = portfolioProjects.map((item) => item.id === id ? { ...item, imageUrl } : item);
  return { imageUrl };
}

export function mockPublicContent() {
  return {
    teamMembers: structuredClone(teamMembers.filter((item) => item.status === 'active')),
    portfolioProjects: structuredClone(portfolioProjects.filter((item) => item.status === 'published')),
  };
}
