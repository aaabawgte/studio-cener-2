import { Outlet, useNavigate, useParams } from 'react-router';
import { AppShell } from '../../shell/AppShell';
import { StudioGate } from '../../shell/StudioGate';
import { artistNav } from '../../shell/nav';
import { useUserMenu } from '../../shell/useUserMenu';
import type { StudioViewerContext } from '../../features/studio/types';

export function ArtistLayout() {
  const { slug = '' } = useParams();
  return <StudioGate slug={slug}>{(ctx) => <ArtistShell ctx={ctx} />}</StudioGate>;
}

function ArtistShell({ ctx }: { ctx: StudioViewerContext }) {
  const navigate = useNavigate();
  const base = `/s/${ctx.studio.slug}/me`;
  const userMenu = useUserMenu([{ label: 'Profil', icon: 'user', onSelect: () => navigate(`${base}/profil`) }]);

  return (
    <AppShell
      brand={{ name: ctx.studio.name, logoUrl: ctx.studio.branding.logoUrl, context: 'Artist portal', homeHref: base }}
      sections={artistNav}
      base={base}
      viewer={ctx.viewer}
      userMenu={userMenu}
      footerLinks={[{ label: 'Javni profil studija', href: `/s/${ctx.studio.slug}` }]}
      navLabel="Navigacija portala"
    >
      <Outlet context={ctx} />
    </AppShell>
  );
}
