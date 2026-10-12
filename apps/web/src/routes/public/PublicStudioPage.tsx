import { AsyncState, Badge, buttonStyles, Card, ErrorState } from '@studio/ui';
import { Link, useParams } from 'react-router';
import { fetchPublicStudio } from '../../features/catalog/catalog-api';
import { useStudioAccent } from '../../features/studio/useStudioAccent';
import { ApiError } from '../../lib/api/client';
import { useAsync } from '../../lib/useAsync';
import { usePageTitle } from '../../lib/usePageTitle';

const dayNames = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];

function time(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

export function PublicStudioPage() {
  const { slug = '' } = useParams();
  const result = useAsync((signal) => fetchPublicStudio(slug, signal), [slug]);
  useStudioAccent(result.data?.studio.branding.accentColor);
  usePageTitle(result.data?.studio.name ?? 'Studio');

  return (
    <main className="min-h-dvh bg-canvas">
      <AsyncState
        {...result}
        onRetry={result.reload}
        renderError={(error) => <div className="grid min-h-dvh place-items-center px-4">{
          error instanceof ApiError && error.status === 404
            ? <ErrorState title="Studio nije pronađen" description="Provjerite adresu studija." />
            : <ErrorState onRetry={result.reload} />
        }</div>}
      >
        {(data) => (
          <>
            <section className="border-b border-line px-5 py-20 sm:px-8 sm:py-28">
              <div className="mx-auto max-w-5xl">
                <p className="eyebrow mb-5">Recording studio</p>
                {data.studio.branding.logoUrl ? <img src={data.studio.branding.logoUrl} alt={`${data.studio.name} logo`} className="mb-7 max-h-20 max-w-48 object-contain object-left" /> : null}
                <h1 className="max-w-3xl text-[3.25rem] leading-[0.98] sm:text-[5rem]">{data.studio.name}</h1>
                {data.studio.description ? <p className="mt-7 max-w-2xl text-lg leading-relaxed text-ink-muted">{data.studio.description}</p> : null}
                {data.studio.address ? <p className="mt-5 text-sm text-ink-subtle">{data.studio.address}</p> : null}
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    to={`/registracija?studio=${encodeURIComponent(data.studio.slug)}&next=${encodeURIComponent(`/s/${data.studio.slug}/me/rezerviraj`)}`}
                    className={buttonStyles({ size: 'lg' })}
                  >
                    Rezerviraj termin
                  </Link>
                  <Link
                    to={`/prijava?studio=${encodeURIComponent(data.studio.slug)}&next=${encodeURIComponent(`/s/${data.studio.slug}/me/rezerviraj`)}`}
                    className={buttonStyles({ variant: 'secondary', size: 'lg' })}
                  >
                    Već imam račun
                  </Link>
                </div>
              </div>
            </section>
            <div className="mx-auto grid max-w-5xl gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.5fr_1fr]">
              <section>
                <p className="eyebrow mb-3">Ponuda</p>
                <h2 className="mb-6 text-3xl">Usluge</h2>
                {data.services.length ? (
                  <div className="space-y-3">
                    {data.services.map((service) => (
                      <Card key={service.id} className="flex items-start justify-between gap-5">
                        <div><h3 className="text-lg">{service.name}</h3>{service.description ? <p className="mt-1 text-sm text-ink-subtle">{service.description}</p> : null}<Badge className="mt-3">{service.durationMinutes} min</Badge></div>
                        <p className="shrink-0 font-display text-xl">{new Intl.NumberFormat('hr-HR', { style: 'currency', currency: service.currency }).format(service.priceMinor / 100)}</p>
                      </Card>
                    ))}
                  </div>
                ) : <p className="text-ink-subtle">Ponuda usluga bit će objavljena uskoro.</p>}
              </section>
              <section>
                <p className="eyebrow mb-3">Dostupnost</p>
                <h2 className="mb-6 text-3xl">Radno vrijeme</h2>
                <Card>
                  <dl className="space-y-3 text-sm">
                    {[1, 2, 3, 4, 5, 6, 0].map((weekday) => {
                      const name = dayNames[weekday]!;
                      const rule = data.availabilityRules.find((item) => item.weekday === weekday);
                      return <div key={name} className="flex justify-between gap-4"><dt className="text-ink-muted">{name}</dt><dd className="tabular">{rule ? `${time(rule.startMinute)}–${time(rule.endMinute)}` : 'Zatvoreno'}</dd></div>;
                    })}
                  </dl>
                  <p className="mt-5 border-t border-line pt-4 text-xs text-ink-subtle">Vremenska zona: {data.studio.timezone}</p>
                </Card>
              </section>
            </div>
            {data.teamMembers.length ? (
              <section className="border-t border-line px-5 py-14 sm:px-8 sm:py-20">
                <div className="mx-auto max-w-5xl">
                  <p className="eyebrow mb-3">Ljudi iza zvuka</p>
                  <h2 className="mb-8 text-3xl">Tim</h2>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {data.teamMembers.map((member) => (
                      <Card key={member.id} padded={false} className="overflow-hidden">
                        {member.imageUrl ? <div className="aspect-square bg-sunken"><img src={member.imageUrl} alt={member.name} className="size-full object-cover" /></div> : null}
                        <div className="p-5"><h3 className="text-xl">{member.name}</h3><p className="mt-1 text-sm text-accent-strong">{member.roleTitle}</p>{member.bio ? <p className="mt-4 text-sm leading-relaxed text-ink-subtle">{member.bio}</p> : null}</div>
                      </Card>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}
            {data.portfolioProjects.length ? (
              <section className="border-t border-line bg-surface px-5 py-14 sm:px-8 sm:py-20">
                <div className="mx-auto max-w-5xl">
                  <p className="eyebrow mb-3">Odabrani radovi</p>
                  <h2 className="mb-8 text-3xl">Portfolio</h2>
                  <div className="grid gap-5 sm:grid-cols-2">
                    {data.portfolioProjects.map((project) => (
                      <Card key={project.id} padded={false} className="overflow-hidden">
                        {project.imageUrl ? <div className="aspect-[16/10] bg-sunken"><img src={project.imageUrl} alt={`${project.title} — ${project.artistName}`} className="size-full object-cover" /></div> : null}
                        <div className="p-5"><p className="eyebrow mb-2">{project.artistName}</p><h3 className="text-xl">{project.title}</h3>{project.description ? <p className="mt-3 text-sm leading-relaxed text-ink-subtle">{project.description}</p> : null}</div>
                      </Card>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}
          </>
        )}
      </AsyncState>
    </main>
  );
}
