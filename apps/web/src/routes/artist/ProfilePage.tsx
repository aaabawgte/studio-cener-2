import { Alert, Button, Card, Field, Input, PageHeader, useToast } from '@studio/ui';
import { useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router';
import { updateProfile } from '../../features/profile/profile-api';
import type { StudioViewerContext } from '../../features/studio/types';
import { authClient } from '../../lib/auth-client';
import { usePageTitle } from '../../lib/usePageTitle';

export function ProfilePage() {
  usePageTitle('Profil');
  const ctx = useOutletContext<StudioViewerContext>();
  const toast = useToast();
  const [name, setName] = useState(ctx.viewer.name);
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setSavingProfile(true);
    try { const viewer = await updateProfile(ctx.studio.slug, { name }); setName(viewer.name); toast.success('Profil je spremljen.'); }
    catch (error) { toast.error('Profil nije spremljen', error instanceof Error ? error.message : undefined); }
    finally { setSavingProfile(false); }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault(); setPasswordError(null); setSavingPassword(true);
    try {
      const result = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
      if (result.error) { setPasswordError(result.error.message ?? 'Lozinka nije promijenjena.'); return; }
      setCurrentPassword(''); setNewPassword(''); toast.success('Lozinka je promijenjena.');
    } catch (error) { setPasswordError(error instanceof Error ? error.message : 'Lozinka nije promijenjena.'); }
    finally { setSavingPassword(false); }
  }

  return <><PageHeader title="Profil" description="Osnovni podaci vašeg računa koriste se u svim studijima kojima pripadate." />
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><h2 className="text-xl">Osnovni podaci</h2><form className="mt-5 space-y-5" onSubmit={(event) => void saveProfile(event)}><Field label="Ime i prezime" required><Input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} autoComplete="name" /></Field><Field label="E-mail" hint="Promjena e-maila zasad nije dostupna."><Input value={ctx.viewer.email} disabled /></Field><Button type="submit" loading={savingProfile} disabled={name.trim().length < 2 || name.trim() === ctx.viewer.name}>Spremi profil</Button></form></Card>
      <Card><h2 className="text-xl">Promijeni lozinku</h2>{passwordError ? <Alert tone="danger" className="mt-4">{passwordError}</Alert> : null}<form className="mt-5 space-y-5" onSubmit={(event) => void changePassword(event)}><Field label="Trenutačna lozinka" required><Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" /></Field><Field label="Nova lozinka" required hint="Najmanje 10 znakova."><Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={10} maxLength={128} autoComplete="new-password" /></Field><Button type="submit" loading={savingPassword} disabled={!currentPassword || newPassword.length < 10}>Promijeni lozinku</Button></form></Card>
    </div>
  </>;
}
