import type { BlockedSlot, BlockedSlotCreate } from '@studio/contracts';
import { Alert, Button, Card, EmptyState, Field, Input, LoadingState, PageHeader, useToast } from '@studio/ui';
import { useMemo, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router';
import { createBlockedSlot, deleteBlockedSlot, fetchBlockedSlots } from '../../features/bookings/booking-api';
import type { StudioViewerContext } from '../../features/studio/types';
import { useAsync } from '../../lib/useAsync';
import { usePageTitle } from '../../lib/usePageTitle';

function tomorrowInTimezone(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts();
  const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
  const tomorrow = new Date(Date.UTC(values.year!, values.month! - 1, values.day! + 1, 12));
  return tomorrow.toISOString().slice(0, 10);
}

export function CalendarPage() {
  usePageTitle('Kalendar');
  const ctx = useOutletContext<StudioViewerContext>();
  const result = useAsync((signal) => fetchBlockedSlots(ctx.studio.slug, signal), [ctx.studio.slug]);
  const initialDate = tomorrowInTimezone(ctx.studio.timezone);

  return (
    <>
      <PageHeader title="Kalendar" description={`Upravljajte nedostupnim razdobljima u vremenskoj zoni ${ctx.studio.timezone}.`} />
      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <BlockForm slug={ctx.studio.slug} initialDate={initialDate} onCreated={result.reload} />
        <BlockList
          slug={ctx.studio.slug}
          timezone={ctx.studio.timezone}
          blocks={result.data?.blockedSlots}
          loading={result.status === 'loading'}
          failed={result.status === 'error'}
          onDeleted={result.reload}
        />
      </div>
    </>
  );
}

function BlockForm({ slug, initialDate, onCreated }: { slug: string; initialDate: string; onCreated: () => void }) {
  const toast = useToast();
  const [value, setValue] = useState<BlockedSlotCreate>({
    startLocal: `${initialDate}T10:00`,
    endLocal: `${initialDate}T12:00`,
    reason: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createBlockedSlot(slug, value);
      setValue((current) => ({ ...current, reason: '' }));
      toast.success('Razdoblje je blokirano.');
      onCreated();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Blokadu nije moguće spremiti.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="h-fit">
      <h2 className="text-xl">Nova blokada</h2>
      <p className="mt-1 text-sm text-ink-subtle">Odmor, održavanje ili privatni termin.</p>
      {error ? <Alert tone="danger" className="mt-5">{error}</Alert> : null}
      <form className="mt-5 space-y-4" onSubmit={(event) => void submit(event)}>
        <Field label="Početak" required><Input type="datetime-local" step={900} value={value.startLocal} onChange={(event) => setValue({ ...value, startLocal: event.target.value })} /></Field>
        <Field label="Završetak" required><Input type="datetime-local" step={900} value={value.endLocal} onChange={(event) => setValue({ ...value, endLocal: event.target.value })} /></Field>
        <Field label="Razlog" required><Input value={value.reason} maxLength={200} placeholder="npr. Održavanje" onChange={(event) => setValue({ ...value, reason: event.target.value })} /></Field>
        <Button type="submit" fullWidth loading={saving}>Blokiraj razdoblje</Button>
      </form>
    </Card>
  );
}

function BlockList({ slug, timezone, blocks, loading, failed, onDeleted }: {
  slug: string;
  timezone: string;
  blocks: BlockedSlot[] | undefined;
  loading: boolean;
  failed: boolean;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const [deleting, setDeleting] = useState<string | null>(null);
  const formatter = useMemo(() => new Intl.DateTimeFormat('hr-HR', { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }), [timezone]);

  async function remove(id: string) {
    setDeleting(id);
    try {
      await deleteBlockedSlot(slug, id);
      toast.success('Blokada je uklonjena.');
      onDeleted();
    } catch (caught: unknown) {
      toast.error('Brisanje nije uspjelo', caught instanceof Error ? caught.message : undefined);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-xl">Nadolazeće blokade</h2>
      {loading ? <LoadingState variant="rows" rows={3} /> : null}
      {failed ? <Alert tone="danger">Blokade trenutno nije moguće učitati.</Alert> : null}
      {blocks?.length === 0 ? <Card padded={false}><EmptyState size="compact" icon="calendar" title="Nema blokiranih razdoblja" /></Card> : null}
      <div className="space-y-3">
        {blocks?.map((block) => (
          <Card key={block.id} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h3 className="text-base">{block.reason}</h3><p className="mt-1 text-sm text-ink-subtle">{formatter.format(new Date(block.startAtUtc))} – {formatter.format(new Date(block.endAtUtc))}</p></div>
            <Button variant="secondary" loading={deleting === block.id} onClick={() => void remove(block.id)}>Ukloni</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
