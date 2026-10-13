# Faza 13 — owner rezervacija u ime artista

## Što je napravljeno

- Owner i manager mogu otvoriti **Nova rezervacija** iz početnog pregleda ili liste rezervacija.
- Forma učitava postojeće aktivne artiste, usluge i slobodne termine studija.
- Novi endpoint zahtijeva `bookings.manage` i provjerava da odabrani korisnik ima aktivan `artist` membership u istom studiju.
- Managed booking koristi isti server-side booking engine, radno vrijeme, blokade, promo pravila, idempotency ključ i Durable Object zaključavanje kao artist booking.
- Rezervacija sprema odabranog artista, dok booking event i audit log spremaju ownera ili managera kao autora radnje.
- Owner lista rezervacija sada prikazuje ime i e-mail artista.

## Endpointi

- `GET /api/studios/:slug/booking-artists`
- `POST /api/studios/:slug/bookings/managed`

## Kako testirati

1. Prijaviti se kao owner ili manager.
2. Otvoriti **Rezervacije** i odabrati **Nova rezervacija**.
3. Odabrati artista, uslugu, datum i slobodan termin.
4. Potvrditi rezervaciju i provjeriti artista na listi termina.
5. Pokrenuti `npm run check`.

Automatski test potvrđuje da rezervacija pripada artistu i da booking event kao autora bilježi ownera.

## Rizici i otvorene odluke

- Artist mora već imati aktivan račun i membership u studiju. Kreiranje privremenih korisnika bez login računa nije uvedeno jer bi otežalo sigurno kasnije preuzimanje računa.
- Managed forma zasad ne nudi promo kod. API ga podržava, pa se može dodati kada definiramo treba li owner ručno primjenjivati promocije.

## Sljedeći korak

Implementirati booking lifecycle za ownera: završavanje termina i status `no_show`, uz booking event i audit zapise.
