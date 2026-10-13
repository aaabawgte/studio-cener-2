# Faza 16 — pomicanje termina

## Što je napravljeno

- Owner i manager mogu na detaljima potvrđenog termina odabrati novi datum i slobodno vrijeme.
- Dostupnost se računa na backendu iz spremljenog trajanja rezervacije, radnog vremena, blokada i drugih potvrđenih rezervacija.
- Promjena prolazi kroz isti Booking Durable Object kao kreiranje termina.
- Stari slotovi i novi slotovi mijenjaju se u jednoj D1 transakciji; konflikt vraća `409` bez gubitka stare rezervacije.
- Cijena, usluga, trajanje i promo snapshot ostaju nepromijenjeni.
- Booking event i audit log spremaju staro i novo vrijeme te korisnika koji je izvršio promjenu.
- Artist dobiva in-app obavijest da je termin pomaknut.
- Oslobođeni stari termin pokreće postojeću waitlist obavijest, a odgovarajuća prijava za novi termin može se označiti kao konvertirana.

## Endpointi

- `GET /api/studios/:slug/bookings/:bookingId/reschedule-availability?date=YYYY-MM-DD`
- `POST /api/studios/:slug/bookings/:bookingId/reschedule`

## Kako testirati

1. Prijaviti se kao owner ili manager.
2. Otvoriti **Rezervacije**, zatim **Detalji** potvrđenog termina.
3. U odjeljku **Pomakni termin** odabrati datum i novi slobodan termin.
4. Potvrditi promjenu.
5. Provjeriti novo vrijeme i zapis **Termin je pomaknut** u povijesti.
6. Pokrenuti `npm run check`.

Automatski test potvrđuje zabranu artistu, dohvat dostupnosti, sigurno pomicanje, autora eventa, audit zapis i artistovu obavijest.

## Rizici i otvorene odluke

- Pomicati se može samo potvrđen termin i samo unutar istog bookable prostora.
- Promjena usluge ili trajanja nije dio ove radnje jer bi zahtijevala novu potvrdu cijene i snapshotova.

## Sljedeći korak

Dodati pretraživanje, filtre i paginaciju rezervacija kako owner lista ne bi ostala ograničena na zadnjih 200 zapisa.
