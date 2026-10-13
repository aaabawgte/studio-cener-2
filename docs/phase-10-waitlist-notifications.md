# Faza 10 — lista čekanja i obavijesti

## Što je napravljeno

- Artist se iz booking forme može prijaviti na listu čekanja za uslugu i datum bez slobodnih termina.
- Artist vidi vlastite aktivne, obaviještene, uklonjene, rezervirane i istekle prijave te ih može ukloniti.
- Owner i manager imaju pregled liste čekanja za cijeli studio.
- Otkazivanje rezervacije pronalazi aktivne prijave za isti studio, prostor, uslugu i lokalni datum.
- U istom D1 batchu kreira se in-app obavijest i prijava prelazi u status `notified`.
- Kada artist rezervira termin za koji čeka, njegova prijava prelazi u `converted`.
- Artist ima stvarni ekran obavijesti i može označiti pojedinu obavijest pročitanom.
- Istekle aktivne prijave zatvaraju se pri sljedećem čitanju liste.

## Modeli

- `waitlist_entries` — prijave, željeni lokalni datum, UTC granice dana, status i broj obavijesti
- `notifications` — tenant izolirane in-app obavijesti po korisniku

Obje tablice sadrže `studio_id`. Aktivna prijava je jedinstvena po artistu, usluzi, prostoru i datumu.

## Kako testirati

1. Kao artist otvoriti rezervaciju i odabrati uslugu i datum bez slobodnih termina.
2. Odabrati **Prijavi me na listu**.
3. Kao owner otvoriti **Lista čekanja** i provjeriti prijavu.
4. Otkazati postojeću rezervaciju za istu uslugu i datum.
5. Kao artist otvoriti **Obavijesti** i provjeriti poruku o oslobođenom terminu.
6. Pokrenuti `npm run check`.

Automatski test koristi dva artista i provjerava cijeli slijed od prijave do otkazivanja, obavijesti i statusa `notified`.

## Rizici i otvorene odluke

- Trenutačno se obavještavaju svi aktivni artisti za taj datum. Kasnije se može uvesti red čekanja ili vremenski prozor prvenstva.
- Obavijesti su zasad unutar aplikacije. Resend e-mail delivery zahtijeva potvrđenu domenu pošiljatelja i produkcijski API ključ.

## Sljedeći korak

Implementirati transactional e-mail pipeline s outbox pristupom, retry pravilima i Resend integracijom.
