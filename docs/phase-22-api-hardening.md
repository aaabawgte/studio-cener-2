# Faza 22 — API zaštita i sigurnosni headeri

## Što je napravljeno

- Uvedeni su Cloudflare Rate Limiting bindingi, bez memorijskih brojača unutar Workera.
- Prijava i registracija ograničene su na 10 pokušaja u minuti po hashiranom identitetu.
- Registracija ima i dodatni limit po klijentu kako rotiranje e-mail adresa ne bi zaobišlo zaštitu.
- Kreiranje artist i managed rezervacija ograničeno je na 12 pokušaja u minuti po studiju i sessionu.
- Odgovor nakon prekoračenja je strukturirani `429 RATE_LIMITED`, s `Retry-After: 60` i zabranjenim cacheiranjem.
- Rate limit događaj zapisuje strukturirani warning s request ID-em, bez e-maila, session cookieja ili IP adrese.
- Pages odgovori dobili su Content Security Policy koji dopušta samo resurse potrebne aplikaciji s istog origina.
- Worker compatibility datum i generirani binding tipovi su ažurirani, a produkcijski source maps omogućeni su za korisnije stack traceove.
- Cloudflare test i deploy paketi ažurirani su na verzije koje podržavaju novu konfiguraciju.

## Promijenjene datoteke

- `apps/api/src/security/rate-limit.ts`
- `apps/api/src/index.ts`
- `apps/api/test/worker.test.ts`
- `apps/api/wrangler.jsonc`
- `apps/api/wrangler.production.jsonc`
- `apps/api/worker-configuration.d.ts`
- `apps/api/package.json`
- `apps/web/public/_headers`
- `package-lock.json`

## Kako testirati

1. Ponoviti pogrešnu prijavu istim e-mailom 11 puta unutar minute.
2. Potvrditi da jedanaesti odgovor vraća status `429` i `Retry-After: 60`.
3. Ponoviti kreiranje rezervacije više od 12 puta unutar minute s istim sessionom.
4. Otvoriti produkcijsku stranicu i provjeriti `Content-Security-Policy` response header.
5. Pokrenuti `npm run check`.

Automatski test pokriva prijavu, registraciju s različitim e-mailovima istog klijenta i pokušaje kreiranja rezervacije.

## Rizici i otvorene odluke

- Cloudflareov Worker Rate Limiting je lokaliziran po Cloudflare lokaciji i eventualno konzistentan. Služi zaštiti od zloupotrebe, a ne preciznom obračunu.
- Dodatni signup limit koristi hash IP adrese i user agenta samo kao brojač; sirova vrijednost se ne sprema niti zapisuje. Veće produkcijsko opterećenje može opravdati prilagodbu limita.
- Sentry i formalni D1/R2 backup i restore postupak još nisu uvedeni.

## Sljedeći korak

Uvesti Sentry praćenje grešaka na Workeru i webu, sa scrubanjem osjetljivih podataka i release oznakama, zatim dokumentirati i uvježbati D1/R2 backup i restore.
