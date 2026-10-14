# Studio Cener 2.0

White-label booking platforma za recording studije, izgrađena kao TypeScript monorepo za Cloudflare.

## Produkcija

- Web: https://studio-cener-2.pages.dev
- API health: https://studio-cener-2.pages.dev/api/health

Cloudflare Pages Functions prosljeđuje `/api/*` na Worker unutar istog javnog origina kako bi Better Auth session cookie radio bez cross-site ograničenja preglednika. Produkcija koristi zasebnu D1 bazu i konfiguraciju `apps/api/wrangler.production.jsonc`; `BETTER_AUTH_SECRET` je spremljen isključivo kao Cloudflare Worker secret.

## Workspace

- `apps/web` — React, Vite i Tailwind frontend
- `apps/api` — Hono API na Cloudflare Workersima
- `packages/ui` — zajednički dizajn sustav i dostupne UI komponente
- `packages/contracts` — Zod API ugovori i dijeljeni tipovi
- `db/migrations` — verzionirane D1 migracije
- privatni R2 bucket `studio-cener-media` — logo, tim i portfolio slike

## Lokalni razvoj

```sh
npm install
npx wrangler d1 migrations apply studio-cener-local --local --config apps/api/wrangler.jsonc
npm run dev:api
npm run dev
```

Pokreni API i web u odvojenim terminalima. Web prosljeđuje development zahtjeve s `/api` na lokalni Worker.

## Provjera kvalitete

```sh
npm run check
```

Detalji završenih faza nalaze se u dokumentima [temelj](docs/phase-1-foundation.md), [identitet i tenant izolacija](docs/phase-2-identity-tenancy.md), [studio katalog](docs/phase-3-studio-catalog.md), [booking engine](docs/phase-4-booking-engine.md), [platform onboarding](docs/phase-5-platform-onboarding.md), [studio sadržaj](docs/phase-6-studio-content.md), [manager pristupi](docs/phase-7-manager-access.md), [paketi sati i prepaid kredit](docs/phase-8-value-ledger.md), [promo kodovi](docs/phase-9-promo-codes.md), [lista čekanja i obavijesti](docs/phase-10-waitlist-notifications.md), [owner analitika](docs/phase-11-owner-analytics.md), [owner početni pregled](docs/phase-12-owner-overview.md), [owner rezervacija u ime artista](docs/phase-13-managed-bookings.md), [statusi termina](docs/phase-14-booking-lifecycle.md), [detalji i povijest termina](docs/phase-15-booking-details.md), [pomicanje termina](docs/phase-16-booking-reschedule.md), [pretraga i paginacija rezervacija](docs/phase-17-booking-search-pagination.md), [paketi i prepaid kredit u rezervacijama](docs/phase-18-booking-value-usage.md), [artist početna i profil](docs/phase-19-artist-portal-profile.md), [in-app obavijesti](docs/phase-20-in-app-notifications.md) i [vlastite domene](docs/phase-21-custom-domains.md).
