import type { StudioSettingsWrite } from '@studio/contracts';
import { Alert, Button, Card, CardFooter, Field, Input, LoadingState, PageHeader, Textarea, useForm, useToast } from '@studio/ui';
import { useOutletContext } from 'react-router';
import { fetchStudioSettings, saveStudioSettings, uploadContentImage } from '../../features/content/content-api';
import type { StudioViewerContext } from '../../features/studio/types';
import { useStudioAccent } from '../../features/studio/useStudioAccent';
import { useAsync } from '../../lib/useAsync';
import { usePageTitle } from '../../lib/usePageTitle';
import { ImageUpload } from './ImageUpload';

export function SettingsPage() {
  usePageTitle('Postavke studija');
  const ctx = useOutletContext<StudioViewerContext>();
  const result = useAsync((signal) => fetchStudioSettings(ctx.studio.slug, signal), [ctx.studio.slug]);
  useStudioAccent(result.data?.branding.accentColor);

  return (
    <>
      <PageHeader title="Postavke studija" description="Podaci i izgled koji se prikazuju artistima na javnoj stranici." />
      {result.status === 'loading' && !result.data ? <LoadingState /> : null}
      {result.status === 'error' ? <Alert tone="danger" title="Postavke nije moguće učitati">Osvježite stranicu i pokušajte ponovno.</Alert> : null}
      {result.data ? <SettingsForm key={`${result.data.name}:${result.data.branding.accentColor}`} slug={ctx.studio.slug} settings={result.data} onSaved={result.reload} /> : null}
    </>
  );
}

function SettingsForm({ slug, settings, onSaved }: { slug: string; settings: Awaited<ReturnType<typeof fetchStudioSettings>>; onSaved: () => void }) {
  const toast = useToast();
  const form = useForm<{ name: string; description: string; address: string; accentColor: string }>({
    initialValues: { name: settings.name, description: settings.description ?? '', address: settings.address ?? '', accentColor: settings.branding.accentColor ?? '#76543b' },
    validate: (values) => ({
      ...(values.name.trim().length < 2 ? { name: 'Unesite naziv studija.' } : {}),
      ...(!/^#[0-9a-f]{6}$/i.test(values.accentColor) ? { accentColor: 'Koristite format #76543b.' } : {}),
    }),
    onSubmit: async (values) => {
      const input: StudioSettingsWrite = {
        name: values.name.trim(), description: values.description.trim() || null,
        address: values.address.trim() || null, accentColor: values.accentColor.toLowerCase(),
      };
      await saveStudioSettings(slug, input);
      toast.success('Postavke studija su spremljene.');
      onSaved();
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <Card>
        <h2 className="mb-5 text-xl">Javni podaci</h2>
        {form.formError ? <Alert tone="danger" className="mb-5">{form.formError}</Alert> : null}
        <form onSubmit={(event) => void form.handleSubmit(event)}>
          <div className="grid gap-5">
            <Field label="Naziv studija" required error={form.errorFor('name')}><Input {...form.register('name')} /></Field>
            <Field label="Opis" error={form.errorFor('description')} hint="Kratko predstavite prostor i način rada."><Textarea {...form.register('description')} rows={5} /></Field>
            <Field label="Adresa" error={form.errorFor('address')}><Input {...form.register('address')} /></Field>
            <Field label="Brand boja" required error={form.errorFor('accentColor')} hint="Hex boja, primjer #76543b.">
              <div className="flex gap-3"><input aria-label="Odaberi brand boju" type="color" className="h-11 w-14 rounded-control bg-raised p-1 shadow-hairline" value={form.values.accentColor} onChange={(event) => form.setValue('accentColor', event.target.value)} /><Input {...form.register('accentColor')} /></div>
            </Field>
          </div>
          <CardFooter><Button type="submit" loading={form.submitting}>Spremi postavke</Button></CardFooter>
        </form>
      </Card>
      <Card>
        <h2 className="mb-2 text-xl">Logo</h2>
        <p className="mb-5 text-sm text-ink-subtle">Prikazuje se u navigaciji i na javnoj stranici.</p>
        <ImageUpload
          imageUrl={settings.branding.logoUrl}
          label="Učitaj logo"
          onUpload={async (file) => { await uploadContentImage(slug, 'logo', null, file); toast.success('Logo je spremljen.'); onSaved(); }}
        />
      </Card>
    </div>
  );
}
