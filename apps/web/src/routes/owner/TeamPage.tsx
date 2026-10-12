import type { TeamMember, TeamMemberWrite } from '@studio/contracts';
import { Alert, Badge, Button, Card, CardFooter, EmptyState, Field, Input, PageHeader, Select, Textarea, useForm, useToast } from '@studio/ui';
import { useState } from 'react';
import { useOutletContext } from 'react-router';
import { createTeamMember, fetchTeamMembers, updateTeamMember, uploadContentImage } from '../../features/content/content-api';
import type { StudioViewerContext } from '../../features/studio/types';
import { useAsync } from '../../lib/useAsync';
import { usePageTitle } from '../../lib/usePageTitle';
import { ImageUpload } from './ImageUpload';

export function TeamPage() {
  usePageTitle('Tim');
  const ctx = useOutletContext<StudioViewerContext>();
  const result = useAsync((signal) => fetchTeamMembers(ctx.studio.slug, signal), [ctx.studio.slug]);
  const [selected, setSelected] = useState<TeamMember | null>(null);
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageHeader title="Tim" description="Uredite profile ljudi koji se prikazuju na javnoj stranici." actions={<Button onClick={() => { setSelected(null); setCreating(true); }}>Novi član</Button>} />
      {creating || selected ? <TeamForm key={selected?.id ?? 'new'} slug={ctx.studio.slug} member={selected} onCancel={() => { setSelected(null); setCreating(false); }} onSaved={() => { setSelected(null); setCreating(false); result.reload(); }} /> : null}
      {result.status === 'error' ? <Alert tone="danger" className="mb-5">Tim nije moguće učitati.</Alert> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {result.data?.teamMembers.map((member) => (
          <button key={member.id} type="button" className="text-left" onClick={() => { setCreating(false); setSelected(member); }}>
            <Card className="h-full transition-transform hover:-translate-y-0.5">
              <div className="flex gap-4">
                <div className="size-20 shrink-0 overflow-hidden rounded-card bg-sunken">{member.imageUrl ? <img src={member.imageUrl} alt="" className="size-full object-cover" /> : null}</div>
                <div className="min-w-0"><h2 className="text-lg">{member.name}</h2><p className="text-sm text-ink-muted">{member.roleTitle}</p><Badge className="mt-3" tone={member.status === 'active' ? 'success' : 'neutral'}>{member.status === 'active' ? 'Javno' : 'Skriveno'}</Badge></div>
              </div>
            </Card>
          </button>
        ))}
      </div>
      {result.status === 'success' && !result.data?.teamMembers.length ? <Card padded={false}><EmptyState icon="team" title="Tim je prazan" description="Dodajte prvi javni profil člana tima." /></Card> : null}
    </>
  );
}

function TeamForm({ slug, member, onCancel, onSaved }: { slug: string; member: TeamMember | null; onCancel: () => void; onSaved: () => void }) {
  const toast = useToast();
  const form = useForm<{ name: string; roleTitle: string; bio: string; status: 'active' | 'hidden'; sortOrder: string }>({
    initialValues: { name: member?.name ?? '', roleTitle: member?.roleTitle ?? '', bio: member?.bio ?? '', status: member?.status ?? 'active', sortOrder: String(member?.sortOrder ?? 0) },
    validate: (values) => ({ ...(values.name.trim().length < 2 ? { name: 'Unesite ime.' } : {}), ...(values.roleTitle.trim().length < 2 ? { roleTitle: 'Unesite ulogu.' } : {}) }),
    onSubmit: async (values) => {
      const input: TeamMemberWrite = { name: values.name.trim(), roleTitle: values.roleTitle.trim(), bio: values.bio.trim() || null, status: values.status, sortOrder: Number(values.sortOrder) || 0 };
      if (member) await updateTeamMember(slug, member.id, input); else await createTeamMember(slug, input);
      toast.success(member ? 'Profil je spremljen.' : 'Član tima je dodan.'); onSaved();
    },
  });
  return <Card className="mb-6 animate-rise-in"><h2 className="mb-5 text-xl">{member ? 'Uredi člana tima' : 'Novi član tima'}</h2>{form.formError ? <Alert tone="danger" className="mb-5">{form.formError}</Alert> : null}<form onSubmit={(event) => void form.handleSubmit(event)}><div className="grid gap-5 lg:grid-cols-[1fr_14rem]"> <div className="grid gap-5 sm:grid-cols-2"><Field label="Ime" required error={form.errorFor('name')}><Input {...form.register('name')} autoFocus /></Field><Field label="Uloga" required error={form.errorFor('roleTitle')}><Input {...form.register('roleTitle')} placeholder="Producent, inženjer…" /></Field><Field label="Biografija" className="sm:col-span-2"><Textarea {...form.register('bio')} rows={4} /></Field><Field label="Vidljivost"><Select {...form.register('status')}><option value="active">Javno</option><option value="hidden">Skriveno</option></Select></Field><Field label="Redoslijed"><Input {...form.register('sortOrder')} type="number" min={0} /></Field></div>{member ? <ImageUpload imageUrl={member.imageUrl} label="Promijeni fotografiju" onUpload={async (file) => { await uploadContentImage(slug, 'team-members', member.id, file); toast.success('Fotografija je spremljena.'); onSaved(); }} /> : <p className="text-sm text-ink-subtle">Fotografiju možete dodati nakon spremanja profila.</p>}</div><CardFooter><Button variant="ghost" onClick={onCancel}>Odustani</Button><Button type="submit" loading={form.submitting}>Spremi profil</Button></CardFooter></form></Card>;
}
