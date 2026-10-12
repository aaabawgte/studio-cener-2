# Studio Cener 2.0 — faza 0

Datum: 12. listopada 2026. Status: prijedlog za implementaciju, bez promjene aplikacijskog koda.

## Audit

- `/Users/bruno/Desktop/studio10` je prazan direktorij: nema Git repozitorija, izvornog koda, testova, konfiguracije ni deploymenta. Zato nema postojećeg stanja koje se može typecheckati, lintati ili testirati.
- Projekt je potpuno greenfield. Stari projekti, uključujući pronađeni `/Users/bruno/Desktop/lyfe/studio_rezervacija`, nisu referenca za funkcionalnosti, UX, arhitekturu, kod ni podatkovni model i neće se dalje analizirati ili koristiti.
- Ne postoji plan migracije starog koda ili podataka. Svi zahtjevi, korisnički tokovi i tehničke odluke definiraju se izravno za Studio Cener 2.0.

## Arhitektura

```text
Browser / mobile
  -> Cloudflare Pages (Vite React SPA, tenant tema i javna/owner sučelja)
  -> Cloudflare Worker (Hono API, Better Auth, tenant resolver, RBAC, validacija)
       -> D1 (poslovni podaci i auth tablice)
       -> Durable Object po studio_id + bookable_resource_id (koordinacija pisanja)
       -> R2 (privatni originali, kontrolirano izdavanje slika)
       -> Resend (transakcijski e-mail kroz pouzdan outbox)
       -> Sentry (frontend i Worker pogreške, bez PII u eventima)
```

Jedan TypeScript monorepo s odvojenim frontend i API deployem. U početku javni URL `/s/:slug`, owner URL `/app/:slug`, platform admin zaseban `/platform`. API prihvaća tenant iz verificiranog sluga/hosta, ali na svakom pozivu provjerava članstvo i `studio_id`; klijentski `studio_id` nikada nije autoritet. Kasnije custom hostnames preko posebnog routing sloja; Pages ne podržava wildcard custom domain izravno. Admin ne dobiva automatski poslovne ovlasti nad tenantom: support pristup je eksplicitan, vremenski ograničen i auditiran.

Globalni `users` i Better Auth `sessions/accounts/verifications` predstavljaju identitet. `memberships` je izvor studio uloga (`owner`, `manager`, `artist`); globalna `platform_admin` oznaka je zasebna privilegija s posebnim upravljanjem. `team_members` su javni profili, `user_id` opcionalan. Manager ovlasti se definiraju po akciji, ne generičkim `isOwner` booleanom. Svaki poslovni upit filtrira po `studio_id`, a svi studio foreign keyevi koriste složeni `(studio_id, id)` par gdje je izvedivo. Negativni testovi za pristup između tenantâ su obvezni.

Booking protokol: API validira identitet, uslugu, pravila rada, blokade i lokalno vrijeme studija te pretvara interval u UTC. Jedinica rezerviranja je `bookable_resource` (u prvom izdanju jedan prostor po studiju). Sva pisanja rezervacija i blokada idu kroz isti DO za `(studio_id, resource_id)`. D1 `slot_claims` tablica s `UNIQUE(studio_id, resource_id, slot_start_utc)` za diskretne korake od 15 minuta konačna je zaštita od preklapanja, uključujući istodobne zahtjeve i ponovne pokušaje. Korak i trajanje usluge moraju biti višekratnici 15 minuta; eventualna promjena granularnosti traži migraciju. Jedna atomska D1 batch operacija kreira/mijenja booking, claimove, `booking_events` i outbox zapis; pogreška claim unosa vraća 409. DO nije jedina sigurnosna barijera. Rezervacije bez kraja ili preko ponoći podržavaju se UTC intervalom, a DST nepostojeća/dvostruka lokalna vremena se odbijaju ili eksplicitno razrješavaju prije potvrde. Cijena se računa server-side u najmanjoj jedinici valute i sprema uz `currency`, trajanje i naziv/ID usluge kao snapshot. Svaki zahtjev za mutaciju ima idempotency key i autorizirani actor.

Financijske stavke: platforma nema online naplatu niti payment provider. `credit_ledger` je append-only; nema izravnog ažuriranja salda bez ledger zapisa. `package_balances` je materijalizirani saldo koji se mijenja atomskim batchom s pripadnim zapisom i provjerom da saldo ne postane negativan. Promo redemptions imaju jedinstvenu vezu na booking i provjeru limita pri upisu. Prepaid kredite, pakete i evidentirane uplate dodjeljuje ovlašteni owner ili manager, uz obavezan razlog, autora promjene i audit zapis. Sustav ne pohranjuje podatke platnih kartica i ne nudi checkout.

E-mail: zapis u `notifications`/outbox nastaje u istom D1 batchu kao poslovni događaj, zatim ga asinkroni Worker obrađuje s retryjem i idempotentnim provider ključem gdje je dostupan. Slanje e-maila nikada ne odlučuje uspjeh booking transakcije. R2: privatni bucket, validacija MIME/veličine i tenant prefiks ključa; javne slike idu kroz API/proxy s kontrolom objave. Secret values samo u Cloudflare secrets/GitHub secrets; odvojena staging i produkcijska okruženja.

## Predložena struktura

```text
studio10/
  apps/
    web/                  # Vite React, Tailwind, dostupne komponente, rute i tema
    api/                  # Hono Worker, auth, RBAC, moduli i DO klasa
  packages/
    contracts/            # Zod DTO i dijeljeni tipovi; bez poslovne autorizacije
    domain/               # čiste funkcije: cijene, vrijeme, booking pravila
    ui/                   # komponente i dizajn tokeni
  db/
    migrations/           # verzionirane D1 SQL migracije
    schema/               # Drizzle shema i relacije
  tests/
    integration/          # Worker + D1/DO, tenant i concurrency testovi
    e2e/                  # javni booking i owner mobile tokovi
  docs/
    architecture/         # odluke, role matrix, migracija, runbook
  .github/workflows/      # CI, staging, production release
```

## D1 schema plan

Konvencije: ID = UUID/ULID tekst; vrijeme = UTC ISO-8601 ili epoch ms dosljedno kroz cijelu shemu; novac = integer minor units; sve studio tablice imaju `studio_id NOT NULL`, `created_at`, `updated_at` gdje ima smisla; FK i `CHECK` ograničenja u migracijama; indeks počinje `studio_id` za tenant upite. Soft delete/arhiva za zapis koji čini audit ili financijski trag. `users` je globalna tablica, pa nema `studio_id`.

| Tablica | Glavna polja i ograničenja |
| --- | --- |
| `studios` | `id`, jedinstveni `slug`, `name`, `timezone` (IANA), `currency`, `status`, branding, kontakt, politike rezerviranja |
| `users` | Better Auth identitet, jedinstveni normalizirani e-mail, `platform_role`; bez tenant poslovnih podataka |
| `memberships` | `studio_id`, `user_id`, `role`, `status`; `UNIQUE(studio_id,user_id)` |
| `services` | `studio_id`, naziv, `duration_minutes`, `price_minor`, `currency`, status, kapacitet/booking pravila |
| `availability_rules` | `studio_id`, `resource_id`, dan u tjednu, lokalni interval, datum valjanosti |
| `blocked_slots` | `studio_id`, `resource_id`, UTC početak/kraj, razlog, actor |
| `bookings` | `studio_id`, `resource_id`, `artist_user_id`, `service_id`, UTC početak/kraj, status, snapshot usluge/trajanja/cijene/valute, promo i financijski iznosi, verzija, idempotency key |
| `booking_events` | `studio_id`, `booking_id`, actor, vrsta, `before/after` ili strukturirani payload, vrijeme; append-only |
| `hour_packages` | `studio_id`, naziv, sati/minute, cijena, valjanost, status |
| `package_balances` | `studio_id`, `user_id`, `package_id`, `remaining_minutes`, `expires_at`, `CHECK >= 0`; povijest potrošnje kroz booking/event i zasebne transakcije paketa u kasnijoj migraciji |
| `credit_ledger` | `studio_id`, `user_id`, signed `amount_minor`, `currency`, `kind`, `reason`, `actor_user_id`, `booking_id`, `idempotency_key`; append-only |
| `promo_codes` | `studio_id`, jedinstveni kod unutar studija, tip/vrijednost, vremenski prozor, limit, status |
| `promo_redemptions` | `studio_id`, `promo_code_id`, `booking_id`, `user_id`, iznos; jedinstveni booking/kod par |
| `waitlist_entries` | `studio_id`, `user_id`, `service_id`, željeni UTC rasponi, status, prioritet, vrijeme isteka |
| `team_members` | `studio_id`, opcionalni `user_id`, ime, opis, redoslijed, javna slika R2 key, status |
| `portfolio_projects` | `studio_id`, opcionalni `team_member_id`, naslov, opis, medijski R2 keyevi, redoslijed, objava |
| `notifications` | `studio_id`, `user_id`, kanal, template, payload, status, attempts, next_attempt_at, provider_id, idempotency key |
| `audit_logs` | `studio_id`, actor, action, entity, entity_id, redacted diff, vrijeme, request ID; append-only |

Dodatne nužne tablice: Better Auth `sessions`, `accounts`, `verifications`; `bookable_resources`; `slot_claims`; `studio_domains` kad stignu custom domene; `package_ledger` prije prve potrošnje paketa radi provjerljivog povijesnog salda. Globalni admin audit može imati zasebnu tablicu jer studio audit uvijek mora imati `studio_id`.

Ključni indeksi: `bookings(studio_id,resource_id,start_at_utc)`, `bookings(studio_id,artist_user_id,start_at_utc)`, `booking_events(studio_id,booking_id,created_at)`, `slot_claims` unique gore, `availability_rules(studio_id,resource_id,weekday)`, `notifications(status,next_attempt_at)`, `credit_ledger(studio_id,user_id,created_at)`, `waitlist_entries(studio_id,status,created_at)`. Nema oslanjanja samo na indeks za izolaciju: aplikacijski upiti uvijek uključuju `studio_id`.

## Faze i izlazni kriteriji

0. **Audit i plan** — ovaj dokument; potvrditi hostnames i preostala pravila proizvoda prije odgovarajućih faza. Projekt je greenfield, bez oslanjanja na stari kod i bez online naplate.
1. **Temelj** — Git repo, monorepo, Vite/Worker/Hono, Tailwind i UI tokeni, lint/typecheck/test CI, lokalni D1/DO, staging, osnovni `/health`; nema booking funkcije. Gate: reproducibilan clean install i zeleni CI.
2. **Identitet i tenancy** — Better Auth, studio resolver, članstva, role matrix, D1 migracije i izolacijski testovi. Gate: cross-tenant pokušaji vraćaju 403/404.
3. **Javni studio i owner osnova** — brandirane stranice, service/radno vrijeme, owner mobile shell s fiksnim bottom nav redom i drawerom, CRUD s auditom. Gate: dostupna tipkovnicom i čitljiva na mobilnom.
4. **Booking engine** — availability, blokade, DO, D1 slot claims, snapshot, event log, idempotency. Gate: istodobni pokušaji za isti slot daju točno jednu rezervaciju; DST i promjene statusa testirane.
5. **Komunikacije i sadržaj** — R2 team/portfolio, Resend outbox, status obavijesti, waitlist. Gate: retry ne šalje duplikate i objava ne otkriva privatne objekte.
6. **Vrijednost i promocije** — ručno dodijeljeni paketi i krediti, package ledger/balance, credit ledger, promo kodovi te pravila korekcije i povrata pri otkazivanju. Gate: saldo se rekonstruira iz ledger zapisa, ne može postati negativan i svaka promjena ima ovlaštenog autora i razlog.
7. **Analitika i operativa** — owner KPI, platform admin, Sentry, backup/restore vježba, rate limits, sigurnosna provjera, pristupačnost, load test, produkcijski rollout. Gate: runbook, rollback i release checklist odobreni.

Svaka faza završava popisom promijenjenih datoteka, načinom testiranja, rizicima/odlukama i jednim sljedećim korakom. Review nalazi razmatraju se po dokazu i utjecaju; mijenja se samo ono što je opravdano i provjereno.

## Otvorene odluke

1. Trebaju li u prvom izdanju vlastite domene studija ili je brandirani `/s/:slug` dovoljan za pilot? Custom hostnames traže dodatni DNS/certifikat/routing postupak.
2. Mogu li studiji imati više rezervabilnih soba/resursa od prvog dana? Shema je spremna, UI i pravila mogu početi s jednim.
3. Koja su točna manager prava i pravila otkazivanja/povrata kredita? Dokumentirati role/action matricu prije faza 2 i 6.

## Izvori za tehničke odluke

- Cloudflare D1 foreign keys: https://developers.cloudflare.com/d1/sql-api/foreign-keys/
- Cloudflare Durable Objects seat booking: https://developers.cloudflare.com/durable-objects/tutorials/build-a-seat-booking-app/
- Cloudflare Pages wildcard custom domain ograničenje: https://developers.cloudflare.com/pages/platform/known-issues/
- Better Auth D1 podrška: https://better-auth.com/blog/1-5
- Better Auth Drizzle adapter: https://better-auth.com/docs/adapters/drizzle
- Resend na Cloudflare Workers: https://resend.com/cloudflare
