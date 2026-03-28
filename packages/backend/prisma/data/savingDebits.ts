/**
 * Seed data untuk SavingTransaction DEBIT_SERVICE.
 *
 * Data ini berasal dari tim finance (CSV → TypeScript).
 * Setiap entry merepresentasikan penggunaan saldo tabungan
 * untuk service motor di service center.
 *
 * Format CSV dari finance:
 *   contractNumber;type;amount;date;description;pergantian;perbaikan;notes
 *
 * Konversi ke DateTuple: "2026-02-15" → [2026, 2, 15] (bulan 1-indexed)
 */

type DateTuple = [number, number, number];

export interface SavingDebitSeed {
  contractNumber: string; // Nomor kontrak (lookup key)
  type: 'DEBIT_SERVICE'; // Jenis transaksi (untuk saat ini hanya DEBIT_SERVICE)
  amount: number; // Nominal dalam Rupiah (angka bulat)
  date: DateTuple; // Tanggal transaksi [year, month(1-based), day]
  description: string; // Deskripsi umum service
  pergantian: string; // Part yang diganti (comma-separated, kosong jika tidak ada)
  perbaikan: string; // Part yang diperbaiki (comma-separated, kosong jika tidak ada)
  notes: string; // Catatan tambahan (bengkel, dll.)
}

// ====== DATA DARI FINANCE ======
// Isi array ini setelah mendapat data CSV dari tim finance.
// Jalankan: cd packages/backend && npx prisma db seed -- --reset

export const savingDebits: SavingDebitSeed[] = [
  // Contoh format (hapus setelah data asli diisi):
  // {
  //   contractNumber: '01/WNUS-KTR/I/2026',
  //   type: 'DEBIT_SERVICE',
  //   amount: 150000,
  //   date: [2026, 2, 15],
  //   description: 'Service rem',
  //   pergantian: 'Kampas rem depan, Kampas rem belakang',
  //   perbaikan: '',
  //   notes: 'Bengkel Jaya Motor',
  // },
];
