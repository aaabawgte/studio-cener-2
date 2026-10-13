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
import { PlatformPage } from './routes/platform/PlatformPage';
import { InvitationPage } from './routes/platform/InvitationPage';
import { SettingsPage } from './routes/owner/SettingsPage';
import { TeamPage } from './routes/owner/TeamPage';
import { PortfolioPage } from './routes/owner/PortfolioPage';
import { AccessPage } from './routes/owner/AccessPage';
import { ValuePage } from './routes/owner/ValuePage';
import { CreditsPage } from './routes/artist/CreditsPage';
import { PromoCodesPage } from './routes/owner/PromoCodesPage';
import { WaitlistPage } from './routes/artist/WaitlistPage';
import { NotificationsPage } from './routes/artist/NotificationsPage';
import { OwnerWaitlistPage } from './routes/owner/WaitlistPage';
import { AnalyticsPage } from './routes/owner/AnalyticsPage';
import { OverviewPage } from './routes/owner/OverviewPage';
import { CreateBookingPage } from './routes/owner/CreateBookingPage';
import { BookingDetailPage } from './routes/owner/BookingDetailPage';

// Dev-only katalog komponenti; ne ulazi u produkcijski bundle.
const UiKit = import.meta.env.DEV ? lazy(() => import('./routes/dev/UiKit')) : null;

const ownerRoutes: { id: string; path: string; description: string }[] = [];

const artistRoutes: { id: string; path: string; description: string }[] = [
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
          <Route path="/platform" element={<PlatformPage />} />
          <Route path="/pozivnica" element={<InvitationPage />} />
          <Route path="/s/:slug" element={<PublicStudioPage />} />

          <Route path="/app/:slug" element={<OwnerLayout />}>
            <Route index element={<OverviewPage />} />
            {ownerRoutes.map((r) => (
              <Route key={r.id} path={r.path} element={<ModulePlaceholder sections={ownerNav} id={r.id} description={r.description} />} />
            ))}
            <Route path="usluge" element={<ServicesPage />} />
            <Route path="radno-vrijeme" element={<AvailabilityPage />} />
            <Route path="termini" element={<BookingsPage />} />
            <Route path="termini/nova" element={<CreateBookingPage />} />
            <Route path="termini/:bookingId" element={<BookingDetailPage />} />
            <Route path="kalendar" element={<CalendarPage />} />
            <Route path="tim" element={<TeamPage />} />
            <Route path="portfolio" element={<PortfolioPage />} />
            <Route path="postavke" element={<SettingsPage />} />
            <Route path="pristupi" element={<AccessPage />} />
            <Route path="paketi-krediti" element={<ValuePage />} />
            <Route path="promo-kodovi" element={<PromoCodesPage />} />
            <Route path="lista-cekanja" element={<OwnerWaitlistPage />} />
            <Route path="analitika" element={<AnalyticsPage />} />
            <Route path="*" element={<NotFound inline />} />
          </Route>

          <Route path="/s/:slug/me" element={<ArtistLayout />}>
            <Route index element={<ModulePlaceholder sections={artistNav} id="home" description="Vaš sljedeći termin, krediti i brza rezervacija." />} />
            {artistRoutes.map((r) => (
              <Route key={r.id} path={r.path} element={<ModulePlaceholder sections={artistNav} id={r.id} description={r.description} />} />
            ))}
            <Route path="rezerviraj" element={<BookingPage />} />
            <Route path="termini" element={<BookingsPage />} />
            <Route path="krediti" element={<CreditsPage />} />
            <Route path="obavijesti" element={<NotificationsPage />} />
            <Route path="lista-cekanja" element={<WaitlistPage />} />
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
