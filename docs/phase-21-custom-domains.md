# Faza 21 — vlastite domene studija

## Što je napravljeno

- Platform admin može spremiti ili promijeniti glavnu domenu svakog studija na `/platform`.
- Domena dobiva status **Čeka povezivanje**, **Aktivna** ili **Provjera nije uspjela**.
- Nakon dodavanja domene na Cloudflare Pages projekt, platform admin pokreće stvarnu HTTPS provjeru. Domena se aktivira samo ako vraća produkcijski Studio Cener API health odgovor.
- Otvaranje aktivne vlastite domene na početnoj adresi prikazuje javnu stranicu pripadajućeg studija.
- Registracija i prijava prihvaćaju samo aktivne HTTPS domene aktivnih studija s važećom licencom.
- Ista provjera licence vrijedi i za javno razrješavanje domene.
- Spremanje i svaka uspješna ili neuspješna provjera domene zapisuju se u audit log.
- Domena je jedinstvena u cijeloj platformi i ne može se dodijeliti dvama studijima.

## Promijenjene datoteke

- `packages/contracts/src/index.ts`
- `apps/api/src/auth.ts`
- `apps/api/src/platform/routes.ts`
- `apps/api/src/index.ts`
- `apps/api/test/worker.test.ts`
- `apps/web/src/features/platform/platform-api.ts`
- `apps/web/src/routes/Home.tsx`
- `apps/web/src/routes/public/PublicStudioPage.tsx`
- `apps/web/src/routes/platform/PlatformPage.tsx`

## Kako testirati

1. U Cloudflare Pages projektu `studio-cener-2` dodati kupljenu domenu pod **Custom domains** i pričekati aktivan SSL.
2. Na `/platform` uz željeni studio upisati istu domenu i kliknuti **Spremi**.
3. Kliknuti **Provjeri**. Status mora postati **Aktivna**.
4. Otvoriti `https://<domena>` i potvrditi da se na početnoj adresi prikazuje javna stranica tog studija.
5. Registrirati artista preko te domene i dovršiti rezervaciju.
6. Pokrenuti `npm run check`.

Automatski test provjerava promjenu domene, tenant razrješavanje, odbijanje nepoznate domene i Better Auth registraciju s aktivne vlastite domene.

## Rizici i otvorene odluke

- Dodavanje kupljene domene u Cloudflare Pages zasad se radi kroz Cloudflare dashboard. Aktivacija unutar aplikacije namjerno ne glumi taj korak, nego provjerava stvarni DNS, TLS i API odgovor.
- Nakon prijave artist portal koristi postojeće `/s/<slug>/me/...` putanje na istoj domeni. Čiste white-label putanje bez sluga mogu se uvesti kao zasebna routing faza.

## Sljedeći korak

Uvesti produkcijski hardening: rate limiting za javne i auth rute, Sentry praćenje grešaka te dokumentiran backup i restore postupak za D1 i R2.
