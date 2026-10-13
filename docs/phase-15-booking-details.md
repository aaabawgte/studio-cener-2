# Faza 15 — detalji i povijest termina

## Što je napravljeno

- Owner i manager iz liste rezervacija mogu otvoriti zasebnu stranicu pojedinog termina.
- Detalji prikazuju artista, vrijeme, status, cijenu, promo kod i popust.
- Kronološka povijest spaja booking događaje i interne bilješke s autorom i vremenom nastanka.
- Interne bilješke su vidljive samo korisnicima s `bookings.manage` ovlasti; artist nema pristup endpointima ni stranici.
- Bilješke su append-only u D1 bazi i svako dodavanje stvara audit zapis.
- Nova tablica `booking_notes` nosi `studio_id` i vezana je za rezervaciju unutar istog studija.

## Endpointi

- `GET /api/studios/:slug/bookings/:bookingId`
- `POST /api/studios/:slug/bookings/:bookingId/notes`

## Kako testirati

1. Prijaviti se kao owner ili manager.
2. Otvoriti **Rezervacije** i odabrati **Detalji**.
3. Provjeriti podatke termina i povijest statusa.
4. Dodati internu bilješku i provjeriti da se pojavljuje u povijesti.
5. Pokrenuti `npm run check`.

Automatski test potvrđuje zabranu artistu, dohvat povijesti, dodavanje bilješke, audit zapis i zabranu izmjene postojeće bilješke.

## Rizici i otvorene odluke

- Bilješke se ne mogu uređivati ni brisati. Ispravak se radi novom bilješkom kako bi trag ostao potpun.
- Povijest zasad prikazuje vrstu promjene, autora i vrijeme. Dodatni detalji pojedinog eventa mogu se prikazati kada uvedemo promjenu termina ili usluge.

## Sljedeći korak

Dodati sigurno pomicanje postojećeg termina na drugi slobodan termin kroz isti Durable Object booking mehanizam.
