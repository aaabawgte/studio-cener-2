# Faza 18 — paketi i prepaid kredit u rezervacijama

## Što je napravljeno

- Artist te owner ili manager pri kreiranju termina mogu odabrati prepaid kredit, aktivni paket sati ili rezervaciju bez korištenja vrijednosti.
- Backend ponovno provjerava vlasništvo, status, istek i raspoložive minute paketa te stanje kredita u valuti studija.
- Kreiranje rezervacije, zauzimanje termina i potrošnja kredita ili minuta izvršavaju se u jednoj D1 transakciji.
- `ValueCoordinator` serijalizira sve promjene vrijednosti za jednog artista, a `BookingCoordinator` i dalje zaključava termin po resursu.
- Rezervacija čuva snapshot načina korištenja, potrošenog iznosa ili minuta i vremena eventualnog povrata.
- Otkazivanje automatski dodaje zaseban `refund` ledger zapis i vraća isti iznos ili minute samo jednom.
- Svaka automatska potrošnja i povrat imaju autora, razlog, booking vezu, idempotency ključ i audit zapis.
- Owner detalji termina prikazuju je li iskorišten kredit ili paket te je li povrat izvršen.

## Promijenjene datoteke

- `db/migrations/0013_booking_value_usage.sql`
- `packages/contracts/src/index.ts`
- `apps/api/src/durable-objects/booking-coordinator.ts`
- `apps/api/src/durable-objects/value-coordinator.ts`
- `apps/api/src/bookings/routes.ts`
- `apps/api/test/worker.test.ts`
- `apps/web/src/routes/bookings/BookingPage.tsx`
- `apps/web/src/routes/owner/CreateBookingPage.tsx`
- `apps/web/src/routes/owner/BookingDetailPage.tsx`
- `apps/web/src/mocks/bookings.ts`

## Kako testirati

1. Owner dodijeli artistu prepaid kredit ili paket sati.
2. Artist otvori **Rezerviraj termin** i u sažetku odabere kredit ili paket.
3. Nakon potvrde provjeri smanjeno stanje na stranici **Krediti i paketi**.
4. Otkaži termin i provjeri da je stanje vraćeno.
5. Ponovi otkazivanje zahtjevom i potvrdi da se povrat nije duplicirao.
6. Owner može isti tok provjeriti kroz **Nova rezervacija** i **Detalji termina**.
7. Pokrenuti `npm run check`.

Automatski test pokriva potrošnju i povrat kredita, potrošnju i povrat minuta paketa te idempotentno ponavljanje otkazivanja.

## Rizici i otvorene odluke

- Trenutačno svako valjano otkazivanje potvrđenog termina vraća potrošeni kredit ili minute. Pravilo roka za povrat možemo kasnije dodati kao postavku studija.
- Promo kod smanjuje iznos prepaid kredita koji se troši. Paket sati uvijek troši snapshot trajanja usluge.
- Oznake `completed` i `no_show` ne rade povrat.

## Sljedeći korak

Dovršiti artist portal početnu stranicu i uređivanje osnovnog profila, pa zatim povezati preostale in-app obavijesti.
