import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { customers } from "./data/customers";
import { contracts, DateTuple } from "./data/contracts";

const prisma = new PrismaClient();

// ====== CLI Flags ======
const args = process.argv.slice(2);
const RESET = args.includes("--reset");
const FORCE = args.includes("--force");

// ====== Environment Guard ======
function checkEnvironment() {
  const env = process.env.NODE_ENV || "development";
  if (env === "production" && RESET && !FORCE) {
    console.error(
      "ERROR: --reset in production requires --force flag.\n" +
        "  Usage: npx ts-node prisma/seed.ts --reset --force\n" +
        "  This will DELETE ALL existing data before re-seeding.",
    );
    process.exit(1);
  }
  if (RESET) {
    console.warn(
      `WARNING: Running with --reset in [${env}] — all data will be wiped.\n`,
    );
  }
}

// ====== Date Helpers ======
function toDate([y, m, d]: DateTuple): Date {
  return new Date(y, m - 1, d, 9, 0, 0, 0);
}

function addDays(date: Date, n: number): Date {
  const r = new Date(date);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function getWibToday(): Date {
  const now = new Date();
  const wibStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const [y, m, d] = wibStr.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function fmtDateCompact(d: Date): string {
  return `${d.getFullYear().toString().slice(-2)}${(d.getMonth() + 1).toString().padStart(2, "0")}${d.getDate().toString().padStart(2, "0")}`;
}

// ====== Libur Bayar ======
function isLiburBayar(
  d: Date,
  scheme: "OLD_CONTRACT" | "NEW_CONTRACT",
): boolean {
  if (scheme === "OLD_CONTRACT") {
    return d.getDay() === 0; // Semua Minggu = libur
  } else {
    return d.getDate() > 28; // Tanggal 29-31 = libur
  }
}

// Walk calendar from billingStart, count N working days + all holidays in between
function countCalendarDays(
  billingStart: Date,
  workingDays: number,
  scheme: "OLD_CONTRACT" | "NEW_CONTRACT",
) {
  let cursor = new Date(billingStart);
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
    value: String(GRACE_DAYS),
    description: "Masa tenggang sebelum repossession",
  },
  {
    key: "late_fee_per_day",
    value: "10000",
    description: "Denda keterlambatan per hari",
  },
  {
    key: "default_holiday_scheme",
    value: "NEW_CONTRACT",
    description: "Skema libur bayar default (OLD_CONTRACT / NEW_CONTRACT)",
  },
];

// ====== Seed Functions ======

async function seedAdminUser(): Promise<string> {
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      id: uuidv4(),
      username: "admin",
      password: "admin123",
      fullName: "Administrator",
      role: "ADMIN",
      isActive: true,
    },
  });
  console.log(`  Admin user: ${admin.id} (upserted)`);
  return admin.id;
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
  console.log("\n[RESET] Deleting existing data...");
  const counts = {
    auditLogs: await prisma.auditLog.deleteMany({}),
    invoices: await prisma.invoice.deleteMany({}),
    contracts: await prisma.contract.deleteMany({}),
    customers: await prisma.customer.deleteMany({}),
  };
  console.log(
    `  Deleted: ${counts.auditLogs.count} audit logs, ${counts.invoices.count} payments, ${counts.contracts.count} contracts, ${counts.customers.count} customers`,
  );
}

async function seedCustomers(): Promise<number> {
  const existingKtps = new Set(
    (await prisma.customer.findMany({ select: { ktpNumber: true } })).map(
      (c) => c.ktpNumber,
    ),
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

  console.log(
    `  Customers: ${created} created, ${skipped} skipped (already exist)`,
  );
  return created;
}

async function seedContracts(
  adminId: string,
): Promise<{ contractCount: number; paymentCount: number }> {
  const TODAY = startOfDay(getWibToday());
  const existingContracts = new Set(
    (await prisma.contract.findMany({ select: { contractNumber: true } })).map(
      (c) => c.contractNumber,
    ),
  );

  const allPayments: any[] = [];
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
    const unitReceivedDate = row.unitReceivedDate
      ? toDate(row.unitReceivedDate)
      : null;
    const repossessedAt = row.repossessedAt ? toDate(row.repossessedAt) : null;
    const cancelledAt = row.cancelledAt ? toDate(row.cancelledAt) : null;
    const workingDaysPaid = row.workingDaysPaid ?? 0;

    const billingStartDate = unitReceivedDate
      ? addDays(unitReceivedDate, 1)
      : null;

    // Calculate totalDaysPaid (working + holidays), endDate, and workingDays
    let totalDaysPaid = 0;
    let workingDays = 0;
    let endDate: Date;
    if (billingStartDate && workingDaysPaid > 0) {
      const calc = countCalendarDays(
        billingStartDate,
        workingDaysPaid,
        row.holidayScheme,
      );
      totalDaysPaid = calc.totalDaysPaid;
      workingDays = calc.workingCount;
      endDate = calc.lastDate;
    } else {
      endDate = startDate;
    }

    const totalAmount = workingDays * dailyRate;
    const ownershipProgress = parseFloat(
      ((totalDaysPaid / OWN_TARGET) * 100).toFixed(2),
    );

    // Auto-detect OVERDUE: jika ACTIVE tapi endDate + grace period sudah lewat
    let finalStatus: string = row.status;
    if (row.status === "ACTIVE" && billingStartDate && workingDaysPaid > 0) {
      const graceEnd = new Date(endDate);
      graceEnd.setDate(graceEnd.getDate() + GRACE_DAYS);
      if (graceEnd < TODAY) {
        finalStatus = "OVERDUE" as any;
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
        bastPhoto: unitReceivedDate
          ? "https://storage.example.com/bast/sample.jpg"
          : null,
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
    if (row.dpScheme === "FULL") {
      const pmtNum = `PMT-${fmtDateCompact(startDate)}-${String(globalSeq++).padStart(4, "0")}`;
      allPayments.push({
        id: uuidv4(),
        invoiceNumber: pmtNum,
        contractId: row.id,
        customerId: row.customerId,
        amount: dpAmount,
        lateFee: 0,
        type: "DP",
        status: dpFullyPaid ? "PAID" : "PENDING",
        qrCodeData: `WEDISON-PAY-${pmtNum}-${dpAmount}`,
        dueDate: startDate,
        paidAt: dpFullyPaid ? startDate : null,
        createdAt: startDate,
      });
    } else {
      const half1 = Math.ceil(dpAmount / 2);
      const half2 = dpAmount - half1;
      const pmtNum1 = `PMT-${fmtDateCompact(startDate)}-${String(globalSeq++).padStart(4, "0")}`;
      const pmtNum2 = `PMT-${fmtDateCompact(startDate)}-${String(globalSeq++).padStart(4, "0")}`;
      allPayments.push({
        id: uuidv4(),
        invoiceNumber: pmtNum1,
        contractId: row.id,
        customerId: row.customerId,
        amount: half1,
        lateFee: 0,
        type: "DP_INSTALLMENT",
        status: dpPaidAmount >= half1 ? "PAID" : "PENDING",
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
        type: "DP_INSTALLMENT",
        status: dpPaidAmount >= dpAmount ? "PAID" : "PENDING",
        qrCodeData: `WEDISON-PAY-${pmtNum2}-${half2}`,
        dueDate: unitReceivedDate || addDays(startDate, 7),
        paidAt: dpPaidAmount >= dpAmount ? unitReceivedDate || startDate : null,
        createdAt: startDate,
      });
    }

    // ====== Daily payments for paid days (walk calendar, not linear count) ======
    if (billingStartDate && workingDaysPaid > 0) {
      let currentDate = new Date(billingStartDate);
      let generatedWorkingDays = 0;
      while (generatedWorkingDays < workingDaysPaid) {
        const isHoliday = isLiburBayar(currentDate, row.holidayScheme);
        const sd = startOfDay(currentDate);
        const ed = endOfDay(currentDate);

        if (isHoliday) {
          // Holiday payment: amount 0, auto-PAID, credits 1 day
          const pmtNum = `PMT-${fmtDateCompact(currentDate)}-${String(globalSeq++).padStart(4, "0")}`;
          allPayments.push({
            id: uuidv4(),
            invoiceNumber: pmtNum,
            contractId: row.id,
            customerId: row.customerId,
            amount: 0,
            lateFee: 0,
            type: "DAILY_BILLING",
            status: "PAID",
            qrCodeData: `WEDISON-PAY-${pmtNum}-0`,
            dueDate: ed,
            paidAt: sd,
            extensionDays: 0,
            dailyRate,
            daysCount: 0,
            periodStart: sd,
            periodEnd: ed,
            isHoliday: true,
            createdAt: sd,
          });
        } else {
          // Normal daily payment: PAID
          const pmtNum = `PMT-${fmtDateCompact(currentDate)}-${String(globalSeq++).padStart(4, "0")}`;
          allPayments.push({
            id: uuidv4(),
            invoiceNumber: pmtNum,
            contractId: row.id,
            customerId: row.customerId,
            amount: dailyRate,
            lateFee: 0,
            type: "DAILY_BILLING",
            status: "PAID",
            qrCodeData: `WEDISON-PAY-${pmtNum}-${dailyRate}`,
            dueDate: ed,
            paidAt: sd,
            extensionDays: 1,
            dailyRate,
            daysCount: 1,
            periodStart: sd,
            periodEnd: ed,
            isHoliday: false,
            createdAt: sd,
          });
          generatedWorkingDays++;
        }
        currentDate = addDays(currentDate, 1);
      }
    }

    // ====== Active payment for today (unpaid days for ACTIVE/OVERDUE contracts) ======
    if (
      (finalStatus === "ACTIVE" || finalStatus === "OVERDUE") &&
      unitReceivedDate &&
      billingStartDate &&
      workingDaysPaid > 0
    ) {
      let unpaidDays = 0;
      let accCursor = startOfDay(addDays(endDate, 1));
      while (accCursor <= TODAY) {
        if (!isLiburBayar(accCursor, row.holidayScheme)) unpaidDays++;
        accCursor = startOfDay(addDays(accCursor, 1));
      }
      if (unpaidDays > 0) {
        const pmtNum = `PMT-${fmtDateCompact(TODAY)}-${String(globalSeq++).padStart(4, "0")}`;
        allPayments.push({
          id: uuidv4(),
          invoiceNumber: pmtNum,
          contractId: row.id,
          customerId: row.customerId,
          amount: unpaidDays * dailyRate,
          lateFee: 0,
          type: "DAILY_BILLING",
          status: "PENDING",
          qrCodeData: `WEDISON-PAY-${pmtNum}-${unpaidDays * dailyRate}`,
          dueDate: endOfDay(TODAY),
          dailyRate,
          daysCount: unpaidDays,
          extensionDays: unpaidDays,
          periodStart: startOfDay(addDays(endDate, 1)),
          periodEnd: endOfDay(TODAY),
          isHoliday: false,
          createdAt: startOfDay(TODAY),
        });
      }
    }

    // ====== Audit log ======
    allAuditLogs.push({
      id: uuidv4(),
      userId: adminId,
      action: "CREATE",
      module: "contract",
      entityId: row.id,
      description: `Created contract ${row.contractNumber} for ${row.customerName} - ${row.motorModel} ${row.batteryType} (DP: ${row.dpScheme})`,
      metadata: {
        contractNumber: row.contractNumber,
        motorModel: row.motorModel,
        batteryType: row.batteryType,
        dpScheme: row.dpScheme,
        dpAmount,
      },
      ipAddress: "127.0.0.1",
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

  console.log(`  Contracts: ${contractsCreated} created`);
  console.log(`  Payments: ${allPayments.length} (DP + daily)`);
  console.log(`  Audit logs: ${allAuditLogs.length}`);

  return { contractCount: contractsCreated, paymentCount: allPayments.length };
}

// ====== Main ======
async function main() {
  checkEnvironment();

  console.log("=== WEDISON RTO Seed ===\n");

  // Step 1: Always upsert reference data (idempotent)
  console.log("[1/4] Reference data (idempotent):");
  const adminId = await seedAdminUser();
  await seedSettings();

  // Step 2: Check if data already exists
  const existingContracts = await prisma.contract.count();
  if (existingContracts > 0 && !RESET) {
    console.log(
      `\n[SKIP] Database already has ${existingContracts} contracts.`,
    );
    console.log("  To re-seed, run with --reset flag:");
    console.log("  npx ts-node prisma/seed.ts --reset");
    console.log("\n  Reference data (admin + settings) was updated.");
    return;
  }

  // Step 3: Reset if requested
  if (RESET) {
    await resetData();
  }

  // Step 4: Seed master data + derived data
  console.log("\n[2/4] Seeding customers:");
  await seedCustomers();

  console.log("\n[3/4] Seeding contracts + payment history:");
  const { paymentCount } = await seedContracts(adminId);

  // Summary
  const activeCount = contracts.filter((c) => c.status === "ACTIVE").length;
  const repossessedCount = contracts.filter(
    (c) => c.status === "REPOSSESSED",
  ).length;
  const cancelledCount = contracts.filter(
    (c) => c.status === "CANCELLED",
  ).length;

  console.log("\n[4/4] Summary:");
  console.log(`  ${customers.length} customers in data file`);
  console.log(
    `  ${contracts.length} contracts (${activeCount} active, ${repossessedCount} repossessed, ${cancelledCount} cancelled)`,
  );
  console.log(`  ${paymentCount} payments`);
  console.log("\nSeed complete!");
}

main()
  .catch((e) => {
    console.error("\nSeed failed:", e.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
