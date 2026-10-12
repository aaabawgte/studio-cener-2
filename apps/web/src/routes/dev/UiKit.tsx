/**
 * DEV ONLY — katalog design systema na /_ui. Ne ulazi u produkcijski build.
 * Podaci u ovom fileu su isključivo ilustrativni primjeri komponenti.
 */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  Alert,
  AsyncState,
  Badge,
  Button,
  Card,
  CardFooter,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  DataList,
  Drawer,
  DropdownMenu,
  EmptyState,
  ErrorState,
  Field,
  Icon,
  IconButton,
  iconNames,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  SectionHeader,
  Select,
  Stat,
  Textarea,
  useForm,
  useToast,
  type DataColumn,
} from '@studio/ui';
import { usePageTitle } from '../../lib/usePageTitle';

const swatches: { name: string; token: string; dark?: boolean }[] = [
  { name: 'canvas', token: '--color-canvas' },
  { name: 'surface', token: '--color-surface' },
  { name: 'raised', token: '--color-raised' },
  { name: 'sunken', token: '--color-sunken' },
  { name: 'line', token: '--color-line' },
  { name: 'stone', token: '--color-stone' },
  { name: 'taupe', token: '--color-taupe', dark: true },
  { name: 'accent-soft', token: '--color-accent-soft' },
  { name: 'accent', token: '--color-accent', dark: true },
  { name: 'accent-strong', token: '--color-accent-strong', dark: true },
  { name: 'ink-subtle', token: '--color-ink-subtle', dark: true },
  { name: 'ink-muted', token: '--color-ink-muted', dark: true },
  { name: 'ink', token: '--color-ink', dark: true },
];

type ExampleRow = { id: string; artist: string; service: string; when: string; duration: string; status: 'confirmed' | 'pending' | 'cancelled' };

const exampleRows: ExampleRow[] = [
  { id: '1', artist: 'Primjer Artist A', service: 'Snimanje vokala', when: 'pon 13. 10. · 10:00', duration: '3 h', status: 'confirmed' },
  { id: '2', artist: 'Primjer Artist B', service: 'Mix i master', when: 'uto 14. 10. · 14:00', duration: '4 h', status: 'pending' },
  { id: '3', artist: 'Primjer Artist C', service: 'Produkcija', when: 'čet 16. 10. · 18:30', duration: '2 h', status: 'cancelled' },
];

const statusBadge = {
  confirmed: <Badge tone="success" dot>Potvrđeno</Badge>,
  pending: <Badge tone="warning" dot>Na čekanju</Badge>,
  cancelled: <Badge tone="neutral">Otkazano</Badge>,
} as const;

const columns: DataColumn<ExampleRow>[] = [
  { id: 'artist', header: 'Artist', primary: true, cell: (r) => r.artist },
  { id: 'service', header: 'Usluga', cell: (r) => r.service },
  { id: 'when', header: 'Termin', cell: (r) => r.when },
  { id: 'duration', header: 'Trajanje', cell: (r) => r.duration, align: 'end', className: 'w-28' },
  { id: 'status', header: 'Status', cell: (r) => statusBadge[r.status], className: 'w-36' },
];

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-12 first:border-0 first:pt-0">
      <SectionHeader title={title} description={description} />
      {children}
    </section>
  );
}

type BookingForm = { name: string; email: string; service: string; notes: string };

function FormDemo() {
  const toast = useToast();
  const form = useForm<BookingForm>({
    initialValues: { name: '', email: '', service: '', notes: '' },
    validate: (v) => ({
      name: v.name.trim().length < 2 ? 'Upišite ime i prezime.' : undefined,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email) ? undefined : 'Upišite ispravnu e-mail adresu.',
      service: v.service ? undefined : 'Odaberite uslugu.',
      notes: v.notes.length > 300 ? 'Najviše 300 znakova.' : undefined,
    }),
    onSubmit: async (v) => {
      await new Promise((r) => setTimeout(r, 900));
      // Simulacija server greške: e-mail "zauzet@primjer.hr" vraća grešku polja.
      if (v.email === 'zauzet@primjer.hr') {
        throw { message: 'Rezervacija nije spremljena.', fieldErrors: { email: 'Ovaj e-mail već ima rezervaciju u tom terminu.' } };
      }
      toast.success('Rezervacija poslana', 'Primjer — ništa nije spremljeno.');
      form.reset();
    },
  });

  return (
    <Card className="max-w-xl">
      <CardHeader title="Upit za termin" description="Client-side validacija na blur i submit; server greška po polju i za cijelu formu." />
      <form noValidate onSubmit={form.handleSubmit} className="space-y-5">
        {form.formError ? <Alert tone="danger" title={form.formError} /> : null}
        <Field label="Ime i prezime" required error={form.errorFor('name')}>
          <Input autoComplete="name" {...form.register('name')} />
        </Field>
        <Field label="E-mail" required error={form.errorFor('email')} hint="Za simulaciju server greške upišite zauzet@primjer.hr">
          <Input type="email" inputMode="email" autoComplete="email" {...form.register('email')} />
        </Field>
        <Field label="Usluga" required error={form.errorFor('service')}>
          <Select placeholder="Odaberite…" {...form.register('service')}>
            <option value="vocal">Snimanje vokala</option>
            <option value="mix">Mix i master</option>
            <option value="prod">Produkcija</option>
          </Select>
        </Field>
        <Field label="Napomena" aside={`${form.values.notes.length}/300`} error={form.errorFor('notes')}>
          <Textarea {...form.register('notes')} placeholder="Žanr, broj pjesama, reference…" />
        </Field>
        <Checkbox label="Pošalji mi podsjetnik dan prije" description="E-mail u 10:00 dan prije termina." defaultChecked />
        <CardFooter>
          <Button variant="ghost" onClick={() => form.reset()} disabled={form.submitting}>
            Očisti
          </Button>
          <Button type="submit" loading={form.submitting} loadingLabel="Šaljem">
            Pošalji upit
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function UiKit() {
  usePageTitle('UI kit');
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [listState, setListState] = useState<'data' | 'loading' | 'empty' | 'error'>('data');

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 px-4 py-10 sm:px-6 lg:py-16">
      <PageHeader
        eyebrow="Dev · design system"
        title="Studio Cener UI"
        description="Tokeni i komponente iz @studio/ui. Ova stranica postoji samo u dev buildu."
        back={
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-ink-subtle hover:text-ink">
            <Icon name="chevronLeft" size={16} /> Početna
          </Link>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
              Drawer
            </Button>
            <Button leadingIcon={<Icon name="plus" size={18} />} onClick={() => setModalOpen(true)}>
              Novi termin
            </Button>
          </>
        }
      />

      <Section title="Boje" description="Semantički tokeni; tenant akcent se postavlja kroz CSS varijable.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {swatches.map((s) => (
            <div key={s.name} className="min-w-0">
              <div className="h-16 rounded-control shadow-hairline" style={{ background: `var(${s.token})` }} />
              <p className="mt-2 truncate text-xs font-medium">{s.name}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Badge>Neutralno</Badge>
          <Badge tone="accent">Akcent</Badge>
          <Badge tone="success" dot>
            Potvrđeno
          </Badge>
          <Badge tone="warning" dot>
            Na čekanju
          </Badge>
          <Badge tone="danger">Otkazano</Badge>
          <Badge tone="info">Info</Badge>
        </div>
      </Section>

      <Section title="Tipografija" description="Fraunces (display, lagana težina) + Instrument Sans (tekst).">
        <div className="space-y-4">
          <p className="eyebrow">Eyebrow · nadnaslov</p>
          <p className="font-display text-display">Zvuk koji se pamti</p>
          <h2 className="text-3xl">Naslov sekcije</h2>
          <h3 className="text-xl">Podnaslov kartice</h3>
          <p className="max-w-prose text-ink-muted">
            Tekst tijela ima visoku čitljivost i dovoljno zraka. Sekundarni tekst koristi prigušeni ton, ali uvijek s
            kontrastom iznad 4.5:1.
          </p>
          <p className="text-sm text-ink-subtle">Pomoćni tekst · 14 px</p>
        </div>
      </Section>

      <Section title="Gumbi">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primarni</Button>
          <Button variant="secondary">Sekundarni</Button>
          <Button variant="quiet">Tihi</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Otkaži termin</Button>
          <Button loading>Spremanje</Button>
          <Button disabled>Onemogućen</Button>
          <Button size="sm" variant="secondary">
            Mali
          </Button>
          <IconButton label="Postavke" variant="secondary">
            <Icon name="settings" />
          </IconButton>
          <DropdownMenu
            items={[
              { label: 'Uredi termin', icon: 'bookings', onSelect: () => toast.show({ title: 'Uredi' }) },
              { label: 'Premjesti', icon: 'calendar', onSelect: () => toast.show({ title: 'Premjesti' }), description: 'Odaberi novi slot' },
              { type: 'separator' },
              { label: 'Otkaži', icon: 'close', tone: 'danger', onSelect: () => setConfirmOpen(true) },
            ]}
            trigger={(props) => (
              <IconButton label="Više akcija" variant="secondary" {...props}>
                <Icon name="more" />
              </IconButton>
            )}
          />
        </div>
      </Section>

      <Section title="Kartice i KPI">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <Stat label="Termini ovaj tjedan" value="—" hint="Primjer bez podataka" />
          </Card>
          <Card>
            <Stat label="Popunjenost" value="—" hint="Primjer bez podataka" />
          </Card>
          <Card variant="flat">
            <Stat label="Flat varijanta" value="—" />
          </Card>
        </div>
      </Section>

      <Section title="Forma" description="Field veže label, hint i grešku s kontrolom (aria-describedby, aria-invalid).">
        <FormDemo />
      </Section>

      <Section title="Lista / tablica" description="Tablica od md naviše, kartice ispod. Primjer redaka je ilustrativan.">
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Stanje liste">
          {(['data', 'loading', 'empty', 'error'] as const).map((s) => (
            <Button key={s} size="sm" variant={listState === s ? 'primary' : 'secondary'} onClick={() => setListState(s)} aria-pressed={listState === s}>
              {{ data: 'Podaci', loading: 'Učitavanje', empty: 'Prazno', error: 'Greška' }[s]}
            </Button>
          ))}
        </div>
        <AsyncState
          status={listState === 'loading' ? 'loading' : listState === 'error' ? 'error' : 'success'}
          data={listState === 'empty' ? [] : exampleRows}
          isEmpty={(rows) => rows.length === 0}
          loading={<LoadingState variant="rows" rows={3} />}
          onRetry={() => setListState('data')}
          empty={
            <Card padded={false}>
              <EmptyState
                size="compact"
                icon="calendar"
                title="Nema nadolazećih termina"
                description="Kad artist rezervira termin, pojavit će se ovdje."
                action={<Button onClick={() => setModalOpen(true)}>Dodaj termin</Button>}
              />
            </Card>
          }
        >
          {(rows) => (
            <DataList
              caption="Primjer rezervacija"
              columns={columns}
              rows={rows}
              getRowKey={(r) => r.id}
              onRowClick={(r) => toast.show({ title: `Otvoren: ${r.artist}`, description: r.when })}
              rowActionLabel={(r) => `Otvori termin: ${r.artist}, ${r.when}`}
            />
          )}
        </AsyncState>
      </Section>

      <Section title="Stanja">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card padded={false}>
            <EmptyState size="compact" icon="portfolio" title="Portfolio je prazan" description="Dodajte prvi projekt da se prikaže na javnom profilu." />
          </Card>
          <Card padded={false}>
            <ErrorState size="compact" onRetry={() => toast.show({ title: 'Ponovni pokušaj' })} />
          </Card>
        </div>
        <div className="mt-4 space-y-3">
          <Alert tone="info" title="Termini se prikazuju u vremenskoj zoni studija (Europe/Zagreb)." />
          <Alert tone="success" title="Radno vrijeme spremljeno." />
          <Alert tone="warning" title="Usluga nema cijenu">
            Artisti je neće vidjeti dok ne postavite cijenu.
          </Alert>
          <Alert tone="danger" title="Termin je u međuvremenu zauzet" action={<Button size="sm" variant="secondary">Osvježi</Button>}>
            Odaberite drugi slot.
          </Alert>
        </div>
      </Section>

      <Section title="Toast obavijesti">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => toast.success('Termin potvrđen', 'Artist je dobio e-mail potvrdu.')}>
            Uspjeh
          </Button>
          <Button variant="secondary" onClick={() => toast.error('Spremanje nije uspjelo', 'Provjerite vezu i pokušajte ponovno.')}>
            Greška
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast.show({ title: 'Termin otkazan', action: { label: 'Poništi', onClick: () => toast.show({ title: 'Vraćeno' }) } })}
          >
            S akcijom
          </Button>
        </div>
      </Section>

      <Section title="Ikone">
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {iconNames.map((name) => (
            <li key={name} className="flex flex-col items-center gap-1.5 rounded-control bg-raised py-3 shadow-hairline">
              <Icon name={name} size={22} />
              <span className="max-w-full truncate px-1 text-[0.625rem] text-ink-subtle">{name}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Novi termin"
        description="Na mobitelu je ovo bottom sheet."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Odustani
            </Button>
            <Button
              onClick={() => {
                setModalOpen(false);
                toast.success('Primjer spremljen');
              }}
            >
              Spremi
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Usluga" required>
            <Select defaultValue="vocal">
              <option value="vocal">Snimanje vokala</option>
              <option value="mix">Mix i master</option>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Datum" required>
              <Input type="date" />
            </Field>
            <Field label="Početak" required>
              <Input type="time" step={900} />
            </Field>
          </div>
          <Field label="Interna napomena" aside="Opcionalno">
            <Textarea rows={3} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        tone="danger"
        title="Otkazati termin?"
        description="Artist će dobiti obavijest o otkazivanju. Ova radnja se ne može poništiti."
        confirmLabel="Otkaži termin"
        loading={confirmLoading}
        onConfirm={() => {
          setConfirmLoading(true);
          setTimeout(() => {
            setConfirmLoading(false);
            setConfirmOpen(false);
            toast.show({ title: 'Termin otkazan' });
          }, 900);
        }}
      />

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Filtri" side="right" footer={<Button fullWidth onClick={() => setDrawerOpen(false)}>Primijeni</Button>}>
        <div className="space-y-5 px-1 pt-2">
          <Field label="Status">
            <Select defaultValue="all">
              <option value="all">Svi</option>
              <option value="confirmed">Potvrđeni</option>
            </Select>
          </Field>
          <Checkbox label="Samo moji termini" />
        </div>
      </Drawer>
    </div>
  );
}
