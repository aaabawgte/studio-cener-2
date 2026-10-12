import { useNavigate } from 'react-router';
import { useToast, type DropdownItem } from '@studio/ui';
import { signOut } from '../features/auth/session-actions';

export function useUserMenu(extra: DropdownItem[]): DropdownItem[] {
  const navigate = useNavigate();
  const toast = useToast();
  return [
    ...extra,
    ...(extra.length ? [{ type: 'separator' as const }] : []),
    {
      label: 'Odjava',
      icon: 'logout',
      tone: 'danger',
      onSelect: () => {
        signOut()
          .then(() => navigate('/'))
          .catch(() => toast.error('Odjava nije uspjela', 'Provjerite vezu i pokušajte ponovno.'));
      },
    },
  ];
}
