import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware class merge — used by every shadcn component. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
