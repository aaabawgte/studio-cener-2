import type { CSSProperties } from 'react';

type Rgb = { r: number; g: number; b: number };

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function parseHex(input: string): Rgb | null {
  const match = HEX.exec(input.trim());
  if (!match) return null;
  let hex = match[1]!;
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const value = Number.parseInt(hex, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const CANVAS: Rgb = { r: 0xf6, g: 0xf3, b: 0xee };
const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const INK: Rgb = { r: 0x1d, g: 0x1b, b: 0x18 };

export type AccentThemeResult = {
  style: CSSProperties;
  /** false = boja studija nema dovoljan kontrast pa se koristi zadani akcent. */
  applied: boolean;
};

/**
 * Pretvara brand boju studija u CSS varijable. Ako boja nema barem 4.5:1
 * kontrast prema pozadini (tekst/linkovi u akcentu), zadržava se zadani akcent —
 * white-label ne smije srušiti čitljivost.
 */
export function createAccentTheme(hex: string | null | undefined): AccentThemeResult {
  const rgb = hex ? parseHex(hex) : null;
  if (!rgb || contrastRatio(rgb, CANVAS) < 4.5) return { style: {}, applied: false };

  const color = `rgb(${rgb.r} ${rgb.g} ${rgb.b})`;
  const fg = contrastRatio(rgb, WHITE) >= 4.5 ? '#fffdf9' : `rgb(${INK.r} ${INK.g} ${INK.b})`;
  const style = {
    '--color-accent': color,
    '--color-accent-strong': `color-mix(in oklab, ${color} 78%, black)`,
    '--color-accent-soft': `color-mix(in oklab, ${color} 12%, var(--color-canvas))`,
    '--color-accent-fg': fg,
  } as CSSProperties;
  return { style, applied: true };
}
