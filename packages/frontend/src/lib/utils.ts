import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

/**
 * Get today's date in WIB (Asia/Jakarta, UTC+7).
 * Mirrors backend getWibToday() for consistent timezone handling.
 */
export function getWibToday(): Date {
  const wibStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const [y, m, d] = wibStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}
