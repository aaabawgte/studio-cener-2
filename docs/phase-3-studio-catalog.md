# Studio Cener 2.0 — faza 3: studio katalog

Status: završeno 12. listopada 2026.

## Što je napravljeno

- D1 tablice `bookable_resources`, `services` i `availability_rules`
- javni studio API i javna stranica `/s/:slug`
- owner popis, dodavanje, uređivanje i arhiviranje usluga
- cijene kao integer minor units i valuta preuzeta isključivo sa studija
- trajanja ograničena na 15-minutne korake od 15 do 720 minuta
- tjedno radno vrijeme spremljeno kao lokalne minute u vremenskoj zoni studija
- backend ovlasti `services.manage` i `hours.manage` za svaku mutaciju
- atomski poslovni zapis i `audit_logs` zapis za promjene usluga i radnog vremena
- eksplicitni credentialed CORS allowlist za odvojeni Pages/Worker razvoj
- development prikaz podataka izdvojen u Vite DEV mockove; produkcijski build uvijek koristi API

## API

- `GET /api/public/studios/:slug`
- `GET|POST /api/studios/:slug/services`
- `PUT /api/studios/:slug/services/:serviceId`
- `GET|PUT /api/studios/:slug/availability-rules`

Klijentski `studio_id` se ne prima. Studio se razrješava iz sluga, sessiona i aktivnog članstva. Arhiviranje usluge čuva budući audit i booking snapshot trag.

## Kako testirati

```sh
npx wrangler d1 migrations apply studio-cener-local --local --config apps/api/wrangler.jsonc
npm run check
```

Lokalni pregledi:

- `/app/demo/usluge`
- `/app/demo/radno-vrijeme`
- `/s/demo`

Integracijski test prolazi kroz Better Auth session, create/update usluge, zamjenu rasporeda, javni profil, audit zapise i zabranu pristupa drugom studiju.

## Rizici i otvorene odluke

- Trenutačni proizvodni opseg podržava jedan radni interval po danu. Shema dopušta kasnije proširenje nakon odluke o pauzama i podijeljenim smjenama.
- Posebni neradni dani i blokirani termini ulaze u booking fazu kroz `blocked_slots` kako isto pravilo ne bi bilo zapisano na dva mjesta.
- Uređivanje opisa, adrese i branda studija još nije izloženo u owner postavkama.
- Lokalni demo koristi samo razvojne mockove. Stvarni API tok je pokriven Worker integracijskim testovima.

## Sljedeći konkretni korak

Faza 4: booking engine — resurs, dostupni slotovi, blokade, UTC pretvorba, booking snapshoti, event log, idempotency, Durable Object koordinacija i D1 slot claims.
