import type { AvailabilityRule, PublicStudio, Service, ServiceWrite } from '@studio/contracts';

let services: Service[] = [
  { id: 'demo-vocal', name: 'Snimanje vokala', description: 'Snimanje s inženjerom i osnovna priprema sessiona.', durationMinutes: 120, priceMinor: 9000, currency: 'EUR', status: 'active', sortOrder: 0 },
  { id: 'demo-mix', name: 'Mix', description: 'Detaljan balans, obrada i priprema za mastering.', durationMinutes: 180, priceMinor: 15000, currency: 'EUR', status: 'active', sortOrder: 1 },
];

let rules: AvailabilityRule[] = [1, 2, 3, 4, 5].map((weekday) => ({ id: `demo-day-${weekday}`, weekday, startMinute: 600, endMinute: 1080 }));

function wait(signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, 180);
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

export async function mockServices(signal?: AbortSignal) {
  await wait(signal);
  return { services: structuredClone(services) };
}

export async function mockCreateService(input: ServiceWrite) {
  await wait();
  const service: Service = { id: crypto.randomUUID(), currency: 'EUR', description: null, status: 'active', sortOrder: services.length, ...input };
  services = [...services, service];
  return structuredClone(service);
}

export async function mockUpdateService(id: string, input: ServiceWrite) {
  await wait();
  const current = services.find((service) => service.id === id);
  if (!current) throw new Error('Usluga nije pronađena.');
  const service: Service = { ...current, ...input };
  services = services.map((item) => item.id === id ? service : item);
  return structuredClone(service);
}

export async function mockAvailability(signal?: AbortSignal) {
  await wait(signal);
  return { rules: structuredClone(rules), timezone: 'Europe/Zagreb' };
}

export async function mockSaveAvailability(next: Omit<AvailabilityRule, 'id'>[]) {
  await wait();
  rules = next.map((rule) => ({ ...rule, id: crypto.randomUUID() }));
  return { rules: structuredClone(rules), timezone: 'Europe/Zagreb' };
}

export async function mockPublicStudio(slug: string, signal?: AbortSignal): Promise<PublicStudio> {
  await wait(signal);
  const content = (await import('./content')).mockPublicContent();
  return {
    studio: {
      id: `studio-${slug}`,
      slug,
      name: slug === 'demo' ? 'Studio Cener' : slug,
      timezone: 'Europe/Zagreb',
      currency: 'EUR',
      description: 'Mirno mjesto za snimanje, produkciju i završnu obradu glazbe.',
      address: 'Zagreb, Hrvatska',
      branding: { accentColor: '#8b6246', logoUrl: null },
    },
    services: structuredClone(services.filter((service) => service.status === 'active')),
    availabilityRules: structuredClone(rules),
    ...content,
  };
}
