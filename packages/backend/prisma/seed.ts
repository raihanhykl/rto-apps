import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

// ====== Date Helpers ======
function dateOf(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d, 9, 0, 0, 0);
}

function startOfDay(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function endOfDay(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

function addDays(date: Date, n: number): Date {
  const r = new Date(date);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtDateCompact(d: Date): string {
  return `${d.getFullYear().toString().slice(-2)}${(d.getMonth() + 1).toString().padStart(2, "0")}${d.getDate().toString().padStart(2, "0")}`;
}

function daysBetweenInclusive(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

// ====== Libur Bayar ======
const HOLIDAY_PER_MONTH = 2;

function getSundayHolidays(year: number, month: number): Set<number> {
  const sundays: number[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, month - 1, d).getDay() === 0) sundays.push(d);
  }
  const N = sundays.length;
  const K = Math.min(HOLIDAY_PER_MONTH, N);
  const result = new Set<number>();
  for (let i = 0; i < K; i++) {
    result.add(sundays[Math.floor((i * N) / K + N / (2 * K))]);
  }
  return result;
}

function isLiburBayar(d: Date): boolean {
  if (d.getDay() !== 0) return false;
  return getSundayHolidays(d.getFullYear(), d.getMonth() + 1).has(d.getDate());
}

// ====== Constants ======
const OWN_TARGET = 1278;
const GRACE_DAYS = 7;

const RATES: Record<string, number> = {
  ATHENA_REGULAR: 58000,
  ATHENA_EXTENDED: 63000,
  VICTORY_REGULAR: 58000,
  VICTORY_EXTENDED: 63000,
  EDPOWER_REGULAR: 83000,
  EDPOWER_EXTENDED: 83000,
};

const DPS: Record<string, number> = {
  ATHENA_REGULAR: 530000,
  ATHENA_EXTENDED: 580000,
  VICTORY_REGULAR: 530000,
  VICTORY_EXTENDED: 580000,
  EDPOWER_REGULAR: 780000,
  EDPOWER_EXTENDED: 780000,
};

// Reference dates: all paid through March 3, active billing on March 4
const PAID_THROUGH = dateOf(2026, 3, 3);
const TODAY = dateOf(2026, 3, 4);

// ====== Contract Data ======
const DATA = [
  {
    contractNumber: "22/WNUS-KTR/I/2026",
    startDate: dateOf(2026, 1, 22),
    unitReceivedDate: dateOf(2026, 1, 22),
    fullName: "ZYOVANNI SATYA NEGARA",
    guarantorName: "ZYOVANNI SATYA NEGARA",
    address: "Cluster Bumi Cibinong Kav A6 RT 003 RW 001 Tengah Cibinong Bogor",
    phone: "081414090087",
    guarantorPhone: "081414090087",
    ktpNumber: "180321409870002",
    motor: "VICTORY" as const,
    battery: "EXTENDED" as const,
    color: "Black Doff",
    year: 2026,
    vin: "MGNAALB2CSJ000042",
    engineNumber: "QS3000722506000058",
  },
  {
    contractNumber: "19/WNUS-KTR/I/2026",
    startDate: dateOf(2026, 1, 22),
    unitReceivedDate: dateOf(2026, 1, 22),
    fullName: "SUDARYO",
    guarantorName: "SUDARYO",
    address:
      "Jl Terogong III RT 009 RW 010 Cilandak Barat Cilandak Jakarta Selatan",
    phone: "085697172145",
    guarantorPhone: "085697172145",
    ktpNumber: "317402106770003",
    motor: "EDPOWER" as const,
    battery: "EXTENDED" as const,
    color: "Grey",
    year: 2026,
    vin: "MGNAALB2ESJ000008",
    engineNumber: "QS3000722510000064",
  },
  {
    contractNumber: "29/WNUS-KTR/II/2026",
    startDate: dateOf(2026, 1, 31),
    unitReceivedDate: dateOf(2026, 1, 31),
    fullName: "WAHYU",
    guarantorName: "WAHYU",
    address: "Jl Bambu No 17 RT 001 RW 008 Kreo Larangan Kota Tangerang",
    phone: "083894533343",
    guarantorPhone: "083894533343",
    ktpNumber: "3173082011890009",
    motor: "ATHENA" as const,
    battery: "EXTENDED" as const,
    color: "Pink",
    year: 2025,
    vin: "MGNAALB2ASJ000010",
    engineNumber: "JYX72V2500W2505000112",
  },
  {
    contractNumber: "28/WNUS-KTR/II/2026",
    startDate: dateOf(2026, 1, 31),
    unitReceivedDate: dateOf(2026, 1, 31),
    fullName: "DANNY ADYTIA HERLAMBANG",
    guarantorName: "DANNY ADYTIA HERLAMBANG",
    address:
      "Jl Kamper III/36 RT 002 RW 009 Bekasi Jaya Bekasi Timur Kota Bekasi",
    phone: "085956576856",
    guarantorPhone: "085956576856",
    ktpNumber: "3275010608880022",
    motor: "ATHENA" as const,
    battery: "EXTENDED" as const,
    color: "Pink",
    year: 2025,
    vin: "MGNAALB2ASJ000009",
    engineNumber: "JYX72V2500W2505000051",
  },
  {
    contractNumber: "37/WNUS-KTR/II/2030",
    startDate: dateOf(2026, 2, 5),
    unitReceivedDate: dateOf(2026, 2, 5),
    fullName: "M H KAMALUDIN",
    guarantorName: "M H KAMALUDIN",
    address:
      "Komp Inkopad Blok J6/5 RT 017 RW 006 Sasakpanjang Tajurhalang Kabupaten Bogor",
    phone: "082125444575",
    guarantorPhone: "082125444575",
    ktpNumber: "3201371310800001",
    motor: "EDPOWER" as const,
    battery: "EXTENDED" as const,
    color: "Grey",
    year: 2026,
    vin: "MGNAALB2ESJ000005",
    engineNumber: "QS3000722510000042",
  },
  {
    contractNumber: "39/WNUS-KTR/II/2026",
    startDate: dateOf(2026, 2, 9),
    unitReceivedDate: dateOf(2026, 2, 9),
    fullName: "FIRLY YASHFA ARTAMA",
    guarantorName: "FIRLY YASHFA ARTAMA",
    address:
      "Kampung Setu RT 001 RW 002 Rempoa Ciputat Timur Tangerang Selatan",
    phone: "0895429335757",
    guarantorPhone: "0895429335757",
    ktpNumber: "3174051403990001",
    motor: "EDPOWER" as const,
    battery: "EXTENDED" as const,
    color: "Hitam",
    year: 2026,
    vin: "MGNAALB2ESJ000007",
    engineNumber: "QS3000722510000092",
  },
  {
    contractNumber: "42/WNUS-KTR/II/2026",
    startDate: dateOf(2026, 2, 11),
    unitReceivedDate: dateOf(2026, 2, 11),
    fullName: "MUSYAWWIR",
    guarantorName: "MUSYAWWIR",
    address: "Jl Cempaka Portal No. 5 RT 004 RW 016, Pengasinan, Bekasi",
    phone: "085217888979",
    guarantorPhone: "085217888979",
    ktpNumber: "3174031603790005",
    motor: "EDPOWER" as const,
    battery: "EXTENDED" as const,
    color: "Navy",
    year: 2026,
    vin: "MGNAALB2ESJ000003",
    engineNumber: "QS3000722510000083",
  },
  {
    contractNumber: "52/WNUS-KTR/II/2026",
    startDate: dateOf(2026, 2, 18),
    unitReceivedDate: dateOf(2026, 2, 18),
    fullName: "UGAN SUGANDI",
    guarantorName: "UGAN SUGANDI",
    address: "Gg Alif Perum. Alif Residence blok B7 RT 007 RW 007",
    phone: "0895329797424",
    guarantorPhone: "0895329797424",
    ktpNumber: "3217091512950009",
    motor: "ATHENA" as const,
    battery: "EXTENDED" as const,
    color: "Yellow",
    year: 2026,
    vin: "MGNAALB2ASJ000050",
    engineNumber: "JYX72V2500W2505000085",
  },
  {
    contractNumber: "56/WNUS-KTR/II/2026",
    startDate: dateOf(2026, 2, 19),
    unitReceivedDate: dateOf(2026, 2, 19),
    fullName: "DIDAN WAHIDAN UNTUNG",
    guarantorName: "DIDAN WAHIDAN UNTUNG",
    address:
      "Pedurenan RT 006 RW 004, Cilandak Timur, Pasar Minggu, Jakarta Selatan",
    phone: "081255552188",
    guarantorPhone: "081255552188",
    ktpNumber: "3171062408000001",
    motor: "ATHENA" as const,
    battery: "EXTENDED" as const,
    color: "White",
    year: 2026,
    vin: "MGNAALB2ASJ000022",
    engineNumber: "JYX72V2500W2505000087",
  },
  {
    contractNumber: "55/WNUS-KTR/II/2026",
    startDate: dateOf(2026, 2, 19),
    unitReceivedDate: dateOf(2026, 2, 19),
    fullName: "CISWOYO",
    guarantorName: "CISWOYO",
    address:
      "Jl Karet Pasar Baru Barat RT 004 RW 006, Karet Tengsin, Tanah Abang, Jakarta Pusat",
    phone: "081297951756",
    guarantorPhone: "081297951756",
    ktpNumber: "3171073009770004",
    motor: "VICTORY" as const,
    battery: "EXTENDED" as const,
    color: "Grey",
    year: 2026,
    vin: "MGNAALB2CSJ000030",
    engineNumber: "QS3000722412000103",
  },
];

const DEFAULT_SETTINGS = [
  {
    key: "max_rental_days",
    value: "7",
    description: "Maksimum hari perpanjangan",
  },
  {
    key: "ownership_target_days",
    value: "1278",
    description: "Target hari kepemilikan penuh",
  },
  {
    key: "grace_period_days",
    value: "7",
    description: "Masa tenggang sebelum repossession",
  },
  {
    key: "late_fee_per_day",
    value: "10000",
    description: "Denda keterlambatan per hari",
  },
  {
    key: "holiday_days_per_month",
    value: "2",
    description: "Jumlah hari libur bayar per bulan (Minggu)",
  },
];

async function main() {
  console.log("Seeding database...");

  // ====== Admin user ======
  const existingAdmin = await prisma.user.findUnique({
    where: { username: "admin" },
  });
  let adminId: string;
  if (!existingAdmin) {
    const admin = await prisma.user.create({
      data: {
        id: uuidv4(),
        username: "admin",
        password: "admin123",
        fullName: "Administrator",
        role: "ADMIN",
        isActive: true,
      },
    });
    adminId = admin.id;
    console.log("Created admin user");
  } else {
    adminId = existingAdmin.id;
    console.log("Admin user already exists");
  }

  // ====== Settings ======
  for (const s of DEFAULT_SETTINGS) {
    await prisma.setting.upsert({
      where: { key: s.key },
      create: { id: uuidv4(), ...s },
      update: {},
    });
  }
  console.log("Settings seeded");

  // ====== Check existing data ======
  const customerCount = await prisma.customer.count();
  if (customerCount > 0) {
    console.log("Data already seeded, skipping");
    return;
  }

  // ====== Collect all records for bulk insert ======
  const allInvoices: any[] = [];
  const allBillings: any[] = [];
  const allAuditLogs: any[] = [];

  let globalInvSeq = 1;
  let globalBilSeq = 1;

  for (const data of DATA) {
    const rateKey = `${data.motor}_${data.battery}`;
    const dailyRate = RATES[rateKey];
    const dpAmount = DPS[rateKey];
    const billingStartDate = addDays(data.unitReceivedDate, 1);

    // ====== Create customer ======
    const customerId = uuidv4();
    await prisma.customer.create({
      data: {
        id: customerId,
        fullName: data.fullName,
        phone: data.phone,
        email: "",
        address: data.address,
        ktpNumber: data.ktpNumber,
        guarantorName: data.guarantorName,
        guarantorPhone: data.guarantorPhone,
        spouseName: "",
        notes: "",
        rideHailingApps: [],
        createdAt: data.startDate,
      },
    });

    // ====== Calculate contract fields ======
    const totalDaysPaid = daysBetweenInclusive(billingStartDate, PAID_THROUGH);
    const endDate = addDays(data.startDate, totalDaysPaid);

    // Count working days (non-LB) for totalAmount
    let workingDays = 0;
    let cursor = new Date(billingStartDate);
    for (let i = 0; i < totalDaysPaid; i++) {
      if (!isLiburBayar(cursor)) workingDays++;
      cursor = addDays(cursor, 1);
    }

    const totalAmount = workingDays * dailyRate;
    const ownershipProgress = parseFloat(
      ((totalDaysPaid / OWN_TARGET) * 100).toFixed(2),
    );

    // ====== Create contract ======
    const contractId = uuidv4();
    await prisma.contract.create({
      data: {
        id: contractId,
        contractNumber: data.contractNumber,
        customerId,
        motorModel: data.motor,
        batteryType: data.battery,
        dailyRate,
        durationDays: totalDaysPaid,
        totalAmount,
        startDate: data.startDate,
        endDate,
        status: "ACTIVE",
        notes: "",
        createdBy: adminId,
        color: data.color,
        year: data.year,
        vinNumber: data.vin,
        engineNumber: data.engineNumber,
        dpAmount,
        dpScheme: "FULL",
        dpPaidAmount: dpAmount,
        dpFullyPaid: true,
        unitReceivedDate: data.unitReceivedDate,
        billingStartDate,
        bastPhoto: "https://storage.example.com/bast/sample.jpg",
        bastNotes: "Unit diterima dalam kondisi baik",
        holidayDaysPerMonth: HOLIDAY_PER_MONTH,
        ownershipTargetDays: OWN_TARGET,
        totalDaysPaid,
        ownershipProgress,
        gracePeriodDays: GRACE_DAYS,
        createdAt: data.startDate,
      },
    });

    // ====== DP Invoice (PAID) ======
    const dpInvNum = `PMT-${fmtDateCompact(data.startDate)}-${String(globalInvSeq++).padStart(4, "0")}`;
    allInvoices.push({
      id: uuidv4(),
      invoiceNumber: dpInvNum,
      contractId,
      customerId,
      amount: dpAmount,
      lateFee: 0,
      type: "DP",
      status: "PAID",
      qrCodeData: `WEDISON-PAY-${dpInvNum}-${dpAmount}`,
      dueDate: data.startDate,
      paidAt: data.startDate,
      createdAt: data.startDate,
    });

    // ====== Daily billings & invoices (billingStart → PAID_THROUGH) ======
    let currentDate = new Date(billingStartDate);
    while (currentDate <= PAID_THROUGH) {
      const y = currentDate.getFullYear();
      const m = currentDate.getMonth() + 1;
      const d = currentDate.getDate();
      const isHoliday = isLiburBayar(currentDate);

      if (isHoliday) {
        // LB Sunday: zero-amount auto-paid billing, no invoice
        allBillings.push({
          id: uuidv4(),
          billingNumber: `BIL-${fmtDateCompact(currentDate)}-${String(globalBilSeq++).padStart(4, "0")}`,
          contractId,
          customerId,
          amount: 0,
          dailyRate,
          daysCount: 0,
          status: "PAID",
          periodStart: startOfDay(y, m, d),
          periodEnd: endOfDay(y, m, d),
          paidAt: startOfDay(y, m, d),
          createdAt: startOfDay(y, m, d),
        });
      } else {
        // Working day: paid billing + paid invoice
        const bilId = uuidv4();
        const invId = uuidv4();
        const bilNum = `BIL-${fmtDateCompact(currentDate)}-${String(globalBilSeq++).padStart(4, "0")}`;
        const invNum = `PMT-${fmtDateCompact(currentDate)}-${String(globalInvSeq++).padStart(4, "0")}`;

        allBillings.push({
          id: bilId,
          billingNumber: bilNum,
          contractId,
          customerId,
          amount: dailyRate,
          dailyRate,
          daysCount: 1,
          status: "PAID",
          periodStart: startOfDay(y, m, d),
          periodEnd: endOfDay(y, m, d),
          paidAt: startOfDay(y, m, d),
          invoiceId: invId,
          createdAt: startOfDay(y, m, d),
        });

        allInvoices.push({
          id: invId,
          invoiceNumber: invNum,
          contractId,
          customerId,
          amount: dailyRate,
          lateFee: 0,
          type: "DAILY_BILLING",
          status: "PAID",
          qrCodeData: `WEDISON-PAY-${invNum}-${dailyRate}`,
          dueDate: endOfDay(y, m, d),
          paidAt: startOfDay(y, m, d),
          extensionDays: 1,
          billingId: bilId,
          billingPeriodStart: startOfDay(y, m, d),
          billingPeriodEnd: endOfDay(y, m, d),
          createdAt: startOfDay(y, m, d),
        });
      }

      currentDate = addDays(currentDate, 1);
    }

    // ====== Active billing for today (March 4) — not paid yet ======
    const ty = TODAY.getFullYear();
    const tm = TODAY.getMonth() + 1;
    const td = TODAY.getDate();
    allBillings.push({
      id: uuidv4(),
      billingNumber: `BIL-${fmtDateCompact(TODAY)}-${String(globalBilSeq++).padStart(4, "0")}`,
      contractId,
      customerId,
      amount: dailyRate,
      dailyRate,
      daysCount: 1,
      status: "ACTIVE",
      periodStart: startOfDay(ty, tm, td),
      periodEnd: endOfDay(ty, tm, td),
      createdAt: startOfDay(ty, tm, td),
    });

    // ====== Audit log ======
    allAuditLogs.push({
      id: uuidv4(),
      userId: adminId,
      action: "CREATE",
      module: "contract",
      entityId: contractId,
      description: `Created contract ${data.contractNumber} for ${data.fullName} - ${data.motor} ${data.battery} (DP: FULL)`,
      metadata: {
        contractNumber: data.contractNumber,
        motorModel: data.motor,
        batteryType: data.battery,
        dpScheme: "FULL",
        dpAmount,
      },
      ipAddress: "127.0.0.1",
      createdAt: data.startDate,
    });

    console.log(
      `  ${data.contractNumber} | ${data.fullName} | ${totalDaysPaid} days paid (${workingDays} working) | endDate: ${endDate.toISOString().slice(0, 10)} | progress: ${ownershipProgress}%`,
    );
  }

  // ====== Bulk insert ======
  console.log(`\nInserting ${allInvoices.length} invoices...`);
  await prisma.invoice.createMany({ data: allInvoices });

  console.log(`Inserting ${allBillings.length} billings...`);
  await prisma.billing.createMany({ data: allBillings });

  console.log(`Inserting ${allAuditLogs.length} audit logs...`);
  await prisma.auditLog.createMany({ data: allAuditLogs });

  console.log(`\nSeed complete!`);
  console.log(`  ${DATA.length} customers`);
  console.log(
    `  ${DATA.length} contracts (all ACTIVE, paid through ${PAID_THROUGH.toISOString().slice(0, 10)})`,
  );
  console.log(`  ${allInvoices.length} invoices (DP + daily billing)`);
  console.log(
    `  ${allBillings.length} billings (paid + ${DATA.length} active for today)`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
