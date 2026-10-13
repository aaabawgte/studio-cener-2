# Faza 9 — promo kodovi

## Što je napravljeno

- Owner i manager mogu kreirati, pregledavati, aktivirati i arhivirati promo kodove.
- Podržani su postotni i fiksni popusti, minimalna cijena, maksimalni iznos popusta, vremenski raspon, ukupni limit i limit po artistu.
- Artist može provjeriti i primijeniti promo kod u booking formi.
- API sam računa popust iz aktualne cijene usluge. Frontend ne odlučuje o konačnoj cijeni.
- Rezervacija sprema snapshot cijene prije popusta, popusta, konačne cijene i promo koda.
- `promo_redemptions` se upisuje u istom D1 batchu kao booking i slot claim.
- D1 triggeri štite ukupni i korisnički limit i kod istodobnih zahtjeva.
- Otkazivanje rezervacije mijenja iskorištenje u `reversed`, pa kod ponovno ulazi u raspoloživi limit.
- Sve upravljačke promjene prolaze tenant provjeru, `promos.manage` dozvolu i audit log.

## Modeli

- `promo_codes` — pravila i status promo koda
- `promo_redemptions` — primjene koda na rezervacije
- `bookings` — dodatni snapshot stupci za originalnu cijenu, popust i kod

Sve nove tablice sadrže `studio_id`.

## Kako testirati

1. Kao owner ili manager otvoriti **Promo kodovi** i kreirati kod.
2. Kao artist otvoriti novu rezervaciju, unijeti kod i odabrati **Primijeni**.
3. Provjeriti prikaz originalne cijene, popusta i ukupnog iznosa.
4. Potvrditi i zatim otkazati rezervaciju.
5. Pokrenuti `npm run check`.

Automatski test provjerava kreiranje, validaciju, snapshot cijene, idempotentni replay, limit korištenja i poništavanje iskorištenja kod otkazivanja.

## Rizici i otvorene odluke

- Promo kod se trenutno primjenjuje na punu cijenu usluge. Kada booking počne trošiti paket sati ili prepaid kredit, treba definirati redoslijed popusta i kredita.
- Otkazivanje uvijek oslobađa promo kod. Kasnije se može dodati pravilo prema roku otkazivanja.

## Sljedeći korak

Implementirati waitlist s pravilima za slobodni termin i obavijesti artistu.
