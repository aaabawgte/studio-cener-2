import { Outlet, useLocation, useNavigate, useParams } from 'react-router';
import { useEffect, useMemo } from 'react';
import { AppShell } from '../../shell/AppShell';
import { StudioGate } from '../../shell/StudioGate';
import { artistNav } from '../../shell/nav';
import { useUserMenu } from '../../shell/useUserMenu';
import type { StudioViewerContext } from '../../features/studio/types';
import { fetchUnreadNotificationCount } from '../../features/waitlist/waitlist-api';
import { useAsync } from '../../lib/useAsync';

export function ArtistLayout() {
  const { slug = '' } = useParams();
  return <StudioGate slug={slug}>{(ctx) => <ArtistShell ctx={ctx} />}</StudioGate>;
}

function ArtistShell({ ctx }: { ctx: StudioViewerContext }) {
  const navigate = useNavigate();
  const location = useLocation();
  const base = `/s/${ctx.studio.slug}/me`;
  const userMenu = useUserMenu([{ label: 'Profil', icon: 'user', onSelect: () => navigate(`${base}/profil`) }]);
  const unread = useAsync((signal) => fetchUnreadNotificationCount(ctx.studio.slug, signal), [ctx.studio.slug, location.pathname]);
  const reloadUnread = unread.reload;
  useEffect(() => {
    const reload = () => reloadUnread();
    window.addEventListener('studio-notifications-changed', reload);
    return () => window.removeEventListener('studio-notifications-changed', reload);
  }, [reloadUnread]);
  const sections = useMemo(() => artistNav.map((section) => ({ ...section, items: section.items.map((item) =>
    item.id === 'notifications' ? { ...item, badge: unread.data?.unreadCount ?? 0 } : item) })), [unread.data?.unreadCount]);

  return (
    <AppShell
      brand={{ name: ctx.studio.name, logoUrl: ctx.studio.branding.logoUrl, context: 'Artist portal', homeHref: base }}
      sections={sections}
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
