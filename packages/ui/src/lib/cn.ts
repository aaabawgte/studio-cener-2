import { clsx, type ClassValue } from 'clsx';

/** Spaja className vrijednosti. Namjerno bez tailwind-merge: komponente ne rade konfliktne klase. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
