import { PaymentDay } from '../entities';

/**
 * Pure domain function — hitung total denda keterlambatan.
 *
 * Untuk setiap hari UNPAID:
 *   - Hitung selisih hari: (today - tanggalHari)
 *   - Jika selisih >= penaltyGraceDays → kena denda sebesar feePerDay
 *   - Holiday (amount=0) dilewati — tidak kena denda
 *
 * @param unpaidDays   Daftar PaymentDay yang belum dibayar
 * @param today        Tanggal acuan (WIB)
 * @param penaltyGraceDays  Jumlah hari toleransi sebelum denda (default 2)
 * @param feePerDay    Nominal denda per hari (default Rp 20.000)
 * @returns Total denda dalam Rupiah
 */
export function computeLateFee(
  unpaidDays: PaymentDay[],
  today: Date,
  penaltyGraceDays: number,
  feePerDay: number,
): number {
  const todayMs = new Date(today).setHours(0, 0, 0, 0);
  let total = 0;

  for (const pd of unpaidDays) {
    if (pd.amount === 0) continue;
    const dayMs = new Date(pd.date).setHours(0, 0, 0, 0);
    const diffDays = Math.floor((todayMs - dayMs) / 86400000);
    if (diffDays >= penaltyGraceDays) {
      total += feePerDay;
    }
  }

  return total;
}
