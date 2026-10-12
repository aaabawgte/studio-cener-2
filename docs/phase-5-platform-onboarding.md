# Faza 5 — platform admin, licence i owner onboarding

Datum završetka: 12. 10. 2026.

## Napravljeno

- platform admin autorizacija s eksplicitnom allowlistom za prvi sigurni bootstrap
- `/platform` sučelje za pregled svih studija i kreiranje novog tenanta
- kreiranje studija, glavnog rezervabilnog prostora, licence i owner pozivnice u jednoj D1 batch operaciji
- modeli `studio_licenses`, `studio_invitations` i `studio_domains`, svaki sa `studio_id`
- 14-dnevna owner pozivnica čiji se sirovi token prikazuje samo pri kreiranju; baza čuva SHA-256 hash
- prihvat pozivnice samo s točno pozvanim e-mailom i kreiranje owner membershipa
- idempotentan ponovni prikaz već prihvaćene pozivnice istom korisniku
- produženje licence za godinu dana iz platform admin sučelja
- audit zapisi za kreiranje studija, prihvat pozivnice i promjenu licence
- booking availability i potvrda termina ovise o aktivnoj, trial ili važećoj grace licenci
- spremanje željene custom domene sa statusima domene i SSL-a

## Tok prodaje licence

1. Platform admin otvara `/platform` i unosi studio, owner e-mail, paket, istek licence i željenu domenu.
2. Sustav vraća jednokratni owner onboarding link.
3. Owner kroz link kreira račun ili se prijavi istim e-mailom.
4. Pozivnica mu dodjeljuje owner članstvo i vodi ga na dashboard studija.
5. Platform admin kasnije produžuje licencu iz popisa studija.

## Sigurnost

- Platform admin pravo dolazi iz `platformRole` polja. Početni admin može se promovirati samo ako mu je e-mail u server-side `PLATFORM_ADMIN_EMAILS` secretu.
- Pozivnica se ne može prihvatiti drugim e-mailom, istječe nakon 14 dana i u bazi nema iskoristivog sirovog tokena.
- Slug, domena i licenca validiraju se na API-ju. Sve poslovne mutacije uključuju audit zapis.
- Istekla ili suspendirana licenca ne može dobivati nove booking slotove niti kreirati rezervacije.

## Provjera

```sh
npx wrangler d1 migrations apply studio-cener-local --local --config apps/api/wrangler.jsonc
npm run check
```

Integracijski test pokriva platform admin bootstrap, kreiranje studija i licence, odbijanje običnog artista, produženje licence, owner registraciju, prihvat pozivnice i pristup owner kontekstu.

## Otvoreno

- `studio_domains` zasad evidentira željenu domenu kao `pending`. Automatsko kreiranje Cloudflare custom hostnamea, DNS upute i SSL polling zahtijevaju glavnu Studio Cener domenu na Cloudflareu.
- Owner pozivnica se trenutno kopira iz admin sučelja. Resend će je u sljedećoj komunikacijskoj fazi poslati automatski.
- Platform admin još nema suspendiranje studija, ponovno izdavanje pozivnice ni detaljni support prikaz.

## Sljedeći korak

Owner postavke i branding: naziv, opis, adresa, boje, logo kroz R2, tim i portfolio. Nakon toga Cloudflare for SaaS aktivacija custom domena i automatski Resend onboarding.
