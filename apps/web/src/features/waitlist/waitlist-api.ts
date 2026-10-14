import type { Notification, WaitlistCreate, WaitlistEntry } from '@studio/contracts';
import { apiFetch } from '../../lib/api/client';

const base = (slug: string) => `/api/studios/${encodeURIComponent(slug)}`;
export const fetchOwnWaitlist = (slug: string, signal?: AbortSignal) => apiFetch<{ waitlistEntries: WaitlistEntry[] }>(`${base(slug)}/waitlist/me`, { signal });
export const fetchStudioWaitlist = (slug: string, signal?: AbortSignal) => apiFetch<{ waitlistEntries: WaitlistEntry[] }>(`${base(slug)}/waitlist`, { signal });
export const joinWaitlist = (slug: string, input: WaitlistCreate) => apiFetch<WaitlistEntry>(`${base(slug)}/waitlist`, { method: 'POST', body: input });
export const leaveWaitlist = (slug: string, entryId: string) => apiFetch<void>(`${base(slug)}/waitlist/${encodeURIComponent(entryId)}`, { method: 'DELETE' });
export const fetchNotifications = (slug: string, signal?: AbortSignal) => apiFetch<{ notifications: Notification[] }>(`${base(slug)}/notifications`, { signal });
export const markNotificationRead = (slug: string, id: string) => apiFetch<void>(`${base(slug)}/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
export const fetchUnreadNotificationCount = (slug: string, signal?: AbortSignal) => apiFetch<{ unreadCount: number }>(`${base(slug)}/notifications/unread-count`, { signal });
export const markAllNotificationsRead = (slug: string) => apiFetch<{ markedRead: number }>(`${base(slug)}/notifications/read-all`, { method: 'PATCH' });
