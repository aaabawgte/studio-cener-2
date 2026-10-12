import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { LoadingState, ToastProvider } from '@studio/ui';
import { artistNav, ownerNav } from './shell/nav';
import { ArtistLayout } from './routes/artist/ArtistLayout';
import { Home } from './routes/Home';
import { ModulePlaceholder } from './routes/ModulePlaceholder';
import { NotFound } from './routes/NotFound';
import { AuthPage } from './routes/auth/AuthPage';
import { OwnerLayout } from './routes/owner/OwnerLayout';
import { AvailabilityPage } from './routes/owner/AvailabilityPage';
import { ServicesPage } from './routes/owner/ServicesPage';
import { PublicStudioPage } from './routes/public/PublicStudioPage';
import { BookingPage } from './routes/bookings/BookingPage';
import { BookingsPage } from './routes/bookings/BookingsPage';
import { CalendarPage } from './routes/owner/CalendarPage';

// Dev-only katalog komponenti; ne ulazi u produkcijski bundle.
const UiKit = import.meta.env.DEV ? lazy(() => import('./routes/dev/UiKit')) : null;

const ownerRoutes: { id: string; path: string; description: string }[] = [
  { id: 'analytics', path: 'analitika', description: 'Popunjenost, prihod po usluzi i povratni artisti.' },
  { id: 'team', path: 'tim', description: 'Javni profili producenata i inženjera.' },
  { id: 'portfolio', path: 'portfolio', description: 'Projekti koji se prikazuju na javnom profilu studija.' },
  { id: 'settings', path: 'postavke', description: 'Podaci studija, brand i pravila rezerviranja.' },
];

const artistRoutes: { id: string; path: string; description: string }[] = [
  { id: 'notifications', path: 'obavijesti', description: 'Potvrde, promjene i podsjetnici.' },
  { id: 'credits', path: 'krediti', description: 'Stanje kredita i paketa sati.' },
  { id: 'waitlist', path: 'lista-cekanja', description: 'Termini na koje čekate oslobađanje.' },
  { id: 'profile', path: 'profil', description: 'Vaši podaci i postavke obavijesti.' },
];

export function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/prijava" element={<AuthPage mode="sign-in" />} />
          <Route path="/registracija" element={<AuthPage mode="sign-up" />} />
          <Route path="/s/:slug" element={<PublicStudioPage />} />

          <Route path="/app/:slug" element={<OwnerLayout />}>
            <Route index element={<ModulePlaceholder sections={ownerNav} id="overview" description="Današnji termini, popunjenost tjedna i stvari koje traže pažnju." />} />
            {ownerRoutes.map((r) => (
              <Route key={r.id} path={r.path} element={<ModulePlaceholder sections={ownerNav} id={r.id} description={r.description} />} />
            ))}
            <Route path="usluge" element={<ServicesPage />} />
            <Route path="radno-vrijeme" element={<AvailabilityPage />} />
            <Route path="termini" element={<BookingsPage />} />
            <Route path="kalendar" element={<CalendarPage />} />
            <Route path="*" element={<NotFound inline />} />
          </Route>

          <Route path="/s/:slug/me" element={<ArtistLayout />}>
            <Route index element={<ModulePlaceholder sections={artistNav} id="home" description="Vaš sljedeći termin, krediti i brza rezervacija." />} />
            {artistRoutes.map((r) => (
              <Route key={r.id} path={r.path} element={<ModulePlaceholder sections={artistNav} id={r.id} description={r.description} />} />
            ))}
            <Route path="rezerviraj" element={<BookingPage />} />
            <Route path="termini" element={<BookingsPage />} />
            <Route path="*" element={<NotFound inline />} />
          </Route>

          {UiKit ? (
            <Route
              path="/_ui"
              element={
                <Suspense fallback={<LoadingState />}>
                  <UiKit />
                </Suspense>
              }
            />
          ) : null}

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
