import type { Service, ServiceWrite } from '@studio/contracts';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardFooter,
  DataList,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
  useForm,
  useToast,
  type DataColumn,
} from '@studio/ui';
import { useState } from 'react';
import { useOutletContext } from 'react-router';
import { createService, fetchServices, updateService } from '../../features/catalog/catalog-api';
import type { StudioViewerContext } from '../../features/studio/types';
import { useAsync } from '../../lib/useAsync';
import { usePageTitle } from '../../lib/usePageTitle';

function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat('hr-HR', { style: 'currency', currency }).format(amountMinor / 100);
}

const columns: DataColumn<Service>[] = [
  { id: 'name', header: 'Usluga', primary: true, cell: (service) => service.name },
  { id: 'duration', header: 'Trajanje', cell: (service) => `${service.durationMinutes} min` },
  { id: 'price', header: 'Cijena', align: 'end', cell: (service) => formatMoney(service.priceMinor, service.currency) },
  { id: 'status', header: 'Status', cell: (service) => <Badge tone={service.status === 'active' ? 'success' : 'neutral'}>{service.status === 'active' ? 'Aktivna' : 'Arhivirana'}</Badge> },
];

export function ServicesPage() {
  usePageTitle('Usluge');
  const ctx = useOutletContext<StudioViewerContext>();
  const result = useAsync((signal) => fetchServices(ctx.studio.slug, signal), [ctx.studio.slug]);
  const [selected, setSelected] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);
  const showForm = creating || selected !== null;

  return (
    <>
      <PageHeader
        title="Usluge"
        description="Trajanje i cijena ovdje postaju izvor za buduće rezervacije."
        actions={<Button onClick={() => { setSelected(null); setCreating(true); }}>Nova usluga</Button>}
      />
      {showForm ? (
        <ServiceForm
          key={selected?.id ?? 'new'}
          slug={ctx.studio.slug}
          service={selected}
          onCancel={() => { setSelected(null); setCreating(false); }}
          onSaved={() => { setSelected(null); setCreating(false); result.reload(); }}
        />
      ) : null}
      {result.status === 'error' ? <Alert tone="danger" title="Usluge nije moguće učitati" className="mb-5">Pokušajte osvježiti stranicu.</Alert> : null}
      <DataList
        caption="Usluge studija"
        columns={columns}
        rows={result.data?.services}
        loading={result.status === 'loading'}
        getRowKey={(service) => service.id}
        onRowClick={(service) => { setCreating(false); setSelected(service); }}
        rowActionLabel={(service) => `Uredi uslugu ${service.name}`}
        empty={<Card padded={false}><EmptyState size="compact" icon="services" title="Još nema usluga" description="Dodajte prvu uslugu koju će studio nuditi." /></Card>}
      />
    </>
  );
}

type FormValues = { name: string; description: string; durationMinutes: string; price: string; status: 'active' | 'archived' };

function ServiceForm({ slug, service, onCancel, onSaved }: { slug: string; service: Service | null; onCancel: () => void; onSaved: () => void }) {
  const toast = useToast();
  const form = useForm<FormValues>({
    initialValues: {
      name: service?.name ?? '',
      description: service?.description ?? '',
      durationMinutes: String(service?.durationMinutes ?? 60),
      price: service ? (service.priceMinor / 100).toFixed(2) : '',
      status: service?.status ?? 'active',
    },
    validate: (values) => {
      const errors: Partial<Record<keyof FormValues, string>> = {};
      if (values.name.trim().length < 2) errors.name = 'Unesite naziv usluge.';
      const duration = Number(values.durationMinutes);
      if (!Number.isInteger(duration) || duration < 15 || duration > 720 || duration % 15 !== 0) errors.durationMinutes = 'Koristite korake od 15 minuta.';
      const price = Number(values.price.replace(',', '.'));
      if (!Number.isFinite(price) || price < 0) errors.price = 'Unesite valjanu cijenu.';
      return errors;
    },
    onSubmit: async (values) => {
      const input: ServiceWrite = {
        name: values.name.trim(),
        description: values.description.trim() || null,
        durationMinutes: Number(values.durationMinutes),
        priceMinor: Math.round(Number(values.price.replace(',', '.')) * 100),
        status: values.status,
      };
      if (service) await updateService(slug, service.id, input);
      else await createService(slug, input);
      toast.success(service ? 'Usluga je spremljena.' : 'Usluga je dodana.');
      onSaved();
    },
  });

  return (
    <Card className="mb-6 animate-rise-in">
      <h2 className="mb-5 text-xl">{service ? 'Uredi uslugu' : 'Nova usluga'}</h2>
      {form.formError ? <Alert tone="danger" className="mb-5">{form.formError}</Alert> : null}
      <form onSubmit={(event) => void form.handleSubmit(event)}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Naziv" required error={form.errorFor('name')} className="sm:col-span-2"><Input {...form.register('name')} autoFocus /></Field>
          <Field label="Opis" error={form.errorFor('description')} className="sm:col-span-2"><Textarea {...form.register('description')} rows={3} /></Field>
          <Field label="Trajanje" required error={form.errorFor('durationMinutes')} hint="U minutama, u koracima od 15."><Input {...form.register('durationMinutes')} type="number" min={15} max={720} step={15} /></Field>
          <Field label="Cijena" required error={form.errorFor('price')} hint="Iznos u valuti studija."><Input {...form.register('price')} inputMode="decimal" placeholder="90,00" /></Field>
          {service ? <Field label="Status"><Select {...form.register('status')}><option value="active">Aktivna</option><option value="archived">Arhivirana</option></Select></Field> : null}
        </div>
        <CardFooter>
          <Button variant="ghost" onClick={onCancel}>Odustani</Button>
          <Button type="submit" loading={form.submitting}>Spremi uslugu</Button>
        </CardFooter>
      </form>
    </Card>
  );
}
