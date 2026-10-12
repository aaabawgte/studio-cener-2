import { Outlet, useNavigate, useParams } from 'react-router';
import { AppShell } from '../../shell/AppShell';
import { StudioGate } from '../../shell/StudioGate';
import { filterNav, ownerNav } from '../../shell/nav';
import { useUserMenu } from '../../shell/useUserMenu';
import type { StudioViewerContext } from '../../features/studio/types';

const roleLabel = { owner: 'Vlasnik', manager: 'Menadžer', artist: 'Artist' } as const;

export function OwnerLayout() {
  const { slug = '' } = useParams();
  return <StudioGate slug={slug}>{(ctx) => <OwnerShell ctx={ctx} />}</StudioGate>;
}

function OwnerShell({ ctx }: { ctx: StudioViewerContext }) {
  const navigate = useNavigate();
  const base = `/app/${ctx.studio.slug}`;
  const sections = filterNav(ownerNav, ctx.membership.permissions);
  const userMenu = useUserMenu([
    { label: 'Javni profil studija', icon: 'external', onSelect: () => navigate(`/s/${ctx.studio.slug}`) },
  ]);

  return (
    <AppShell
      brand={{ name: ctx.studio.name, logoUrl: ctx.studio.branding.logoUrl, context: roleLabel[ctx.membership.role], homeHref: base }}
      sections={sections}
      base={base}
      viewer={ctx.viewer}
      userMenu={userMenu}
      footerLinks={[{ label: 'Javni profil studija', href: `/s/${ctx.studio.slug}`, external: true }]}
      navLabel="Glavna navigacija"
    >
      <Outlet context={ctx} />
    </AppShell>
  );
}
