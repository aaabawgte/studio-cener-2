# @studio/ui

Design system za Studio Cener 2.0 ("quiet luxury"): tokeni, Tailwind v4 tema i dostupne React komponente.

## Upotreba

```css
/* apps/web/src/index.css */
@import "tailwindcss";
@import "@studio/ui/styles.css";
@source "../../../packages/ui/src";
```

```tsx
import { Button, Field, Input, Modal, useToast } from '@studio/ui';
```

Katalog svih komponenti: `npm run dev` → `/_ui` (samo dev build).

## Pravila

- Samo semantičke boje: `canvas`, `surface`, `raised`, `sunken`, `line`, `ink`, `ink-muted`, `ink-subtle`, `accent*`, `success|warning|danger|info(-soft)`. Tailwind default paleta je isključena.
- Naslovi (`h1–h3`) automatski koriste `font-display` (Fraunces, lagana težina); tekst je Instrument Sans.
- Svi parovi tekst/pozadina su ≥ 4.5:1 (WCAG AA). Tenant akcent prolazi kroz `createAccentTheme()`, koji odbija boje s nedovoljnim kontrastom.
- Kontrole su visoke 44 px; inputi na mobitelu imaju 16 px font (bez iOS zooma).
- Animacije su kratke (200–320 ms, `ease-soft`) i gase se uz `prefers-reduced-motion`.

## Komponente

| Komponenta | Namjena |
| --- | --- |
| `Button`, `IconButton`, `buttonStyles()` | akcije; `buttonStyles` za linkove koji izgledaju kao gumb |
| `Field` + `Input` / `Textarea` / `Select` / `Checkbox` | forme; `Field` automatski veže label, hint, grešku i ARIA atribute |
| `useForm` | client validacija + server greške (`{ message, fieldErrors }`) |
| `Card`, `CardHeader`, `CardFooter`, `Stat` | površine i KPI |
| `PageHeader`, `SectionHeader` | naslovi stranica/sekcija; akcije pune širine na mobitelu |
| `DataList` | tablica ≥ md, kartice < md, klikabilni redak dostupan tipkovnicom |
| `Modal`, `ConfirmDialog`, `Drawer` | overlayi s focus trapom, Esc, scroll lockom; Modal je bottom sheet < 640 px |
| `DropdownMenu` | menu button sa strelicama, Home/End, Esc |
| `ToastProvider`, `useToast` | obavijesti (polite/assertive live regije) |
| `AsyncState`, `LoadingState`, `EmptyState`, `ErrorState`, `Alert`, `Skeleton` | sva async stanja |
| `Badge`, `Avatar`, `Icon`, `Spinner` | sitni elementi; ikone su vlastiti SVG set bez ovisnosti |
