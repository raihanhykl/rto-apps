import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import bcryptjs from 'bcryptjs';
import { customers } from './data/customers';
import { contracts, DateTuple } from './data/contracts';
import { users } from './data/users';

const prisma = new PrismaClient();

// ====== CLI Flags ======
const args = process.argv.slice(2);
const RESET = args.includes('--reset');
const FORCE = args.includes('--force');

// ====== Environment Guard ======
function checkEnvironment() {
  const env = process.env.NODE_ENV || 'development';
  if (env === 'production' && RESET && !FORCE) {
    console.error(
      'ERROR: --reset in production requires --force flag.\n' +
        '  Usage: npx ts-node prisma/seed.ts --reset --force\n' +
        '  This will DELETE ALL existing data before re-seeding.',
    );
    process.exit(1);
  }
  if (RESET) {
    console.warn(`WARNING: Running with --reset in [${env}] — all data will be wiped.\n`);
  }
}

// ====== Date Helpers (UTC-safe) ======
// Semua date helpers menggunakan Date.UTC() agar timestamp konsisten
// di mesin manapun (WIB, UTC, US/Pacific, dll).
// Tanggal disimpan sebagai midnight UTC dari tanggal WIB yang dimaksud.

function toDate([y, m, d]: DateTuple): Date {
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

function addDays(date: Date, n: number): Date {
  const r = new Date(date.getTime());
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function startOfDay(d: Date): Date {
  const wib = getWibParts(d);
  return new Date(Date.UTC(wib.year, wib.month - 1, wib.day, 0, 0, 0, 0));
}

function getWibToday(): Date {
  const now = new Date();
  const wibStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const [y, m, d] = wibStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

function toDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

function fmtDateCompact(d: Date): string {
  const wib = getWibParts(d);
  return `${wib.year.toString().slice(-2)}${wib.month.toString().padStart(2, '0')}${wib.day.toString().padStart(2, '0')}`;
}

// ====== Libur Bayar ======
function getWibParts(date: Date): { year: number; month: number; day: number; dayOfWeek: number } {
  const wibStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const [y, m, d] = wibStr.split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  return { year: y, month: m, day: d, dayOfWeek: utcDate.getUTCDay() };
}

function isLiburBayar(d: Date, scheme: 'OLD_CONTRACT' | 'NEW_CONTRACT'): boolean {
  const wib = getWibParts(d);
  if (scheme === 'OLD_CONTRACT') {
    return wib.dayOfWeek === 0; // Semua Minggu = libur
  } else {
    return wib.day > 28; // Tanggal 29-31 = libur
  }
}

// Walk calendar from billingStart, count N working days + all holidays in between
function countCalendarDays(
  billingStart: Date,
  workingDays: number,
  scheme: 'OLD_CONTRACT' | 'NEW_CONTRACT',
) {
  let cursor = new Date(billingStart.getTime());
  let workingCount = 0;
  let holidayCount = 0;
  while (workingCount < workingDays) {
    if (isLiburBayar(cursor, scheme)) {
      holidayCount++;
    } else {
      workingCount++;
    }
    if (workingCount < workingDays) cursor = addDays(cursor, 1);
  }
  return {
    totalDaysPaid: workingCount + holidayCount,
    workingCount,
    holidayCount,
    lastDate: cursor,
  };
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

const DEFAULT_SETTINGS = [
  {
    key: 'max_rental_days',
    value: '7',
    description: 'Maksimum hari perpanjangan',
  },
  {
    key: 'ownership_target_days',
    value: '1278',
    description: 'Target hari kepemilikan penuh',
  },
  {
    key: 'grace_period_days',
    value: String(GRACE_DAYS),
    description: 'Masa tenggang sebelum repossession',
  },
  {
    key: 'late_fee_per_day',
    value: '10000',
    description: 'Denda keterlambatan per hari',
  },
  {
    key: 'default_holiday_scheme',
    value: 'NEW_CONTRACT',
    description: 'Skema libur bayar default (OLD_CONTRACT / NEW_CONTRACT)',
  },
];

// ====== Seed Functions ======

async function seedUsers(): Promise<string> {
  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD;
  if (!defaultPassword) {
    console.error('❌ SEED_DEFAULT_PASSWORD env var is required for seeding users.');
    console.error('   Set it in your .env file or pass it inline:');
    console.error('   SEED_DEFAULT_PASSWORD=yourpassword npx prisma db seed');
    process.exit(1);
  }

  let firstAdminId = '';

  for (const user of users) {
    const password = process.env[user.passwordEnv] || defaultPassword;
    const hashedPassword = bcryptjs.hashSync(password, 10);

    const result = await prisma.user.upsert({
      where: { username: user.username },
      update: {},
      create: {
        id: uuidv4(),
        username: user.username,
        password: hashedPassword,
        fullName: user.fullName,
        role: user.role,
        isActive: true,
      },
    });

    console.log(`  User: ${result.username} (${user.role}) — upserted`);

    // Return the first SUPER_ADMIN or ADMIN id for audit logs
    if (!firstAdminId && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN')) {
      firstAdminId = result.id;
    }
  }

  return firstAdminId;
}

async function seedSettings() {
  for (const s of DEFAULT_SETTINGS) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: { id: uuidv4(), ...s },
    });
  }
  console.log(`  Settings: ${DEFAULT_SETTINGS.length} keys (upserted)`);
}

async function resetData() {
  console.log('\n[RESET] Deleting existing data...');
  const counts = {
    savingTransactions: await prisma.savingTransaction.deleteMany({}),
    paymentDays: await prisma.paymentDay.deleteMany({}),
    auditLogs: await prisma.auditLog.deleteMany({}),
    invoices: await prisma.invoice.deleteMany({}),
    contracts: await prisma.contract.deleteMany({}),
    customers: await prisma.customer.deleteMany({}),
  };
  console.log(
    `  Deleted: ${counts.savingTransactions.count} saving txns, ${counts.paymentDays.count} payment days, ${counts.auditLogs.count} audit logs, ${counts.invoices.count} payments, ${counts.contracts.count} contracts, ${counts.customers.count} customers`,
  );
}

async function seedCustomers(): Promise<number> {
  const existingKtps = new Set(
    (await prisma.customer.findMany({ select: { ktpNumber: true } })).map((c) => c.ktpNumber),
  );

  let created = 0;
  let skipped = 0;

  for (const c of customers) {
    if (existingKtps.has(c.ktpNumber)) {
      skipped++;
      continue;
    }

    await prisma.customer.create({
      data: {
        id: c.id,
        fullName: c.fullName,
        phone: c.phone,
        email: c.email,
        address: c.address,
        ktpNumber: c.ktpNumber,
        birthDate: c.birthDate,
        gender: c.gender as any,
        rideHailingApps: c.rideHailingApps,
        guarantorName: c.guarantorName,
        guarantorPhone: c.guarantorPhone,
        spouseName: c.spouseName,
        notes: c.notes,
      },
    });
    existingKtps.add(c.ktpNumber);
    created++;
  }

  console.log(`  Customers: ${created} created, ${skipped} skipped (already exist)`);
  return created;
}

async function seedContracts(adminId: string): Promise<{
  contractCount: number;
  paymentCount: number;
  paymentDayCount: number;
}> {
  const TODAY = startOfDay(getWibToday());
  const existingContracts = new Set(
    (await prisma.contract.findMany({ select: { contractNumber: true } })).map(
      (c) => c.contractNumber,
    ),
  );

  const allPayments: any[] = [];
  const allPaymentDays: any[] = [];
  const allAuditLogs: any[] = [];
  let globalSeq = 1;
  let contractsCreated = 0;

  for (const row of contracts) {
    if (existingContracts.has(row.contractNumber)) continue;

    const rateKey = `${row.motorModel}_${row.batteryType}`;
    const dailyRate = RATES[rateKey] || 63000;
    const dpAmount = DPS[rateKey] || 580000;
    const dpPaidAmount = row.dpPaid;
    const dpFullyPaid = dpPaidAmount >= dpAmount;

    const startDate = toDate(row.startDate);
    const unitReceivedDate = row.unitReceivedDate ? toDate(row.unitReceivedDate) : null;
    const repossessedAt = row.repossessedAt ? toDate(row.repossessedAt) : null;
    const cancelledAt = row.cancelledAt ? toDate(row.cancelledAt) : null;
    const workingDaysPaid = row.workingDaysPaid ?? 0;

    const billingStartDate = unitReceivedDate ? addDays(unitReceivedDate, 1) : null;

    // Calculate totalDaysPaid (working + holidays), endDate, and workingDays
    let totalDaysPaid = 0;
    let workingDays = 0;
    let endDate: Date;
    if (billingStartDate && workingDaysPaid > 0) {
      const calc = countCalendarDays(billingStartDate, workingDaysPaid, row.holidayScheme);
      totalDaysPaid = calc.totalDaysPaid;
      workingDays = calc.workingCount;
      endDate = calc.lastDate;
    } else {
      endDate = startDate;
    }

    const totalAmount = workingDays * dailyRate;
    const ownershipProgress = parseFloat(((totalDaysPaid / OWN_TARGET) * 100).toFixed(2));

    // Auto-detect OVERDUE: jika ACTIVE tapi endDate + grace period sudah lewat
    let finalStatus: string = row.status;
    if (row.status === 'ACTIVE' && billingStartDate && workingDaysPaid > 0) {
      const graceEnd = addDays(endDate, GRACE_DAYS);
      if (graceEnd < TODAY) {
        finalStatus = 'OVERDUE' as any;
      }
    }

    const notes = cancelledAt
      ? `[CANCELLED] Dibatalkan pada ${cancelledAt.toISOString().slice(0, 10)}. ${row.notes}`
      : row.notes;

    await prisma.contract.create({
      data: {
        id: row.id,
        contractNumber: row.contractNumber,
        customerId: row.customerId,
        motorModel: row.motorModel as any,
        batteryType: row.batteryType as any,
        dailyRate,
        durationDays: totalDaysPaid,
        totalAmount,
        startDate,
        endDate,
        status: finalStatus as any,
        notes,
        createdBy: adminId,
        color: row.color,
        year: row.year,
        vinNumber: row.vinNumber,
        engineNumber: row.engineNumber,
        dpAmount,
        dpScheme: row.dpScheme as any,
        dpPaidAmount,
        dpFullyPaid,
        unitReceivedDate,
        billingStartDate,
        bastPhoto: unitReceivedDate ? 'https://storage.example.com/bast/sample.jpg' : null,
        bastNotes: row.bastNotes,
        holidayScheme: row.holidayScheme as any,
        ownershipTargetDays: OWN_TARGET,
        totalDaysPaid,
        workingDaysPaid: workingDays,
        holidayDaysPaid: totalDaysPaid - workingDays,
        ownershipProgress,
        gracePeriodDays: GRACE_DAYS,
        repossessedAt,
        createdAt: startDate,
      },
    });
    contractsCreated++;

    // ====== DP Payments ======
    if (row.dpScheme === 'FULL') {
      const pmtNum = `PMT-${fmtDateCompact(startDate)}-${String(globalSeq++).padStart(4, '0')}`;
      allPayments.push({
        id: uuidv4(),
        invoiceNumber: pmtNum,
        contractId: row.id,
        customerId: row.customerId,
        amount: dpAmount,
        lateFee: 0,
        type: 'DP',
        status: dpFullyPaid ? 'PAID' : 'PENDING',
        qrCodeData: `WEDISON-PAY-${pmtNum}-${dpAmount}`,
        dueDate: startDate,
        paidAt: dpFullyPaid ? startDate : null,
        createdAt: startDate,
      });
    } else {
      const half1 = Math.ceil(dpAmount / 2);
      const half2 = dpAmount - half1;
      const pmtNum1 = `PMT-${fmtDateCompact(startDate)}-${String(globalSeq++).padStart(4, '0')}`;
      const pmtNum2 = `PMT-${fmtDateCompact(startDate)}-${String(globalSeq++).padStart(4, '0')}`;
      allPayments.push({
        id: uuidv4(),
        invoiceNumber: pmtNum1,
        contractId: row.id,
        customerId: row.customerId,
        amount: half1,
        lateFee: 0,
        type: 'DP_INSTALLMENT',
        status: dpPaidAmount >= half1 ? 'PAID' : 'PENDING',
        qrCodeData: `WEDISON-PAY-${pmtNum1}-${half1}`,
        dueDate: startDate,
        paidAt: dpPaidAmount >= half1 ? startDate : null,
        createdAt: startDate,
      });
      allPayments.push({
        id: uuidv4(),
        invoiceNumber: pmtNum2,
        contractId: row.id,
        customerId: row.customerId,
        amount: half2,
        lateFee: 0,
        type: 'DP_INSTALLMENT',
        status: dpPaidAmount >= dpAmount ? 'PAID' : 'PENDING',
        qrCodeData: `WEDISON-PAY-${pmtNum2}-${half2}`,
        dueDate: unitReceivedDate || addDays(startDate, 7),
        paidAt: dpPaidAmount >= dpAmount ? unitReceivedDate || startDate : null,
        createdAt: startDate,
      });
    }

    // ====== Daily payments for paid days (walk calendar, not linear count) ======
    if (billingStartDate && workingDaysPaid > 0) {
      let currentDate = new Date(billingStartDate.getTime());
      let generatedWorkingDays = 0;
      while (generatedWorkingDays < workingDaysPaid) {
        const isHoliday = isLiburBayar(currentDate, row.holidayScheme);
        const sd = startOfDay(currentDate);

        if (isHoliday) {
          // Holiday payment: amount 0, auto-PAID, credits 1 day
          const pmtNum = `PMT-${fmtDateCompact(currentDate)}-${String(globalSeq++).padStart(4, '0')}`;
          allPayments.push({
            id: uuidv4(),
            invoiceNumber: pmtNum,
            contractId: row.id,
            customerId: row.customerId,
            amount: 0,
            lateFee: 0,
            type: 'DAILY_BILLING',
            status: 'PAID',
            qrCodeData: `WEDISON-PAY-${pmtNum}-0`,
            dueDate: sd,
            paidAt: sd,
            extensionDays: 0,
            dailyRate,
            daysCount: 0,
            periodStart: sd,
            periodEnd: sd,
            isHoliday: true,
            createdAt: sd,
          });
        } else {
          // Normal daily payment: PAID
          const pmtNum = `PMT-${fmtDateCompact(currentDate)}-${String(globalSeq++).padStart(4, '0')}`;
          allPayments.push({
            id: uuidv4(),
            invoiceNumber: pmtNum,
            contractId: row.id,
            customerId: row.customerId,
            amount: dailyRate,
            lateFee: 0,
            type: 'DAILY_BILLING',
            status: 'PAID',
            qrCodeData: `WEDISON-PAY-${pmtNum}-${dailyRate}`,
            dueDate: sd,
            paidAt: sd,
            extensionDays: 1,
            dailyRate,
            daysCount: 1,
            periodStart: sd,
            periodEnd: sd,
            isHoliday: false,
            createdAt: sd,
          });
          generatedWorkingDays++;
        }
        currentDate = addDays(currentDate, 1);
      }
    }

    // NOTE: PENDING DAILY_BILLING invoices TIDAK dibuat oleh seed.
    // Biarkan scheduler yang generate saat startup — scheduler akan menghitung
    // lateFee dengan benar via calculateLateFee(). Hari-hari yang belum dibayar
    // tetap menjadi PaymentDay UNPAID di bawah ini.

    // ====== PaymentDay records ======
    if (billingStartDate) {
      // Build a map: dateKey -> paymentId+status for payments of this contract
      const paymentDateMap = new Map<string, { id: string; status: string }>();
      for (const pmt of allPayments) {
        if (pmt.contractId !== row.id) continue;
        if (pmt.type !== 'DAILY_BILLING') continue;
        if (!pmt.periodStart || !pmt.periodEnd) continue;
        let d = startOfDay(new Date(pmt.periodStart));
        const end = startOfDay(new Date(pmt.periodEnd));
        while (d <= end) {
          paymentDateMap.set(toDateKey(d), { id: pmt.id, status: pmt.status });
          d = addDays(d, 1);
        }
      }

      // Walk from billingStartDate to today+30 (or terminate date for cancelled/repossessed)
      const terminateDate =
        finalStatus === 'CANCELLED' || finalStatus === 'REPOSSESSED'
          ? repossessedAt || cancelledAt || TODAY
          : null;
      const pdEnd = addDays(TODAY, 30);

      let pdCursor = new Date(billingStartDate.getTime());
      while (pdCursor <= pdEnd) {
        const d = startOfDay(new Date(pdCursor));
        const key = toDateKey(d);
        const isHoliday = isLiburBayar(d, row.holidayScheme);
        const pmt = paymentDateMap.get(key);

        let status: string;
        let paymentId: string | null = null;
        const amount = isHoliday ? 0 : dailyRate;

        if (isHoliday) {
          status = 'HOLIDAY';
          if (pmt) paymentId = pmt.id;
        } else if (pmt && pmt.status === 'PAID') {
          status = 'PAID';
          paymentId = pmt.id;
        } else if (pmt && pmt.status === 'PENDING') {
          status = 'PENDING';
          paymentId = pmt.id;
        } else {
          status = 'UNPAID';
        }

        // Cancelled/repossessed: VOID all UNPAID days after terminate date
        if (terminateDate && d > terminateDate && status === 'UNPAID') {
          status = 'VOIDED';
        }

        allPaymentDays.push({
          id: uuidv4(),
          contractId: row.id,
          date: d,
          status,
          paymentId,
          dailyRate,
          amount,
          notes: null,
          createdAt: d,
        });

        pdCursor = addDays(pdCursor, 1);
      }
    }

    // ====== Audit log ======
    allAuditLogs.push({
      id: uuidv4(),
      userId: adminId,
      action: 'CREATE',
      module: 'contract',
      entityId: row.id,
      description: `Created contract ${row.contractNumber} for ${row.customerName} - ${row.motorModel} ${row.batteryType} (DP: ${row.dpScheme})`,
      metadata: {
        contractNumber: row.contractNumber,
        motorModel: row.motorModel,
        batteryType: row.batteryType,
        dpScheme: row.dpScheme,
        dpAmount,
      },
      ipAddress: '127.0.0.1',
      createdAt: startDate,
    });
  }

  // ====== Bulk insert in batches ======
  const BATCH = 500;

  for (let i = 0; i < allPayments.length; i += BATCH) {
    await prisma.invoice.createMany({ data: allPayments.slice(i, i + BATCH) });
  }

  for (let i = 0; i < allAuditLogs.length; i += BATCH) {
    await prisma.auditLog.createMany({
      data: allAuditLogs.slice(i, i + BATCH),
    });
  }

  for (let i = 0; i < allPaymentDays.length; i += BATCH) {
    await prisma.paymentDay.createMany({
      data: allPaymentDays.slice(i, i + BATCH),
      skipDuplicates: true,
    });
  }

  console.log(`  Contracts: ${contractsCreated} created`);
  console.log(`  Payments: ${allPayments.length} (DP + daily)`);
  console.log(`  Payment days: ${allPaymentDays.length}`);
  console.log(`  Audit logs: ${allAuditLogs.length}`);

  return {
    contractCount: contractsCreated,
    paymentCount: allPayments.length,
    paymentDayCount: allPaymentDays.length,
  };
}

// ====== Main ======
async function main() {
  checkEnvironment();

  console.log('=== WEDISON RTO Seed ===\n');

  // Step 1: Always upsert reference data (idempotent)
  console.log('[1/4] Reference data (idempotent):');
  const adminId = await seedUsers();
  await seedSettings();

  // Step 2: Check if data already exists
  const existingContracts = await prisma.contract.count();
  if (existingContracts > 0 && !RESET) {
    console.log(`\n[SKIP] Database already has ${existingContracts} contracts.`);
    console.log('  To re-seed, run with --reset flag:');
    console.log('  npx ts-node prisma/seed.ts --reset');
    console.log('\n  Reference data (admin + settings) was updated.');
    return;
  }

  // Step 3: Reset if requested
  if (RESET) {
    await resetData();
  }

  // Step 4: Seed master data + derived data
  console.log('\n[2/4] Seeding customers:');
  await seedCustomers();

  console.log('\n[3/4] Seeding contracts + payment history:');
  const { paymentCount } = await seedContracts(adminId);

  // Summary
  const activeCount = contracts.filter((c) => c.status === 'ACTIVE').length;
  const repossessedCount = contracts.filter((c) => c.status === 'REPOSSESSED').length;
  const cancelledCount = contracts.filter((c) => c.status === 'CANCELLED').length;

  console.log('\n[4/4] Summary:');
  console.log(`  ${customers.length} customers in data file`);
  console.log(
    `  ${contracts.length} contracts (${activeCount} active, ${repossessedCount} repossessed, ${cancelledCount} cancelled)`,
  );
  console.log(`  ${paymentCount} payments`);
  console.log('\nSeed complete!');
}

main()
  .catch((e) => {
    console.error('\nSeed failed:', e.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
