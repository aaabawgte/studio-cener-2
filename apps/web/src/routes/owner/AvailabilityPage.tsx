import type { AvailabilityRule } from '@studio/contracts';
import { Alert, Button, Card, Checkbox, Field, Input, LoadingState, PageHeader, useToast } from '@studio/ui';
import { useState } from 'react';
import { useOutletContext } from 'react-router';
import { fetchAvailability, saveAvailability } from '../../features/catalog/catalog-api';
import type { StudioViewerContext } from '../../features/studio/types';
import { useAsync } from '../../lib/useAsync';
import { usePageTitle } from '../../lib/usePageTitle';

const days = [
  { weekday: 1, label: 'Ponedjeljak' },
  { weekday: 2, label: 'Utorak' },
  { weekday: 3, label: 'Srijeda' },
  { weekday: 4, label: 'Četvrtak' },
  { weekday: 5, label: 'Petak' },
  { weekday: 6, label: 'Subota' },
  { weekday: 0, label: 'Nedjelja' },
] as const;

function minuteToTime(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

function timeToMinute(value: string) {
  const [hours = '0', minutes = '0'] = value.split(':');
  return Number(hours) * 60 + Number(minutes);
}

type DayValue = { weekday: number; enabled: boolean; start: string; end: string };

export function AvailabilityPage() {
  usePageTitle('Radno vrijeme');
  const ctx = useOutletContext<StudioViewerContext>();
  const result = useAsync((signal) => fetchAvailability(ctx.studio.slug, signal), [ctx.studio.slug]);

  return (
    <>
      <PageHeader title="Radno vrijeme" description={`Redovni tjedni raspored u vremenskoj zoni ${ctx.studio.timezone}.`} />
      {result.status === 'loading' ? <LoadingState variant="rows" rows={7} /> : null}
      {result.status === 'error' ? <Alert tone="danger" title="Raspored nije moguće učitati">Pokušajte osvježiti stranicu.</Alert> : null}
      {result.data ? (
        <AvailabilityEditor
          key={result.data.rules.map((rule) => `${rule.id}:${rule.startMinute}:${rule.endMinute}`).join('|')}
          slug={ctx.studio.slug}
          initialRules={result.data.rules}
          timezone={result.data.timezone}
          onSaved={result.reload}
        />
      ) : null}
    </>
  );
}

function AvailabilityEditor({ slug, initialRules, timezone, onSaved }: { slug: string; initialRules: AvailabilityRule[]; timezone: string; onSaved: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<DayValue[]>(() => days.map((day) => {
    const rule = initialRules.find((item) => item.weekday === day.weekday);
    return {
      weekday: day.weekday,
      enabled: Boolean(rule),
      start: rule ? minuteToTime(rule.startMinute) : '10:00',
      end: rule ? minuteToTime(rule.endMinute) : '18:00',
    };
  }));

  function update(weekday: number, change: Partial<DayValue>) {
    setValues((current) => current.map((day) => day.weekday === weekday ? { ...day, ...change } : day));
  }

  async function submit() {
    setError(null);
    const invalid = values.find((day) => day.enabled && timeToMinute(day.end) <= timeToMinute(day.start));
    if (invalid) {
      setError(`Završetak mora biti nakon početka za dan ${days.find((day) => day.weekday === invalid.weekday)?.label}.`);
      return;
    }
    setSaving(true);
    try {
      await saveAvailability(slug, values.filter((day) => day.enabled).map((day) => ({
        weekday: day.weekday,
        startMinute: timeToMinute(day.start),
        endMinute: timeToMinute(day.end),
      })));
      toast.success('Radno vrijeme je spremljeno.');
      onSaved();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Spremanje nije uspjelo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl">Tjedni raspored</h2><p className="mt-1 text-sm text-ink-subtle">{timezone}</p></div>
        <Button onClick={() => void submit()} loading={saving}>Spremi raspored</Button>
      </div>
      {error ? <Alert tone="danger" className="mb-5">{error}</Alert> : null}
      <div className="divide-y divide-line">
        {days.map((day) => {
          const value = values.find((item) => item.weekday === day.weekday)!;
          return (
            <div key={day.weekday} className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(10rem,1fr)_9rem_9rem] sm:items-center">
              <Checkbox label={day.label} checked={value.enabled} onChange={(event) => update(day.weekday, { enabled: event.target.checked })} />
              {value.enabled ? (
                <>
                  <Field label="Od" hideLabel><Input aria-label={`${day.label}, početak`} type="time" value={value.start} step={900} onChange={(event) => update(day.weekday, { start: event.target.value })} /></Field>
                  <Field label="Do" hideLabel><Input aria-label={`${day.label}, završetak`} type="time" value={value.end} step={900} onChange={(event) => update(day.weekday, { end: event.target.value })} /></Field>
                </>
              ) : <p className="text-sm text-ink-subtle sm:col-span-2">Zatvoreno</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
