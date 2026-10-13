import { Badge, Button, Card, EmptyState, PageHeader, useToast } from '@studio/ui';
import { useOutletContext } from 'react-router';
import type { StudioViewerContext } from '../../features/studio/types';
import { fetchOwnWaitlist, leaveWaitlist } from '../../features/waitlist/waitlist-api';
import { useAsync } from '../../lib/useAsync';
import { usePageTitle } from '../../lib/usePageTitle';

export function WaitlistPage() {
  usePageTitle('Lista čekanja'); const ctx = useOutletContext<StudioViewerContext>(); const toast = useToast();
  const entries = useAsync((signal) => fetchOwnWaitlist(ctx.studio.slug, signal), [ctx.studio.slug]);
  async function leave(id: string) { try { await leaveWaitlist(ctx.studio.slug, id); entries.reload(); toast.success('Prijava je uklonjena.'); } catch (error) { toast.error('Prijavu nije moguće ukloniti', error instanceof Error ? error.message : undefined); } }
  return <><PageHeader title="Lista čekanja" description="Datumi za koje želite dobiti obavijest kad se termin oslobodi." />
    {entries.data?.waitlistEntries.length ? <div className="space-y-3">{entries.data.waitlistEntries.map((entry) => <Card key={entry.id} className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-medium">{entry.serviceName}</h2><Status status={entry.status} /></div><p className="mt-2 text-sm text-ink-subtle">{new Intl.DateTimeFormat('hr-HR', { dateStyle: 'full' }).format(new Date(`${entry.desiredDate}T12:00:00`))}</p>{entry.lastNotifiedAt ? <p className="mt-1 text-xs text-ink-subtle">Obavijest poslana {new Intl.DateTimeFormat('hr-HR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.lastNotifiedAt))}</p> : null}</div>{entry.status === 'active' || entry.status === 'notified' ? <Button size="sm" variant="ghost" onClick={() => void leave(entry.id)}>Ukloni</Button> : null}</Card>)}</div> : entries.status === 'success' ? <Card padded={false}><EmptyState icon="hourglass" title="Niste na listi čekanja" description="Kad nema termina, prijavu možete dodati tijekom rezervacije." /></Card> : null}
  </>;
}

function Status({ status }: { status: 'active'|'notified'|'cancelled'|'converted'|'expired' }) {
  const labels = { active: 'Čeka', notified: 'Termin oslobođen', cancelled: 'Uklonjeno', converted: 'Rezervirano', expired: 'Isteklo' };
  return <Badge tone={status === 'active' ? 'info' : status === 'notified' ? 'success' : 'neutral'}>{labels[status]}</Badge>;
}
