import { PaymentDay } from '../entities';
import { toLocalMidnightWib } from './dateUtils';

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
  const todayNorm = toLocalMidnightWib(today);
  let total = 0;

  for (const pd of unpaidDays) {
    if (pd.amount === 0) continue;
    const dayNorm = toLocalMidnightWib(new Date(pd.date));
    const diffDays = Math.floor((todayNorm.getTime() - dayNorm.getTime()) / 86400000);
    if (diffDays >= penaltyGraceDays) {
      total += feePerDay;
    }
  }

  return total;
}
