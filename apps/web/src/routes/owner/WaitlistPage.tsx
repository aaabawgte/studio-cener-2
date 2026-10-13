import { Badge, Card, EmptyState, PageHeader } from '@studio/ui';
import { useOutletContext } from 'react-router';
import type { StudioViewerContext } from '../../features/studio/types';
import { fetchStudioWaitlist } from '../../features/waitlist/waitlist-api';
import { useAsync } from '../../lib/useAsync';
import { usePageTitle } from '../../lib/usePageTitle';

export function OwnerWaitlistPage() {
  usePageTitle('Lista čekanja'); const ctx = useOutletContext<StudioViewerContext>();
  const state = useAsync((signal) => fetchStudioWaitlist(ctx.studio.slug, signal), [ctx.studio.slug]);
  return <><PageHeader title="Lista čekanja" description="Artisti koji čekaju oslobađanje termina za određeni datum." />
    {state.data?.waitlistEntries.length ? <Card padded={false}><div className="divide-y divide-line">{state.data.waitlistEntries.map((entry) => <div key={entry.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_1fr_auto] sm:items-center"><div><p className="font-medium">{entry.artistName}</p><p className="text-xs text-ink-subtle">{entry.artistEmail}</p></div><div><p className="text-sm">{entry.serviceName}</p><p className="text-xs text-ink-subtle">{new Intl.DateTimeFormat('hr-HR', { dateStyle: 'medium' }).format(new Date(`${entry.desiredDate}T12:00:00`))}</p></div><Badge tone={entry.status === 'active' ? 'info' : entry.status === 'notified' ? 'success' : 'neutral'}>{entry.status === 'active' ? 'Čeka' : entry.status === 'notified' ? 'Obaviješten' : entry.status === 'converted' ? 'Rezervirano' : 'Zatvoreno'}</Badge></div>)}</div></Card> : state.status === 'success' ? <Card padded={false}><EmptyState icon="hourglass" title="Lista čekanja je prazna" /></Card> : null}
  </>;
}
