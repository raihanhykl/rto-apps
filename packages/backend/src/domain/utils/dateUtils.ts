/**
 * Get today's date in WIB (Asia/Jakarta, UTC+7).
 * On servers running in UTC or other timezones, new Date() gives the wrong "today"
 * for Indonesian business logic. This function returns midnight of the WIB date.
 */
export function getWibToday(): Date {
  const now = new Date();
  const wibStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // YYYY-MM-DD
  const [y, m, d] = wibStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Get current date/time components in WIB for number generation (YYMMDD).
 */
export function getWibDateParts(): { year: number; month: number; day: number } {
  const now = new Date();
  const wibStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // YYYY-MM-DD
  const [y, m, d] = wibStr.split('-').map(Number);
  return { year: y, month: m, day: d };
}

/**
 * Convert a Date to a YYYY-MM-DD string key for calendar/map lookups.
 * Uses WIB timezone to avoid date shift on UTC servers.
 */
export function toDateKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

/**
 * Extract WIB date parts from a Date object.
 * Returns year, month (1-indexed), day, and dayOfWeek (0=Sunday).
 * Safe to use on any server timezone.
 */
export function getWibParts(date: Date): { year: number; month: number; day: number; dayOfWeek: number } {
  const wibStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const [y, m, d] = wibStr.split('-').map(Number);
  // Reconstruct date from WIB parts to get accurate day of week
  const reconstructed = new Date(y, m - 1, d);
  return { year: y, month: m, day: d, dayOfWeek: reconstructed.getDay() };
}
