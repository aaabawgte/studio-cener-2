# Studio Cener 2.0

White-label booking platforma za recording studije, izgrađena kao TypeScript monorepo za Cloudflare.

## Workspace

- `apps/web` — React, Vite i Tailwind frontend
- `apps/api` — Hono API na Cloudflare Workersima
- `packages/ui` — zajednički dizajn sustav i dostupne UI komponente
- `packages/contracts` — Zod API ugovori i dijeljeni tipovi
- `db/migrations` — verzionirane D1 migracije

## Lokalni razvoj

```sh
npm install
npm run dev:api
npm run dev
```

Pokreni API i web u odvojenim terminalima. Web prosljeđuje development zahtjeve s `/api` na lokalni Worker.

## Provjera kvalitete

```sh
npm run check
```

Detalji faze nalaze se u [dokumentaciji temelja](docs/phase-1-foundation.md).
