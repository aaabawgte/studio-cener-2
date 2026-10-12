import { Card, EmptyState, PageHeader } from '@studio/ui';
import { usePageTitle } from '../lib/usePageTitle';
import { findNavItem, type NavSection } from '../shell/nav';

/**
 * Privremeni ekran za module koji još nisu implementirani. Namjerno bez lažnih
 * podataka — prikazuje samo strukturu stranice i jasnu poruku.
 */
export function ModulePlaceholder({ sections, id, description }: { sections: NavSection[]; id: string; description?: string }) {
  const item = findNavItem(sections, id);
  const title = item?.label ?? 'Stranica';
  usePageTitle(title);
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card padded={false}>
        <EmptyState
          size="compact"
          icon={item?.icon ?? 'inbox'}
          title="Modul je u izradi"
          description="Ovaj ekran stiže u jednoj od sljedećih feature grana. Navigacija i okvir su spremni."
        />
      </Card>
    </>
  );
}
