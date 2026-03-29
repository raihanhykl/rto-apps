/**
 * Seed data untuk ServiceRecord.
 *
 * Data ini berasal dari tim finance (Excel/CSV → TypeScript).
 * Setiap entry merepresentasikan event service motor.
 *
 * Jika file ini dihapus atau kosong, proses seeding tetap berjalan (skip service records).
 *
 * Format Excel dari finance:
 *   nomorKontrak;tipeServis;adaMotorPengganti;tanggalMulai;tanggalSelesai;biayaServis;pergantianPart;perbaikanPart;catatan
 *
 * Konversi ke DateTuple: "2026-02-15" → [2026, 2, 15] (bulan 1-indexed)
 */

type DateTuple = [number, number, number];

export interface ServiceRecordSeed {
  contractNumber: string; // Nomor kontrak (lookup key)
  serviceType: 'MINOR' | 'MAJOR'; // Tipe servis
  replacementProvided: boolean; // Ada motor pengganti? (hanya relevan untuk MAJOR)
  startDate: DateTuple; // Tanggal mulai servis [year, month(1-based), day]
  endDate: DateTuple; // Tanggal selesai servis
  serviceCost: number; // Biaya servis dalam Rupiah (0 jika gratis/garansi)
  partsReplaced: string; // Part yang diganti (comma-separated, '' jika tidak ada)
  partsRepaired: string; // Part yang diperbaiki (comma-separated, '' jika tidak ada)
  notes: string; // Catatan tambahan (bengkel, keterangan, dll.)
}

// ====== DATA DARI FINANCE ======
// Isi array ini dari data Excel tim finance.
// Jalankan: cd packages/backend && npx prisma db seed -- --reset

export const serviceRecords: ServiceRecordSeed[] = [
  // --- MINOR (4 entries) ---
  {
    contractNumber: '01/WNUS-KTR/I/2026',
    serviceType: 'MINOR',
    replacementProvided: false,
    startDate: [2026, 2, 10],
    endDate: [2026, 2, 10],
    serviceCost: 0,
    partsReplaced: '',
    partsRepaired: 'Setelan rem',
    notes: 'Servis ringan gratis garansi',
  },
  {
    contractNumber: '02/WNUS-KTR/I/2026',
    serviceType: 'MINOR',
    replacementProvided: false,
    startDate: [2026, 2, 18],
    endDate: [2026, 2, 18],
    serviceCost: 50000,
    partsReplaced: '',
    partsRepaired: 'Kabel gas, Setelan rantai',
    notes: 'Bengkel Jaya Motor',
  },
  {
    contractNumber: '04/WNUS/KTR/I/2026',
    serviceType: 'MINOR',
    replacementProvided: false,
    startDate: [2026, 3, 1],
    endDate: [2026, 3, 1],
    serviceCost: 100000,
    partsReplaced: 'Kampas rem depan',
    partsRepaired: '',
    notes: 'Bengkel Mitra Elektrik',
  },
  {
    contractNumber: '05/WNUS-KTR/I/2026',
    serviceType: 'MINOR',
    replacementProvided: false,
    startDate: [2026, 2, 25],
    endDate: [2026, 2, 25],
    serviceCost: 150000,
    partsReplaced: 'Ban belakang',
    partsRepaired: '',
    notes: 'Bengkel Jaya Motor — ban aus',
  },

  // --- MAJOR + motor pengganti (3 entries) ---
  {
    contractNumber: '07/WNUS-KTR/I/2026',
    serviceType: 'MAJOR',
    replacementProvided: true,
    startDate: [2026, 2, 15],
    endDate: [2026, 2, 18],
    serviceCost: 200000,
    partsReplaced: 'Controller',
    partsRepaired: 'Wiring harness',
    notes: 'Service center WEDISON — controller error',
  },
  {
    contractNumber: '08/WNUS-KTR/I/2026',
    serviceType: 'MAJOR',
    replacementProvided: true,
    startDate: [2026, 3, 5],
    endDate: [2026, 3, 8],
    serviceCost: 350000,
    partsReplaced: 'Charger, Kabel charging',
    partsRepaired: '',
    notes: 'Service center WEDISON — charger mati',
  },
  {
    contractNumber: '09/WNUS-KTR/I/2026',
    serviceType: 'MAJOR',
    replacementProvided: true,
    startDate: [2026, 2, 20],
    endDate: [2026, 2, 22],
    serviceCost: 500000,
    partsReplaced: 'Motor hub, Bearing roda belakang',
    partsRepaired: 'Spakbor belakang',
    notes: 'Bengkel Mitra Elektrik — motor hub bunyi',
  },

  // --- MAJOR + tanpa motor pengganti (3 entries) ---
  {
    contractNumber: '10/WNUS-KTR/I/2026',
    serviceType: 'MAJOR',
    replacementProvided: false,
    startDate: [2026, 3, 10],
    endDate: [2026, 3, 12],
    serviceCost: 0,
    partsReplaced: '',
    partsRepaired: 'Sistem kelistrikan',
    notes: 'Service center WEDISON — garansi pabrik',
  },
  {
    contractNumber: '11/WNUS-KTR/I/2026',
    serviceType: 'MAJOR',
    replacementProvided: false,
    startDate: [2026, 2, 24],
    endDate: [2026, 2, 26],
    serviceCost: 300000,
    partsReplaced: 'Baterai cell (2 unit)',
    partsRepaired: 'BMS board',
    notes: 'Service center WEDISON — baterai drop',
  },
  {
    contractNumber: '12/WNUS-KTR/I/2026',
    serviceType: 'MAJOR',
    replacementProvided: false,
    startDate: [2026, 3, 15],
    endDate: [2026, 3, 18],
    serviceCost: 500000,
    partsReplaced: 'Throttle assembly, Controller',
    partsRepaired: 'Display panel',
    notes: 'Service center WEDISON — throttle tidak responsif',
  },
];
