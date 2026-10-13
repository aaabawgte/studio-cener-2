# Faza 14 — statusi termina

## Što je napravljeno

- Owner i manager mogu potvrđeni termin označiti kao **Završen** ili **Nije došao**.
- Status `completed` dopušten je tek nakon završetka termina, a `no_show` tek nakon njegova početka.
- Backend zahtijeva `bookings.manage`; artist ne može mijenjati ove statuse.
- Promjena prolazi kroz Booking Durable Object vezan uz studio i prostor.
- Svaka promjena statusa sprema booking event i audit zapis s korisnikom koji je izvršio radnju.
- Potvrda u sučelju smanjuje mogućnost slučajne promjene statusa.

## Endpoint

- `POST /api/studios/:slug/bookings/:bookingId/status`

Tijelo zahtjeva prihvaća samo `completed` ili `no_show`.

## Kako testirati

1. Prijaviti se kao owner ili manager.
2. Otvoriti **Rezervacije**.
3. Na terminu koji je počeo odabrati **Nije došao**, ili nakon završetka odabrati **Završen**.
4. Potvrditi radnju i provjeriti novi status na listi.
5. Pokrenuti `npm run check`.

Automatski test potvrđuje zabranu za artista, odbijanje prerane promjene i ispravan event/audit zapis za završeni termin.

## Rizici i otvorene odluke

- Status je namjerno konačan: završeni, otkazani ili `no_show` termin ne vraća se u potvrđeno stanje.
- Trenutačno nema zasebne bilješke uz `no_show`. Razlog ili interna napomena mogu se dodati kasnije kao novi event podatak.

## Sljedeći korak

Dodati detaljni prikaz termina s kompletnom poviješću promjena i internim bilješkama za ownera i managera.
