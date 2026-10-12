import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { Avatar, cn, Drawer, DropdownMenu, Icon, IconButton, type DropdownItem } from '@studio/ui';
import { BottomNav } from './BottomNav';
import { NavSections } from './NavLinkItem';
import type { NavSection } from './nav';

export type ShellBrand = {
  name: string;
  logoUrl: string | null;
  /** Mala oznaka ispod imena, npr. "Vlasnik" ili "Artist portal". */
  context: string;
  homeHref: string;
};

export type ShellViewer = { name: string; email: string; avatarUrl: string | null };

export type AppShellProps = {
  brand: ShellBrand;
  sections: NavSection[];
  base: string;
  viewer: ShellViewer;
  /** Stavke korisničkog izbornika (profil, javni profil, odjava…). */
  userMenu: DropdownItem[];
  /** Dodatni linkovi na dnu sidebara/drawera (npr. "Javni profil studija"). */
  footerLinks?: { label: string; href: string; external?: boolean }[];
  navLabel: string;
  children: ReactNode;
};

/**
 * Responzivni okvir aplikacije:
 *  - ≥ lg: fiksni sidebar lijevo, sadržaj desno
 *  - < lg: sticky top bar (hamburger → drawer) + stabilan bottom nav
 * Sadržaj nikad ne smije uzrokovati horizontalni scroll (min-w-0 svugdje).
 */
export function AppShell({ brand, sections, base, viewer, userMenu, footerLinks = [], navLabel, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const bottomItems = sections.flatMap((s) => s.items).filter((i) => i.bottomNav);

  // Zatvori drawer pri promjeni rute (npr. back gesta).
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-dvh lg:pl-[var(--shell-sidebar-w)]">
      <a
        href="#main"
        className="fixed top-2 left-2 z-[70] -translate-y-20 rounded-control bg-ink px-4 py-2 text-sm text-ink-inverse transition-transform focus:translate-y-0"
      >
        Preskoči na sadržaj
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[var(--shell-sidebar-w)] flex-col border-r border-line bg-canvas lg:flex">
        <div className="px-5 pt-7 pb-8">
          <BrandMark brand={brand} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
          <NavSections sections={sections} base={base} label={navLabel} />
          <FooterLinks links={footerLinks} />
        </div>
        <div className="border-t border-line p-3">
          <DropdownMenu
            align="start"
            placement="top"
            className="w-full"
            menuClassName="w-full"
            items={userMenu}
            trigger={(props) => (
              <button
                type="button"
                {...props}
                className="flex w-full items-center gap-3 rounded-control p-2 text-left transition-colors hover:bg-sunken/60"
              >
                <Avatar name={viewer.name} src={viewer.avatarUrl} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{viewer.name}</span>
                  <span className="block truncate text-xs text-ink-subtle">{viewer.email}</span>
                </span>
                <Icon name="more" size={18} className="shrink-0 text-ink-subtle" />
              </button>
            )}
          />
        </div>
      </aside>

      {/* Mobilni top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/88 pt-[var(--safe-top)] backdrop-blur-md lg:hidden">
        <div className="flex h-[var(--shell-topbar-h)] items-center gap-2 px-2 sm:px-4">
          <IconButton label="Otvori izbornik" onClick={() => setDrawerOpen(true)} aria-expanded={drawerOpen} aria-haspopup="dialog">
            <Icon name="menu" size={22} />
          </IconButton>
          <Link to={brand.homeHref} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control px-1 py-1">
            <Monogram brand={brand} size="sm" />
            <span className="truncate font-display text-[1.0625rem] leading-none">{brand.name}</span>
          </Link>
          <DropdownMenu
            items={userMenu}
            trigger={(props) => (
              <button type="button" {...props} aria-label="Korisnički izbornik" className="rounded-full p-1.5">
                <Avatar name={viewer.name} src={viewer.avatarUrl} size="sm" />
              </button>
            )}
          />
        </div>
      </header>

      <main id="main" tabIndex={-1} className="min-w-0 outline-none pb-[calc(var(--shell-bottomnav-h)+var(--safe-bottom)+2rem)] lg:pb-16">
        <div className="mx-auto w-full max-w-6xl min-w-0 px-4 pt-6 sm:px-6 sm:pt-8 lg:px-12 lg:pt-14">{children}</div>
      </main>

      <BottomNav items={bottomItems} base={base} label="Brza navigacija" />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Izbornik"
        hideTitle
        header={<BrandMark brand={brand} />}
        footer={
          <div className="flex items-center gap-3 px-2">
            <Avatar name={viewer.name} src={viewer.avatarUrl} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{viewer.name}</span>
              <span className="block truncate text-xs text-ink-subtle">{viewer.email}</span>
            </span>
            <DropdownMenu
              placement="top"
              items={userMenu}
              trigger={(props) => (
                <IconButton label="Korisnički izbornik" size="sm" {...props}>
                  <Icon name="more" size={18} />
                </IconButton>
              )}
            />
          </div>
        }
      >
        <div className="pt-4">
          <NavSections sections={sections} base={base} label={`${navLabel} (izbornik)`} onNavigate={() => setDrawerOpen(false)} />
          <FooterLinks links={footerLinks} />
        </div>
      </Drawer>
    </div>
  );
}

function Monogram({ brand, size = 'md' }: { brand: ShellBrand; size?: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'size-8 text-base rounded-[0.6rem]' : 'size-10 text-lg rounded-[0.75rem]';
  if (brand.logoUrl) return <img src={brand.logoUrl} alt="" className={cn(dims, 'shrink-0 object-cover')} />;
  return (
    <span aria-hidden="true" className={cn(dims, 'grid shrink-0 place-items-center bg-ink font-display text-ink-inverse')}>
      {brand.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

function BrandMark({ brand }: { brand: ShellBrand }) {
  return (
    <Link to={brand.homeHref} className="flex min-w-0 items-center gap-3 rounded-control">
      <Monogram brand={brand} />
      <span className="min-w-0">
        <span className="block truncate font-display text-[1.1875rem] leading-tight">{brand.name}</span>
        <span className="eyebrow mt-0.5 block truncate">{brand.context}</span>
      </span>
    </Link>
  );
}

function FooterLinks({ links }: { links: { label: string; href: string; external?: boolean }[] }) {
  if (links.length === 0) return null;
  return (
    <ul className="mt-6 space-y-0.5 border-t border-line pt-4">
      {links.map((link) => (
        <li key={link.href}>
          <Link
            to={link.href}
            target={link.external ? '_blank' : undefined}
            rel={link.external ? 'noreferrer' : undefined}
            className="flex h-10 items-center gap-3 rounded-control px-3 text-sm text-ink-muted transition-colors hover:bg-sunken/60 hover:text-ink"
          >
            <Icon name="external" size={18} className="shrink-0 text-ink-subtle" />
            <span className="truncate">{link.label}</span>
            {link.external ? <span className="sr-only">(otvara se u novoj kartici)</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
