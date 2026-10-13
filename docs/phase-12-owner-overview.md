# Faza 12 — owner početni pregled

## Što je napravljeno

- Owner početna stranica više nije placeholder.
- Prikazuje broj i vrijednost današnjih rezervacija, potvrđene termine u idućih sedam dana i aktivnu listu čekanja.
- Današnji raspored prikazuje lokalno vrijeme studija, artista, uslugu i status termina.
- Upozorenja vode ownera prema uslugama, radnom vremenu ili listi čekanja kada je potrebna radnja.
- Brze radnje filtriraju se prema dozvolama, pa manager ne vidi owner-only postavke.
- Svi podaci dolaze iz tenant izoliranog API endpointa s `bookings.view` provjerom.

## Endpoint

- `GET /api/studios/:slug/overview`

## Kako testirati

1. Prijaviti se kao owner ili manager.
2. Otvoriti početnu stranicu dashboarda.
3. Provjeriti KPI kartice, današnji raspored i brze radnje.
4. U studiju bez usluga ili radnog vremena provjeriti upozorenja.
5. Pokrenuti `npm run check`.

Automatski test provjerava autorizirani overview odgovor i zajednički Zod ugovor.

## Rizici i otvorene odluke

- Owner još ne može kreirati rezervaciju u ime artista. Taj flow mora prvo sigurno pronaći ili kreirati artist membership i zapisati pravog autora promjene.
- Vrijednost današnjih rezervacija predstavlja booking snapshot, a ne potvrđenu naplatu.

## Sljedeći korak

Implementirati owner kreiranje rezervacije u ime artista, uz pretragu korisnika, provjeru termina i booking event log.
