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
