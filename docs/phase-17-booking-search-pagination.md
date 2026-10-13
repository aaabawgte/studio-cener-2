# Faza 17 — pretraga i paginacija rezervacija

## Što je napravljeno

- Owner i manager mogu filtrirati rezervacije po artistu, e-mailu, usluzi, statusu i rasponu lokalnih datuma studija.
- Artist može filtrirati isključivo vlastite rezervacije po usluzi, statusu i datumu.
- Lista vraća najviše 25 zapisa po zahtjevu i koristi stabilan cursor temeljen na UTC početku i ID-u rezervacije.
- Gumb **Učitaj još** dodaje sljedeću stranicu bez ponavljanja postojećih zapisa.
- Nevaljani statusi, datumi i cursori odbijaju se na backendu.
- Dodani su D1 indeksi za listanje po studiju, statusu, artistu i vremenu.
- Pretraga koristi bindane parametre i svaki upit obavezno zadržava `studio_id` te, za artista, `artist_user_id` uvjet.

## Endpoint

`GET /api/studios/:slug/bookings`

Opcionalni parametri: `search`, `status`, `fromDate`, `toDate` i `cursor`.

## Kako testirati

1. Otvoriti **Rezervacije**.
2. Pretražiti ime artista ili uslugu.
3. Odabrati status i raspon datuma te pritisnuti **Filtriraj**.
4. Ako postoji više od 25 rezultata, pritisnuti **Učitaj još**.
5. Pokrenuti `npm run check`.

Automatski test stvara više od 25 rezervacija te provjerava cursor, nepreklapanje stranica, kombinirani status/search filter i odbijanje nevaljanog cursora.

## Rizici i otvorene odluke

- Pretraga je namjerno jednostavna D1 `LIKE` pretraga. Za sadašnji opseg studija nije potreban zaseban search servis.
- Cursor predstavlja trenutačni redoslijed. Nova rezervacija može se pojaviti na vrhu nakon osvježavanja liste, što je očekivano ponašanje.

## Sljedeći korak

Povezati pakete sati i prepaid kredit s rezervacijom uz atomsko trošenje i definirani povrat pri otkazivanju.
