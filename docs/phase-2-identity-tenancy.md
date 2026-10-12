# Studio Cener 2.0 — faza 2: identitet i tenant izolacija

Status: završeno 12. listopada 2026.

## Što je napravljeno

- Better Auth 1.7 s nativnim Cloudflare D1 adapterom i e-mail/lozinka prijavom
- auth tablice `user`, `session`, `account` i `verification`
- početne poslovne tablice `studios`, `memberships` i append-only `audit_logs`
- backend studio resolver po slugu; klijentski `studio_id` nije autoritet
- aktivno članstvo kao izvor uloge `owner`, `manager` ili `artist`
- eksplicitna role/permission mapa na backendu
- `/api/studios/:slug/viewer-context` s 401, 403 i 404 granicama
- prijava i registracija na `/prijava` i `/registracija`
- integracijski test koji dokazuje da session člana studija A ne može dohvatiti studio B

## Role matrica za sadašnji opseg

| Ovlast | owner | manager | artist |
| --- | --- | --- | --- |
| Pregled i upravljanje terminima | da | da | ne |
| Kalendar, usluge i radno vrijeme | da | da | ne |
| Tim i portfolio | da | da | ne |
| Analitika | da | da | ne |
| Postavke studija | da | ne | ne |

Artist dobiva zasebne self-service akcije u booking fazi. Manager matrica ostaje eksplicitna po akciji i može se suziti prije CRUD implementacije.

## Lokalno pokretanje

Kopirati `apps/api/.dev.vars.example` u ignorirani `apps/api/.dev.vars` i generirati nasumični `BETTER_AUTH_SECRET` od najmanje 32 znaka. Zatim:

```sh
npx wrangler d1 migrations apply studio-cener-local --local --config apps/api/wrangler.jsonc
npm run dev:api
npm run dev
```

`AUTH_BASE_URL` je kanonska adresa API-ja, a `TRUSTED_ORIGINS` je eksplicitna lista dopuštenih frontend origin adresa. Produkcijska auth tajna ide kroz `wrangler secret put BETTER_AUTH_SECRET`, nikada u Git.

## Kako testirati

```sh
npm run check
```

Integracijski test pokriva stvarni Better Auth signup, session cookie, dohvat vlastitog studija i odbijanje drugog tenanta.

## Rizici i otvorene odluke

- E-mail verifikacija i reset lozinke trebaju Resend outbox iz faze 5; do tada te tokove ne izlažemo kao lažno završene.
- Kreiranje studija i poziv članova još nema proizvodni UI. Seed/bootstrap postupak ulazi uz owner onboarding.
- Manager trenutno može upravljati operativnim sadržajem, ali ne i postavkama studija. Matricu treba potvrditi prije nego te akcije postanu dostupne.
- Remote D1, staging secrets i deploy nisu napravljeni jer Cloudflare/GitHub resursi još nisu povezani.

## Sljedeći konkretni korak

Faza 3: javni profil studija te owner CRUD za usluge, cijene i radno vrijeme, uz audit zapise i stvarne mobile prikaze.
