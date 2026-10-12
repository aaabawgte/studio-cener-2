# Studio Cener 2.0 — faza 1: temelj

Status: završeno 12. listopada 2026.

## Rezultat faze

- npm workspaces monorepo s odvojenim `web`, `api`, `ui` i `contracts` paketima
- responzivni owner i artist shell, premium dizajn tokeni i dostupne UI komponente
- Hono Worker s jedinstvenim formatom pogreške, sigurnosnim headerima, request ID-em i strukturiranim logiranjem
- lokalni D1 binding i SQLite Durable Object temelj za buduću booking koordinaciju
- Zod ugovori koje dijele frontend i backend
- lokalni Vite proxy prema Workeru
- ESLint s pravilom protiv floating promisea, strogi TypeScript i GitHub Actions CI
- Pages SPA routing i osnovni sigurnosni headeri

## Lokalni razvoj

Preduvjet je Node verzija iz `.nvmrc`.

```sh
npm install
npm run dev:api
npm run dev
```

Web radi na Vite adresi, a `/api` se u developmentu prosljeđuje lokalnom Workeru na portu 8787. Lokalni D1 i Durable Object podaci ostaju u `.wrangler` direktoriju i nisu u Gitu.

## Provjere

```sh
npm run check
```

Provjera uključuje TypeScript za sve workspace pakete, ESLint, Worker integracijske testove, Vite produkcijski build i Wrangler dry-run build.

Završna provjera faze:

- typecheck: prolazi za sva četiri workspace paketa
- lint: prolazi bez upozorenja
- testovi: 3/3 Worker integracijska testa prolaze; provjereni su D1 health, DO SQLite inicijalizacija i format 404 pogreške
- build: prolaze Vite production build i Wrangler deploy dry-run
- dependency audit: 0 poznatih ranjivosti
- lokalno: potvrđeni direktni API i Vite proxy odgovori; owner shell vizualno provjeren na desktopu i 375 px, uključujući drawer, Escape i stabilni bottom nav
- Worker startup profil: 9,1 ms aktivnog lokalnog startup vremena; rezultat služi za usporedbu, ne kao produkcijski SLA

## Cloudflare resursi

`apps/api/wrangler.jsonc` namjerno ne sadrži remote D1 ID ni tajne. Prije prvog staging deploya treba kreirati zasebnu staging D1 bazu, povezati njezin identifikator kroz environment konfiguraciju te postaviti tajne interaktivno kroz Wrangler ili GitHub secrets. Produkcijski resursi moraju biti odvojeni od staginga.

## Rizici i otvorene odluke

- Git remote, GitHub repozitorij i Cloudflare staging resursi još ne postoje, pa je CI definiran, ali nije izvršen na GitHub runneru i nije napravljen remote deploy.
- Trenutačne owner/artist stranice izvan shella su namjerni placeholderi; poslovni moduli ulaze u kasnije faze.
- Better Auth i stvarni viewer context ulaze u fazu 2. Development mock je ograničen na Vite DEV build.
- D1 poslovna shema nije dodana u ovoj fazi; to je dio tenant i auth migracija u fazi 2.

## Sljedeći konkretni korak

Faza 2: Better Auth, početna D1 shema, studio resolver, memberships, backend role/action provjere i negativni cross-tenant integracijski testovi.
