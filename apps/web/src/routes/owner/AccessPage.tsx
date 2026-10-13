import type { StudioAccessInvitation, StudioAccessMember } from '@studio/contracts';
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, PageHeader, Select, useToast } from '@studio/ui';
import { useMemo, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router';
import { fetchStudioAccess, inviteManager, revokeManagerAccess, revokeManagerInvitation } from '../../features/access/access-api';
import { fetchTeamMembers } from '../../features/content/content-api';
import type { StudioViewerContext } from '../../features/studio/types';
import { useAsync } from '../../lib/useAsync';
import { usePageTitle } from '../../lib/usePageTitle';

type PendingAction = { kind: 'invitation'; item: StudioAccessInvitation } | { kind: 'member'; item: StudioAccessMember };

export function AccessPage() {
  usePageTitle('Pristupi');
  const ctx = useOutletContext<StudioViewerContext>();
  const access = useAsync((signal) => fetchStudioAccess(ctx.studio.slug, signal), [ctx.studio.slug]);
  const team = useAsync((signal) => fetchTeamMembers(ctx.studio.slug, signal), [ctx.studio.slug]);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [revoking, setRevoking] = useState(false);
  const toast = useToast();
  const linkedIds = useMemo(() => new Set([
    ...(access.data?.members.map((item) => item.teamMemberId).filter(Boolean) ?? []),
    ...(access.data?.invitations.map((item) => item.teamMemberId).filter(Boolean) ?? []),
  ]), [access.data]);
  const availableProfiles = team.data?.teamMembers.filter((item) => !linkedIds.has(item.id)) ?? [];

  async function confirmRevoke() {
    if (!pending) return;
    setRevoking(true);
    try {
      if (pending.kind === 'invitation') await revokeManagerInvitation(ctx.studio.slug, pending.item.id);
      else await revokeManagerAccess(ctx.studio.slug, pending.item.membershipId);
      toast.success(pending.kind === 'invitation' ? 'Pozivnica je opozvana.' : 'Manager pristup je opozvan.');
      setPending(null); access.reload(); team.reload();
    } catch (error: unknown) { toast.error('Promjena nije uspjela', error instanceof Error ? error.message : undefined); }
    finally { setRevoking(false); }
  }

  return (
    <>
      <PageHeader title="Pristupi" description="Pozovite managere i kontrolirajte tko može upravljati studijem." />
      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <InviteForm slug={ctx.studio.slug} profiles={availableProfiles} disabled={(access.data?.managerSlotsUsed ?? 0) >= (access.data?.managerLimit ?? 0)} onCreated={access.reload} />
        <div className="space-y-6">
          {access.status === 'error' ? <Alert tone="danger">Pristupe nije moguće učitati.</Alert> : null}
          {access.data ? <Card><div className="flex items-center justify-between gap-4"><div><p className="eyebrow">Manager mjesta</p><p className="mt-2 font-display text-3xl">{access.data.managerSlotsUsed} / {access.data.managerLimit}</p></div><Badge tone={access.data.managerSlotsUsed >= access.data.managerLimit ? 'warning' : 'success'}>{access.data.managerSlotsUsed >= access.data.managerLimit ? 'Limit dosegnut' : 'Dostupno'}</Badge></div></Card> : null}
          <section><h2 className="mb-4 text-xl">Aktivni pristupi</h2><div className="space-y-3">{access.data?.members.map((member) => <Card key={member.membershipId} className="flex items-center justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{member.name}</h3><Badge tone={member.role === 'owner' ? 'accent' : 'neutral'}>{member.role === 'owner' ? 'Owner' : 'Manager'}</Badge></div><p className="mt-1 truncate text-sm text-ink-subtle">{member.email}</p>{member.teamMemberId ? <p className="mt-1 text-xs text-accent-strong">Povezan s javnim profilom</p> : null}</div>{member.role === 'manager' ? <Button size="sm" variant="ghost" onClick={() => setPending({ kind: 'member', item: member })}>Opozovi</Button> : null}</Card>)}</div></section>
          <section><h2 className="mb-4 text-xl">Pozivnice na čekanju</h2>{access.data?.invitations.length ? <div className="space-y-3">{access.data.invitations.map((invitation) => <Card key={invitation.id} className="flex items-center justify-between gap-4"><div className="min-w-0"><p className="truncate font-medium">{invitation.email}</p><p className="mt-1 text-xs text-ink-subtle">Vrijedi do {new Intl.DateTimeFormat('hr-HR', { dateStyle: 'medium' }).format(new Date(invitation.expiresAt))}</p></div><Button size="sm" variant="ghost" onClick={() => setPending({ kind: 'invitation', item: invitation })}>Opozovi</Button></Card>)}</div> : <Card padded={false}><EmptyState size="compact" icon="user" title="Nema aktivnih pozivnica" /></Card>}</section>
        </div>
      </div>
      <ConfirmDialog open={pending !== null} onClose={() => setPending(null)} onConfirm={() => void confirmRevoke()} loading={revoking} tone="danger" title={pending?.kind === 'member' ? 'Opozvati manager pristup?' : 'Opozvati pozivnicu?'} description={pending?.kind === 'member' ? 'Osoba će odmah izgubiti pristup owner dashboardu.' : 'Postojeći onboarding link više neće raditi.'} confirmLabel="Opozovi" />
    </>
  );
}

function InviteForm({ slug, profiles, disabled, onCreated }: { slug: string; profiles: { id: string; name: string }[]; disabled: boolean; onCreated: () => void }) {
  const [email, setEmail] = useState('');
  const [teamMemberId, setTeamMemberId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const toast = useToast();
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(null); setInviteUrl(null);
    try {
      const created = await inviteManager(slug, { email, teamMemberId: teamMemberId || null });
      setInviteUrl(`${window.location.origin}/pozivnica?token=${encodeURIComponent(created.invitationToken)}`);
      setEmail(''); setTeamMemberId(''); onCreated(); toast.success('Manager pozivnica je kreirana.');
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Pozivnicu nije moguće kreirati.'); }
    finally { setSaving(false); }
  }
  return <Card className="h-fit"><h2 className="text-xl">Pozovi managera</h2><p className="mt-2 text-sm text-ink-subtle">Link vrijedi 14 dana i radi samo za uneseni e-mail.</p>{error ? <Alert tone="danger" className="mt-4">{error}</Alert> : null}{inviteUrl ? <Alert tone="success" title="Pozivnica je spremna" className="mt-4"><a href={inviteUrl} className="break-all underline">{inviteUrl}</a></Alert> : null}<form className="mt-5 space-y-4" onSubmit={(event) => void submit(event)}><Field label="E-mail managera" required><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={disabled} /></Field><Field label="Javni profil" hint="Opcionalno povežite login s članom tima."><Select value={teamMemberId} onChange={(event) => setTeamMemberId(event.target.value)} disabled={disabled}><option value="">Bez povezivanja</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</Select></Field><Button type="submit" fullWidth loading={saving} disabled={disabled}>{disabled ? 'Limit managera je dosegnut' : 'Kreiraj pozivnicu'}</Button></form></Card>;
}
