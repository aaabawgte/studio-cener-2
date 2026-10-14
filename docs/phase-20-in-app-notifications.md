# Faza 20 — dovršene in-app obavijesti

## Što je napravljeno

- Artist dobiva obavijest kada je termin kreiran, otkazan, pomaknut, završen ili označen kao nedolazak.
- Otkazivanje jasno navodi da su kredit ili minute vraćeni kada je rezervacija koristila prepaid vrijednost.
- Booking promjena i pripadajuća obavijest spremaju se u istoj D1 transakciji.
- Postoje zasebne vrste obavijesti za završeni termin i nedolazak.
- Dodan je endpoint za broj nepročitanih obavijesti i akcija **Označi sve pročitano**.
- Broj nepročitanih prikazuje se uz Obavijesti u desktop navigaciji, draweru i mobilnom bottom navigationu.
- Badge se osvježava pri promjeni rute te odmah nakon čitanja ili otkazivanja termina.
- Ispravljen je lifecycle rezultata kod Durable Object RPC prosljeđivanja kako RPC resursi ne bi ostajali nedisponirani.

## Promijenjene datoteke

- `db/migrations/0014_booking_notification_types.sql`
- `packages/contracts/src/index.ts`
- `apps/api/src/durable-objects/booking-coordinator.ts`
- `apps/api/src/durable-objects/value-coordinator.ts`
- `apps/api/src/notifications/routes.ts`
- `apps/api/src/index.ts`
- `apps/api/test/worker.test.ts`
- `apps/web/src/features/waitlist/waitlist-api.ts`
- `apps/web/src/routes/artist/ArtistLayout.tsx`
- `apps/web/src/routes/artist/NotificationsPage.tsx`
- `apps/web/src/routes/bookings/BookingsPage.tsx`
- `apps/web/src/shell/nav.ts`
- `apps/web/src/shell/NavLinkItem.tsx`
- `apps/web/src/shell/BottomNav.tsx`

## Kako testirati

1. Kreirati termin kao artist ili u ime artista.
2. Otvoriti artist portal i provjeriti badge uz **Obavijesti**.
3. Pomaknuti, otkazati ili završiti termin kao owner i provjeriti novu artist obavijest.
4. Otvoriti **Obavijesti**, označiti pojedinu ili sve obavijesti pročitanima i provjeriti da badge nestaje.
5. Pokrenuti `npm run check`.

Automatski test provjerava kreiranje booking obavijesti, završetak termina, broj nepročitanih, bulk čitanje i da ponovljena booking radnja ne duplicira obavijest.

## Rizici i otvorene odluke

- In-app obavijesti vide se nakon ulaska u portal; push i e-mail obavijesti nisu uključene.
- Lista trenutačno prikazuje zadnjih 100 obavijesti. Cursor paginaciju možemo dodati kada stvarna količina podataka to opravda.

## Sljedeći korak

Povezati stvarne custom domene kroz Cloudflare for SaaS i zatim provesti production hardening: rate limiting, Sentry i backup/restore postupak.
