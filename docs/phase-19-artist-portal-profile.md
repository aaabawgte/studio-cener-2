# Faza 19 — artist početna i profil

## Što je napravljeno

- Artist početna više nije placeholder i prikazuje sljedeći potvrđeni termin.
- Prikazuje prepaid kredit, ukupne preostale minute aktivnih paketa, broj novih obavijesti i aktivnih prijava na listu čekanja.
- Tri najnovije obavijesti dostupne su izravno na početnoj stranici.
- Svi podaci početne stranice dolaze iz jednog tenant-safe API endpointa i filtrirani su po `studio_id` i prijavljenom `user_id`.
- Artist može urediti ime računa. Backend provjerava članstvo, validira unos i zapisuje promjenu u audit log.
- E-mail je prikazan kao read-only dok ne uvedemo verificiranu promjenu e-maila.
- Artist može promijeniti lozinku unosom trenutačne lozinke; ostale aktivne sesije se opozivaju.

## Promijenjene datoteke

- `packages/contracts/src/index.ts`
- `apps/api/src/overview/routes.ts`
- `apps/api/src/profile/routes.ts`
- `apps/api/src/index.ts`
- `apps/api/test/worker.test.ts`
- `apps/web/src/features/artist/artist-api.ts`
- `apps/web/src/features/profile/profile-api.ts`
- `apps/web/src/routes/artist/ArtistHomePage.tsx`
- `apps/web/src/routes/artist/ProfilePage.tsx`
- `apps/web/src/App.tsx`

## Kako testirati

1. Prijaviti se kao artist i otvoriti `/s/:slug/me`.
2. Provjeriti sljedeći termin, kredit, pakete, obavijesti i listu čekanja.
3. Otvoriti **Profil**, promijeniti ime i ponovno učitati stranicu.
4. Promijeniti lozinku koristeći trenutačnu lozinku i zatim provjeriti novu prijavu.
5. Pokrenuti `npm run check`.

Automatski test provjerava artist overview, tenant vezane financijske sažetke, sljedeći termin i backend promjenu imena.

## Rizici i otvorene odluke

- Ime korisnika je podatak računa i zato se mijenja u svim studijima kojima isti račun pripada.
- Promjena e-maila ostaje zaključana dok ne uvedemo verifikacijski tok bez oslanjanja na preskočeni transactional e-mail sustav.

## Sljedeći korak

Dovršiti in-app obavijesti za ključne booking događaje i dodati zajednički unread indikator u artist navigaciju.
