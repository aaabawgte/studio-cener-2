# Faza 11 — owner analitika

## Što je napravljeno

- Owner i manager imaju stvarni ekran analitike za zadnjih 30, 90 ili 365 dana.
- Sažetak prikazuje rezervacije, otkazivanja, jedinstvene i povratne artiste, rezervirane sate, popunjenost i vrijednost rezervacija.
- Vrijednost se računa iz cjenovnog snapshota rezervacije nakon promo popusta.
- Popunjenost se računa kao rezervirane minute podijeljene s radnim minutama, umanjenima za blokirane termine.
- Dnevni trend koristi vremensku zonu studija, a najtraženije usluge koriste snapshot naziva.
- Ekran jasno označava financijski podatak kao vrijednost rezervacija jer platforma nema online naplatu.
- API je tenant izoliran i zahtijeva `analytics.view` dozvolu.

## Endpoint

- `GET /api/studios/:slug/analytics?range=30d|90d|365d`

## Kako testirati

1. Prijaviti se kao owner ili manager.
2. Otvoriti **Analitika**.
3. Promijeniti razdoblje između 30, 90 i 365 dana.
4. Provjeriti KPI kartice, dnevni graf i rang usluga.
5. Pokrenuti `npm run check`.

Automatski test provjerava autorizirani analytics odgovor i zajednički Zod ugovor.

## Rizici i otvorene odluke

- Povijesna popunjenost koristi trenutačna pravila radnog vremena. Ako studio naknadno promijeni raspored, stari nazivnik se može promijeniti. Precizno povijesno izvještavanje kasnije može uvesti verzionirana pravila dostupnosti.
- Vrijednost rezervacija nije dokaz naplate. Ručno financijsko izvještavanje može se kasnije temeljiti na kreditnom ledgeru i statusu naplate.

## Sljedeći korak

Implementirati operativni owner pregled s današnjim terminima, upozorenjima i brzim radnjama.
