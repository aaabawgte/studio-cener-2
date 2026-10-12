import type { PortfolioProject, PortfolioProjectWrite } from '@studio/contracts';
import { Alert, Badge, Button, Card, CardFooter, EmptyState, Field, Input, PageHeader, Select, Textarea, useForm, useToast } from '@studio/ui';
import { useState } from 'react';
import { useOutletContext } from 'react-router';
import { createPortfolioProject, fetchPortfolioProjects, updatePortfolioProject, uploadContentImage } from '../../features/content/content-api';
import type { StudioViewerContext } from '../../features/studio/types';
import { useAsync } from '../../lib/useAsync';
import { usePageTitle } from '../../lib/usePageTitle';
import { ImageUpload } from './ImageUpload';

export function PortfolioPage() {
  usePageTitle('Portfolio');
  const ctx = useOutletContext<StudioViewerContext>();
  const result = useAsync((signal) => fetchPortfolioProjects(ctx.studio.slug, signal), [ctx.studio.slug]);
  const [selected, setSelected] = useState<PortfolioProject | null>(null);
  const [creating, setCreating] = useState(false);
  return <><PageHeader title="Portfolio" description="Objavite projekte koji najbolje predstavljaju studio." actions={<Button onClick={() => { setSelected(null); setCreating(true); }}>Novi projekt</Button>} />{creating || selected ? <ProjectForm key={selected?.id ?? 'new'} slug={ctx.studio.slug} project={selected} onCancel={() => { setSelected(null); setCreating(false); }} onSaved={() => { setSelected(null); setCreating(false); result.reload(); }} /> : null}{result.status === 'error' ? <Alert tone="danger" className="mb-5">Portfolio nije moguće učitati.</Alert> : null}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{result.data?.portfolioProjects.map((project) => <button key={project.id} type="button" className="text-left" onClick={() => { setCreating(false); setSelected(project); }}><Card padded={false} className="h-full overflow-hidden transition-transform hover:-translate-y-0.5"><div className="aspect-[16/10] bg-sunken">{project.imageUrl ? <img src={project.imageUrl} alt="" className="size-full object-cover" /> : null}</div><div className="p-5"><h2 className="text-lg">{project.title}</h2><p className="text-sm text-ink-muted">{project.artistName}</p><Badge className="mt-3" tone={project.status === 'published' ? 'success' : 'neutral'}>{project.status === 'published' ? 'Objavljeno' : 'Skica'}</Badge></div></Card></button>)}</div>{result.status === 'success' && !result.data?.portfolioProjects.length ? <Card padded={false}><EmptyState icon="portfolio" title="Portfolio je prazan" description="Dodajte prvi projekt studija." /></Card> : null}</>;
}

function ProjectForm({ slug, project, onCancel, onSaved }: { slug: string; project: PortfolioProject | null; onCancel: () => void; onSaved: () => void }) {
  const toast = useToast();
  const form = useForm<{ title: string; artistName: string; description: string; status: 'draft' | 'published'; sortOrder: string }>({
    initialValues: { title: project?.title ?? '', artistName: project?.artistName ?? '', description: project?.description ?? '', status: project?.status ?? 'draft', sortOrder: String(project?.sortOrder ?? 0) },
    validate: (values) => ({ ...(values.title.trim().length < 2 ? { title: 'Unesite naziv projekta.' } : {}), ...(values.artistName.trim().length < 2 ? { artistName: 'Unesite ime artista.' } : {}) }),
    onSubmit: async (values) => {
      const input: PortfolioProjectWrite = { title: values.title.trim(), artistName: values.artistName.trim(), description: values.description.trim() || null, status: values.status, sortOrder: Number(values.sortOrder) || 0 };
      if (project) await updatePortfolioProject(slug, project.id, input); else await createPortfolioProject(slug, input);
      toast.success(project ? 'Projekt je spremljen.' : 'Projekt je dodan.'); onSaved();
    },
  });
  return <Card className="mb-6 animate-rise-in"><h2 className="mb-5 text-xl">{project ? 'Uredi projekt' : 'Novi projekt'}</h2>{form.formError ? <Alert tone="danger" className="mb-5">{form.formError}</Alert> : null}<form onSubmit={(event) => void form.handleSubmit(event)}><div className="grid gap-5 lg:grid-cols-[1fr_20rem]"><div className="grid gap-5 sm:grid-cols-2"><Field label="Naziv projekta" required error={form.errorFor('title')}><Input {...form.register('title')} autoFocus /></Field><Field label="Artist" required error={form.errorFor('artistName')}><Input {...form.register('artistName')} /></Field><Field label="Opis" className="sm:col-span-2"><Textarea {...form.register('description')} rows={4} /></Field><Field label="Status"><Select {...form.register('status')}><option value="draft">Skica</option><option value="published">Objavljeno</option></Select></Field><Field label="Redoslijed"><Input {...form.register('sortOrder')} type="number" min={0} /></Field></div>{project ? <ImageUpload ratio="wide" imageUrl={project.imageUrl} label="Promijeni naslovnu sliku" onUpload={async (file) => { await uploadContentImage(slug, 'portfolio-projects', project.id, file); toast.success('Slika projekta je spremljena.'); onSaved(); }} /> : <p className="text-sm text-ink-subtle">Naslovnu sliku možete dodati nakon spremanja projekta.</p>}</div><CardFooter><Button variant="ghost" onClick={onCancel}>Odustani</Button><Button type="submit" loading={form.submitting}>Spremi projekt</Button></CardFooter></form></Card>;
}
