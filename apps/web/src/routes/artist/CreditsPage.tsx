import { Badge, Card, EmptyState, PageHeader } from '@studio/ui';
import { useOutletContext } from 'react-router';
import type { StudioViewerContext } from '../../features/studio/types';
import { fetchOwnValueAccount } from '../../features/value/value-api';
import { useAsync } from '../../lib/useAsync';
import { usePageTitle } from '../../lib/usePageTitle';

export function CreditsPage() {
  usePageTitle('Krediti i paketi'); const ctx = useOutletContext<StudioViewerContext>();
  const account = useAsync((signal) => fetchOwnValueAccount(ctx.studio.slug, signal), [ctx.studio.slug]);
  const formatMoney = (minor: number) => new Intl.NumberFormat('hr-HR', { style: 'currency', currency: ctx.studio.currency }).format(minor / 100);
  return <><PageHeader title="Krediti i paketi" description="Vaše raspoloživo stanje u studiju." />
    {account.data ? <div className="space-y-7"><Card><p className="eyebrow">Prepaid kredit</p><p className="mt-2 font-display text-4xl">{formatMoney(account.data.creditBalanceMinor)}</p></Card><section><h2 className="mb-3 text-xl">Paketi sati</h2>{account.data.packageBalances.length ? <div className="grid gap-3 sm:grid-cols-2">{account.data.packageBalances.map((item) => <Card key={item.id}><div className="flex justify-between gap-3"><h3 className="font-medium">{item.packageName}</h3><Badge tone={item.status === 'active' ? 'success' : 'neutral'}>{item.status === 'active' ? 'Aktivan' : item.status === 'expired' ? 'Istekao' : 'Iskorišten'}</Badge></div><p className="mt-4 font-display text-3xl">{Math.floor(item.remainingMinutes / 60)} h {item.remainingMinutes % 60} min</p>{item.expiresAt ? <p className="mt-2 text-xs text-ink-subtle">Vrijedi do {new Intl.DateTimeFormat('hr-HR', { dateStyle: 'medium' }).format(new Date(item.expiresAt))}</p> : null}</Card>)}</div> : <Card padded={false}><EmptyState size="compact" icon="wallet" title="Nemate aktivnih paketa" /></Card>}</section></div> : account.status === 'error' ? <EmptyState icon="alert" title="Stanje nije moguće učitati" /> : <p className="text-sm text-ink-subtle">Učitavanje…</p>}
  </>;
}
