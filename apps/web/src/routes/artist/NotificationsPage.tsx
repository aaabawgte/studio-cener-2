import { Badge, Button, Card, EmptyState, PageHeader, useToast } from '@studio/ui';
import { useOutletContext } from 'react-router';
import type { StudioViewerContext } from '../../features/studio/types';
import { fetchNotifications, markNotificationRead } from '../../features/waitlist/waitlist-api';
import { useAsync } from '../../lib/useAsync';
import { usePageTitle } from '../../lib/usePageTitle';

export function NotificationsPage() {
  usePageTitle('Obavijesti'); const ctx = useOutletContext<StudioViewerContext>(); const toast = useToast();
  const state = useAsync((signal) => fetchNotifications(ctx.studio.slug, signal), [ctx.studio.slug]);
  async function read(id: string) { try { await markNotificationRead(ctx.studio.slug, id); state.reload(); } catch (error) { toast.error('Obavijest nije spremljena', error instanceof Error ? error.message : undefined); } }
  return <><PageHeader title="Obavijesti" description="Novosti o terminima i listi čekanja." />
    {state.data?.notifications.length ? <div className="space-y-3">{state.data.notifications.map((item) => <Card key={item.id} className={item.readAt ? '' : 'ring-1 ring-accent/30'}><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-medium">{item.title}</h2>{!item.readAt ? <Badge tone="accent">Novo</Badge> : null}</div><p className="mt-2 text-sm text-ink-subtle">{item.body}</p><p className="mt-3 text-xs text-ink-subtle">{new Intl.DateTimeFormat('hr-HR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</p></div>{!item.readAt ? <Button size="sm" variant="ghost" onClick={() => void read(item.id)}>Označi pročitano</Button> : null}</div></Card>)}</div> : state.status === 'success' ? <Card padded={false}><EmptyState icon="bell" title="Nema obavijesti" /></Card> : null}
  </>;
}
