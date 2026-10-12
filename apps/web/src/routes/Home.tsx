import { Badge, buttonStyles, Card } from '@studio/ui';
import { Link } from 'react-router';
import { usePageTitle } from '../lib/usePageTitle';

const capabilities = [
  { number: '01', title: 'Javni booking', text: 'Brendirana stranica, usluge, cijene i dostupni termini u vremenskoj zoni studija.' },
  { number: '02', title: 'Siguran kalendar', text: 'Zaštita od duplih rezervacija, blokirani termini i potpuni trag svake promjene.' },
  { number: '03', title: 'Owner kontrola', text: 'Rezervacije, radno vrijeme i operativne postavke dostupne i na mobitelu.' },
] as const;

export function Home() {
  usePageTitle();
  return (
    <main className="min-h-dvh bg-canvas">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="font-display text-xl">Studio Cener</Link>
          <nav className="flex items-center gap-2" aria-label="Glavna navigacija">
            <Link to="/prijava" className={buttonStyles({ variant: 'ghost' })}>Prijava</Link>
            <Link to="/s/demo" className={buttonStyles()}>Otvori demo</Link>
          </nav>
        </div>
      </header>

      <section className="overflow-hidden border-b border-line">
        <div className="mx-auto grid max-w-6xl gap-14 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-32">
          <div className="animate-rise-in">
            <Badge tone="accent" dot>Booking platforma za recording studije</Badge>
            <h1 className="mt-7 max-w-3xl text-[3.35rem] leading-[0.95] sm:text-7xl">Studio koji se rezervira bez dopisivanja.</h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-muted sm:text-xl">Vlastita branded stranica, jasan raspored i sigurne rezervacije. Sve što studio treba za mirniji radni dan.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to="/s/demo" className={buttonStyles({ size: 'lg' })}>Pogledaj demo studio</Link>
              <Link to="/registracija?studio=demo&next=%2Fs%2Fdemo%2Fme%2Frezerviraj" className={buttonStyles({ variant: 'secondary', size: 'lg' })}>Isprobaj rezervaciju</Link>
            </div>
            <p className="mt-4 text-xs text-ink-subtle">Demo koristi stvarni booking engine. Online naplata nije uključena.</p>
          </div>

          <Card className="relative overflow-hidden p-0 shadow-lifted">
            <div className="flex items-center justify-between border-b border-line bg-surface px-5 py-4">
              <div><p className="eyebrow">Danas</p><p className="mt-1 font-display text-xl">Raspored studija</p></div>
              <span className="h-2.5 w-2.5 rounded-full bg-success" aria-label="Studio je aktivan" />
            </div>
            <div className="space-y-3 p-5 sm:p-6">
              <ScheduleRow time="10:00" title="Snimanje vokala" meta="120 min · Potvrđeno" />
              <ScheduleRow time="13:00" title="Mix session" meta="180 min · Potvrđeno" />
              <div className="grid grid-cols-[3.5rem_1fr] gap-4 rounded-card border border-dashed border-line-strong p-4 text-ink-subtle">
                <p className="tabular text-sm">17:00</p><p className="text-sm">Slobodan termin</p>
              </div>
            </div>
            <div className="border-t border-line bg-accent-soft px-6 py-4 text-sm text-accent-strong">Bez preklapanja. Svaki termin potvrđuje server.</div>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="max-w-2xl">
          <p className="eyebrow">Jedan sustav</p>
          <h2 className="mt-4 text-4xl sm:text-5xl">Od javne stranice do zadnjeg termina.</h2>
        </div>
        <div className="mt-10 grid gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-3">
          {capabilities.map((item) => (
            <article key={item.number} className="bg-surface p-7 sm:p-8">
              <p className="font-mono text-xs text-accent-strong">{item.number}</p>
              <h3 className="mt-8 text-2xl">{item.title}</h3>
              <p className="mt-3 leading-relaxed text-ink-muted">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-ink px-5 py-16 text-ink-inverse sm:px-8 sm:py-20">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs tracking-[0.14em] uppercase opacity-60">Studio Cener 2.0</p><h2 className="mt-4 max-w-2xl text-4xl text-ink-inverse sm:text-5xl">Prođi cijeli booking tok kao artist.</h2></div>
          <Link to="/s/demo" className={buttonStyles({ variant: 'secondary', size: 'lg', className: 'shrink-0' })}>Otvori demo</Link>
        </div>
      </section>
    </main>
  );
}

function ScheduleRow({ time, title, meta }: { time: string; title: string; meta: string }) {
  return (
    <div className="grid grid-cols-[3.5rem_1fr] gap-4 rounded-card bg-sunken p-4">
      <p className="tabular text-sm font-medium">{time}</p>
      <div><p className="font-medium">{title}</p><p className="mt-1 text-xs text-ink-subtle">{meta}</p></div>
    </div>
  );
}
