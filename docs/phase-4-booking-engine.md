# Faza 4 — booking engine

Datum završetka: 12. 10. 2026.

## Napravljeno

- D1 modeli za `bookings`, `booking_events`, `blocked_slots` i 15-minutne `slot_claims`
- javni izračun slobodnih termina iz radnog vremena, aktivne usluge, postojećih rezervacija i blokada
- spremanje UTC vremena uz prikaz u IANA vremenskoj zoni studija
- server-side snapshot naziva usluge, trajanja, cijene i valute na rezervaciji
- Durable Object koordinator po kombinaciji studija i rezervabilnog resursa
- D1 jedinstveni slot claim kao trajna zaštita od preklapanja
- obavezan idempotency ključ za kreiranje rezervacije i siguran replay istog zahtjeva
- artist self-join nakon registracije ili prijave sa stranice konkretnog studija
- artist tok za odabir usluge, datuma, slobodnog termina, pregled i otkazivanje
- owner/manager popis rezervacija i kalendar za dodavanje i uklanjanje blokada
- audit zapisi za kreiranje i otkazivanje rezervacije te dodavanje i uklanjanje blokade
- booking event zapisi za svaku podržanu promjenu rezervacije
- backend dozvole i tenant filter na svakom privatnom booking upitu

Platforma nema online naplatu. Prikazana cijena je informativni snapshot rezervirane usluge.

## Sigurnosni model konkurentnosti

API najprije provjerava sesiju, aktivno članstvo, studio, uslugu, budući termin, 15-minutno poravnanje i radno vrijeme. Kreiranje rezervacije zatim ide u Durable Object imenovan s `studio_id:resource_id`. Isti koordinator serijalizira rezervacije i blokade za taj prostor.

Jedna atomska D1 batch operacija upisuje rezervaciju, sve pripadajuće slot claimove, booking event i audit zapis. Primarni ključ nad `(studio_id, resource_id, slot_start_utc)` ostaje konačna zaštita ako zahtjevi stignu istodobno. Otkazivanje atomskom operacijom mijenja status, uklanja claimove i zapisuje event i audit trag.

## API

- `GET /api/public/studios/:slug/booking-availability`
- `POST /api/studios/:slug/artist-membership`
- `GET|POST /api/studios/:slug/bookings`
- `POST /api/studios/:slug/bookings/:bookingId/cancel`
- `GET|POST /api/studios/:slug/blocked-slots`
- `DELETE /api/studios/:slug/blocked-slots/:blockId`

## Kako provjeriti

```sh
npx wrangler d1 migrations apply studio-cener-local --local --config apps/api/wrangler.jsonc
npm run check
```

Ručni tok:

1. Otvoriti javnu stranicu `/s/demo` i odabrati rezervaciju.
2. Registrirati se ili prijaviti; korisnik se pridružuje samo tom studiju kao artist.
3. Na `/s/demo/me/rezerviraj` odabrati uslugu, datum i termin.
4. Provjeriti rezervaciju i otkazivanje na `/s/demo/me/termini`.
5. Kao owner otvoriti `/app/demo/kalendar`, dodati blokadu i potvrditi da taj interval više nije ponuđen artistu.

Automatski testovi provjeravaju da dva paralelna zahtjeva za isti termin daju točno jednu rezervaciju, idempotentni replay, blokadu termina, otkazivanje, uklanjanje claimova, evente, audit zapise te proljetni i jesenski DST prijelaz.

## Otvorene odluke i ograničenja

- Svaki studio trenutačno koristi jedan glavni rezervabilni prostor. Baza i koordinator već nose `resource_id`; podrška za više soba traži izbor prostora u sučelju i pravila po prostoru.
- Artist može otkazati svaki budući termin. Minimalni rok za otkazivanje treba definirati kao postavku studija prije produkcijskog uključivanja pravila penala.
- Promjena termina izvodi se otkazivanjem pa novom rezervacijom. Poseban atomski reschedule tok još nije dio proizvoda.
- Kalendar u ovoj fazi upravlja blokadama i popisom rezervacija; puni dnevni i tjedni vizualni prikaz dolazi uz owner operativni dashboard.

## Sljedeći korak

Faza 5: transactional e-mail outbox i Resend slanje, obavijesti u aplikaciji, retry obrada i waitlist aktivacija kada se termin oslobodi.
