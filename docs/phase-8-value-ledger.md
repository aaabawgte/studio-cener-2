# Faza 8 — paketi sati i prepaid kredit

## Što je napravljeno

- Owner i manager mogu kreirati pakete sati, dodijeliti ih artistu te evidentirati potrošnju, povrat i korekciju minuta.
- Owner i manager mogu ručno evidentirati dodjelu, potrošnju, povrat i korekciju novčanog prepaid kredita. Nema online naplate.
- Artist u svom portalu vidi trenutačni kredit i sve dodijeljene pakete.
- Paketi se vode u cijelim minutama, a novčani kredit u najmanjoj jedinici valute, primjerice centima.
- Svaka promjena sadrži razlog, autora, vrijeme i idempotency ključ. Ledger tablice zabranjuju `UPDATE` i `DELETE`.
- `ValueCoordinator` Durable Object serijalizira promjene po studiju i artistu. D1 batch zajedno mijenja stanje paketa, dodaje ledger i audit zapis.
- Backend na svakom čitanju i upisu provjerava studio, članstvo i `credits.manage` dozvolu.

## Modeli

- `hour_packages` — definicije paketa studija
- `package_balances` — pojedinačna dodjela paketa artistu i preostale minute
- `package_ledger` — nepromjenjiva povijest minuta
- `credit_ledger` — nepromjenjiva povijest novčanog prepaid kredita; saldo je zbroj zapisa

Sve tablice sadrže `studio_id`. Stanje ne može pasti ispod nule.

## Kako testirati

1. Prijaviti se kao owner ili manager i otvoriti **Paketi i krediti**.
2. Kreirati paket, odabrati artista i dodijeliti paket uz razlog.
3. Evidentirati potrošnju minuta i promjenu prepaid kredita.
4. Prijaviti se kao artist i otvoriti **Krediti i paketi**.
5. Pokrenuti `npm run check` za tipove, lint, 9 API testova i produkcijski build.

Automatski testovi provjeravaju idempotentnu dodjelu, istodobnu potrošnju, zabranu negativnog salda, artistov vlastiti prikaz i nepromjenjivost ledgera.

## Otvorene odluke

- Booking još ne troši paket ili kredit automatski. To treba spojiti kao zasebnu atomsku booking fazu, uz jasna pravila prioriteta i povrata kod otkazivanja.
- Istek paketa se provjerava pri čitanju i potrošnji. Buduća zakazana obrada može materijalizirati status `expired` i dodati događaj isteka.

## Sljedeći korak

Implementirati promo kodove i njihova iskorištenja, zatim ih povezati sa server-side izračunom cijene rezervacije.
