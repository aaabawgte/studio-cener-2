# Faza 7 — manager pozivnice i pristupi

Datum završetka: 13. 10. 2026.

## Napravljeno

- owner ekran `Pristupi` za pregled ownera, aktivnih managera i pozivnica na čekanju
- kreiranje manager pozivnice koja vrijedi 14 dana i radi samo za uneseni e-mail
- jednokratni onboarding link; u D1 se sprema samo SHA-256 hash tokena
- limit managera iz `studio_licenses.max_managers`, uz rezerviranje mjesta aktivnom pozivnicom
- opcionalno povezivanje manager logina s javnim `team_member` profilom
- opoziv manager pozivnice i trenutno ukidanje aktivnog manager pristupa
- siguran ponovni poziv ranije opozvanog managera
- automatsko označavanje isteklih pozivnica prije izdavanja nove
- audit zapisi za kreiranje, prihvat i opoziv

## Dozvole

- samo owner ima `studio.settings.manage` i može upravljati pristupima
- manager i dalje može upravljati rezervacijama, kalendarom, uslugama, radnim vremenom, timom, portfoliom i analitikom
- manager ne može mijenjati studio postavke, pozivati druge managere ni opozvati pristup
- svaka provjera radi se na API-ju uz `studio_id`

## API

- `GET /api/studios/:slug/access`
- `POST /api/studios/:slug/manager-invitations`
- `DELETE /api/studios/:slug/manager-invitations/:invitationId`
- `DELETE /api/studios/:slug/memberships/:membershipId`
- postojeći `POST /api/invitations/accept` sada povezuje i javni profil te može ponovno aktivirati opozvani membership

## Provjera

```sh
npx wrangler d1 migrations apply studio-cener-local --local --config apps/api/wrangler.jsonc
npm run check
```

Integracijski test pokriva poziv managera, prihvat točnim e-mailom, manager ovlasti, zabranu owner postavki, limit licence, opoziv pristupa, odvajanje javnog profila, ponovni poziv i opoziv pending pozivnice.

## Otvoreno

- pozivni link owner trenutačno kopira ručno; Resend slanje dodaje se u komunikacijskoj fazi
- promjena broja manager mjesta ostaje platform admin odluka kroz licencu

## Sljedeći korak

Paketi sati i kreditni ledger, uključujući dodjelu, potrošnju, povrat i ručne korekcije s razlogom i autorom.
