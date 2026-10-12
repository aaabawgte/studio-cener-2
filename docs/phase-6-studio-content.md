# Faza 6 — owner postavke, tim, portfolio i slike

Datum završetka: 12. 10. 2026.

## Napravljeno

- owner postavke za naziv, opis, adresu, brand boju i logo
- zasebni tenant modeli `team_members` i `portfolio_projects`, oba obavezno vezana uz `studio_id`
- owner i manager uređivanje tima i portfolija prema backend dozvolama
- privatni Cloudflare R2 bucket za logo, fotografije tima i naslovne slike projekata
- provjera veličine, deklariranog tipa i potpisa JPG, PNG i WebP datoteka prije spremanja
- R2 ključevi izolirani po studiju i sadržaju
- javni media endpointi koji ne otkrivaju skrivenog člana tima ni neobjavljeni projekt
- javna studio stranica s logom, timom i objavljenim portfoliom
- audit zapisi za svaku promjenu sadržaja i upload slike
- demo sadržaj za tim i portfolio

## API

- `GET|PUT /api/studios/:slug/settings`
- `POST /api/studios/:slug/logo`
- `GET|POST /api/studios/:slug/team-members`
- `PUT /api/studios/:slug/team-members/:memberId`
- `POST /api/studios/:slug/team-members/:memberId/image`
- `GET|POST /api/studios/:slug/portfolio-projects`
- `PUT /api/studios/:slug/portfolio-projects/:projectId`
- `POST /api/studios/:slug/portfolio-projects/:projectId/image`
- javne read-only rute za logo i objavljene slike

## Sigurnost

- sve owner rute ponovno provjeravaju session, membership, studio i konkretnu dozvolu na API-ju
- owner jedini ima `studio.settings.manage`; manager može uređivati tim i portfolio
- svaki D1 upit za sadržaj uključuje `studio_id`
- bucket nije javno izložen; API provjerava status studija i sadržaja prije čitanja objekta
- SVG i proizvoljne datoteke nisu dopuštene
- zamjena slike prvo sigurno spremi novu datoteku, ažurira D1, a zatim briše staru

## Provjera

```sh
npx wrangler d1 migrations apply studio-cener-local --local --config apps/api/wrangler.jsonc
npm run check
```

Integracijski test pokriva postavke, aktivne i skrivene članove, objavljene i draft projekte, upload PNG slike u R2, javno čitanje slike i tenant izolaciju.

## Otvoreno

- slike se trenutno ne obrađuju u više veličina; za veći promet treba dodati Cloudflare Images ili kontrolirani image transform sloj
- premještanje sadržaja trenutačno koristi brojčani `sortOrder`; drag and drop sučelje može se dodati naknadno

## Sljedeći korak

Članovi tima s loginom i manager pozivnicama, pa sustav paketa sati i kreditni ledger.
