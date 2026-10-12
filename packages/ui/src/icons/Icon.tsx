import type { SVGProps } from 'react';

/**
 * Mali, vlastiti set linijskih ikona (24×24, stroke 1.5) — bez dodatne ovisnosti.
 * Ikone su dekorativne (aria-hidden) osim ako se preda `title`.
 */
const paths = {
  menu: <path d="M4 7h16M4 12h16M4 17h10" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  home: (
    <>
      <path d="M4 10.5L12 4l8 6.5" />
      <path d="M6 9v10h12V9" />
      <path d="M10 19v-5h4v5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  bookings: (
    <>
      <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" />
      <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  services: (
    <>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 19.5c.8-3.3 3.4-5 6.5-5s5.7 1.7 6.5 5" />
      <path d="M15.5 5.2a3.5 3.5 0 010 6.6M18 14.8c1.7.7 3 2.3 3.5 4.7" />
    </>
  ),
  portfolio: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.75" />
      <path d="M20.5 15.5l-4.5-4.5-8.5 8.5" />
    </>
  ),
  chart: <path d="M4 20V4M4 20h16M8.5 16v-5M12.5 16V8M16.5 16v-3" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.75v2.5M12 18.75v2.5M21.25 12h-2.5M5.25 12h-2.5M18.54 5.46l-1.77 1.77M7.23 16.77l-1.77 1.77M18.54 18.54l-1.77-1.77M7.23 7.23L5.46 5.46" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 1112 0v5.5l1.5 1.5h-15L6 16.5z" />
      <path d="M10 20.5a2 2 0 004 0" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c1-3.7 4-5.5 7.5-5.5s6.5 1.8 7.5 5.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  chevronRight: <path d="M9.5 6l6 6-6 6" />,
  chevronLeft: <path d="M14.5 6l-6 6 6 6" />,
  chevronDown: <path d="M6 9.5l6 6 6-6" />,
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5.5" />
      <circle cx="12" cy="16.25" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.75" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  success: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8 12.5l2.75 2.75L16 10" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.25-4.25" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4.5h3.5a2 2 0 012 2v11a2 2 0 01-2 2H14" />
      <path d="M10 8l-4 4 4 4M6 12h9.5" />
    </>
  ),
  ticket: (
    <>
      <path d="M3.5 8a2 2 0 002-2h13a2 2 0 002 2v2a2 2 0 000 4v2a2 2 0 00-2 2h-13a2 2 0 00-2-2v-2a2 2 0 000-4V8z" />
      <path d="M14 7v10" strokeDasharray="1.5 2" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7.5A2.5 2.5 0 016.5 5H18v3" />
      <rect x="4" y="8" width="16.5" height="11" rx="2.5" />
      <circle cx="16" cy="13.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  hourglass: <path d="M7 3.5h10M7 20.5h10M8 3.5c0 4 8 5 8 8.5s-8 4.5-8 8.5M16 3.5c0 4-8 5-8 8.5s8 4.5 8 8.5" />,
  sparkle: <path d="M12 3.5l1.6 5.2a2 2 0 001.3 1.3l5.1 1.5-5.1 1.6a2 2 0 00-1.3 1.3L12 19.5l-1.6-5.1a2 2 0 00-1.3-1.3L4 11.5l5.1-1.5a2 2 0 001.3-1.3L12 3.5z" />,
  external: (
    <>
      <path d="M14 4.5h5.5V10M19.5 4.5L11 13" />
      <path d="M17.5 14v4a2 2 0 01-2 2h-9a2 2 0 01-2-2V9a2 2 0 012-2h4" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 13.5l2.2-7.1A2 2 0 018.1 5h7.8a2 2 0 011.9 1.4l2.2 7.1" />
      <path d="M4 13.5V17a2 2 0 002 2h12a2 2 0 002-2v-3.5h-4.5l-1 2h-5l-1-2H4z" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3.5" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v2.5" />
    </>
  ),
} as const;

export type IconName = keyof typeof paths;

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  name: IconName;
  size?: number;
  /** Ako je zadano, ikona postaje dostupna čitačima ekrana. */
  title?: string;
};

export function Icon({ name, size = 20, title, strokeWidth = 1.5, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {paths[name]}
    </svg>
  );
}

export const iconNames = Object.keys(paths) as IconName[];
