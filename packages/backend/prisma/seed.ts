import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// Enums (match Prisma schema)
const Gender = { MALE: 'MALE' as const, FEMALE: 'FEMALE' as const };
const MotorModel = { ATHENA: 'ATHENA' as const, VICTORY: 'VICTORY' as const, EDPOWER: 'EDPOWER' as const };
const BatteryType = { REGULAR: 'REGULAR' as const, EXTENDED: 'EXTENDED' as const };
const ContractStatus = { ACTIVE: 'ACTIVE' as const, COMPLETED: 'COMPLETED' as const, OVERDUE: 'OVERDUE' as const, CANCELLED: 'CANCELLED' as const, REPOSSESSED: 'REPOSSESSED' as const };
const PaymentStatus = { PENDING: 'PENDING' as const, PAID: 'PAID' as const, FAILED: 'FAILED' as const, EXPIRED: 'EXPIRED' as const, VOID: 'VOID' as const };
const InvoiceType = { DP: 'DP' as const, DP_INSTALLMENT: 'DP_INSTALLMENT' as const, DAILY_BILLING: 'DAILY_BILLING' as const, MANUAL_PAYMENT: 'MANUAL_PAYMENT' as const };
const DPScheme = { FULL: 'FULL' as const, INSTALLMENT: 'INSTALLMENT' as const };
const AuditAction = { CREATE: 'CREATE' as const };

const MOTOR_DAILY_RATES: Record<string, number> = {
  ATHENA_REGULAR: 58000, ATHENA_EXTENDED: 63000,
  VICTORY_REGULAR: 58000, VICTORY_EXTENDED: 63000,
  EDPOWER_REGULAR: 83000, EDPOWER_EXTENDED: 83000,
};
const DP_AMOUNTS: Record<string, number> = {
  ATHENA_REGULAR: 530000, ATHENA_EXTENDED: 580000,
  VICTORY_REGULAR: 530000, VICTORY_EXTENDED: 580000,
  EDPOWER_REGULAR: 780000, EDPOWER_EXTENDED: 780000,
};
const DEFAULT_OWNERSHIP_TARGET_DAYS = 1278;
const DEFAULT_GRACE_PERIOD_DAYS = 7;
const DEFAULT_HOLIDAY_DAYS_PER_MONTH = 2;

const CUSTOMER_DATA = [
  { fullName: 'Budi Santoso', phone: '08123456789', email: 'budi.santoso@gmail.com', address: 'Jl. Sudirman No. 45, Jakarta Selatan', ktpNumber: '3174012305900001', birthDate: '1990-05-23', gender: Gender.MALE, rideHailingApps: ['Grab', 'Gojek'], guarantorName: 'Joko Santoso', guarantorPhone: '08129876543' },
  { fullName: 'Siti Rahmawati', phone: '08567891234', email: 'siti.rahma@yahoo.com', address: 'Jl. Gatot Subroto No. 12, Jakarta Pusat', ktpNumber: '3174024506880002', birthDate: '1988-06-15', gender: Gender.FEMALE, rideHailingApps: ['Gojek', 'Maxim'], guarantorName: 'Ahmad Rahmawati', guarantorPhone: '08561234567' },
  { fullName: 'Ahmad Hidayat', phone: '08198765432', email: 'ahmad.h@gmail.com', address: 'Jl. Kemang Raya No. 78, Jakarta Selatan', ktpNumber: '3174031207950003', birthDate: '1995-07-12', gender: Gender.MALE, rideHailingApps: ['Grab', 'Shopee'], guarantorName: 'Fatimah Hidayat', guarantorPhone: '08191234567' },
  { fullName: 'Dewi Lestari', phone: '08211234567', email: 'dewi.lestari@outlook.com', address: 'Jl. Ampera Raya No. 33, Jakarta Selatan', ktpNumber: '3174044408920004', birthDate: '1992-08-04', gender: Gender.FEMALE, rideHailingApps: ['Grab', 'Gojek', 'Indrive'], guarantorName: 'Bambang Lestari', guarantorPhone: '08219876543' },
  { fullName: 'Rizky Pratama', phone: '08534567890', email: 'rizky.p@gmail.com', address: 'Jl. Casablanca No. 100, Jakarta Selatan', ktpNumber: '3174050903970005', birthDate: '1997-03-09', gender: Gender.MALE, rideHailingApps: ['Maxim', 'Indrive'], guarantorName: 'Sari Pratama', guarantorPhone: '08539876543' },
  { fullName: 'Nur Fadilah', phone: '08157890123', email: 'nur.fadilah@gmail.com', address: 'Jl. Tebet Raya No. 55, Jakarta Selatan', ktpNumber: '3174061511940006', birthDate: '1994-11-15', gender: Gender.FEMALE, rideHailingApps: ['Gojek'], guarantorName: 'Hasan Fadilah', guarantorPhone: '08151234567' },
  { fullName: 'Hendra Wijaya', phone: '08789012345', email: 'hendra.w@yahoo.com', address: 'Jl. Pramuka No. 22, Jakarta Timur', ktpNumber: '3174072008910007', birthDate: '1991-08-20', gender: Gender.MALE, rideHailingApps: ['Grab', 'Gojek', 'Shopee'], guarantorName: 'Linda Wijaya', guarantorPhone: '08781234567' },
  { fullName: 'Rina Marlina', phone: '08345678901', email: 'rina.m@gmail.com', address: 'Jl. Cikini Raya No. 67, Jakarta Pusat', ktpNumber: '3174081703890008', birthDate: '1989-03-17', gender: Gender.FEMALE, rideHailingApps: ['Grab', 'Maxim'], guarantorName: 'Agus Marlina', guarantorPhone: '08341234567' },
];

const DEFAULT_SETTINGS = [
  { key: 'max_rental_days', value: '7', description: 'Maksimum hari perpanjangan' },
  { key: 'ownership_target_days', value: '1278', description: 'Target hari kepemilikan penuh' },
  { key: 'grace_period_days', value: '7', description: 'Masa tenggang sebelum repossession' },
  { key: 'late_fee_per_day', value: '10000', description: 'Denda keterlambatan per hari' },
  { key: 'holiday_days_per_month', value: '2', description: 'Jumlah hari libur bayar per bulan (Minggu)' },
];

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(9, 0, 0, 0);
  return d;
}

function generateContractNumber(idx: number): string {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  return `RTO-${y}${m}${(idx + 1).toString().padStart(2, '0')}-${(1000 + idx).toString()}`;
}

function generateInvoiceNumber(idx: number): string {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  return `PMT-${y}${m}${(idx + 1).toString().padStart(2, '0')}-${(2000 + idx).toString()}`;
}

function getSundayHolidays(year: number, month: number, holidayDaysPerMonth: number): Set<number> {
  const sundays: number[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, month - 1, d).getDay() === 0) sundays.push(d);
  }
  const N = sundays.length;
  const K = Math.min(holidayDaysPerMonth, N);
  const result = new Set<number>();
  for (let i = 0; i < K; i++) {
    const idx = Math.floor(i * N / K + N / (2 * K));
    result.add(sundays[idx]);
  }
  return result;
}

function isLiburBayar(date: Date, holidayDaysPerMonth: number): boolean {
  if (date.getDay() !== 0) return false;
  const holidays = getSundayHolidays(date.getFullYear(), date.getMonth() + 1, holidayDaysPerMonth);
  return holidays.has(date.getDate());
}

function advanceWorkingDays(startDate: Date, workingDays: number, holidayDaysPerMonth: number = DEFAULT_HOLIDAY_DAYS_PER_MONTH): Date {
  const result = new Date(startDate);
  let remaining = workingDays;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    if (!isLiburBayar(result, holidayDaysPerMonth)) remaining--;
  }
  return result;
}

async function main() {
  console.log('Seeding database...');

  // Seed admin user
  const existingAdmin = await prisma.user.findUnique({ where: { username: 'admin' } });
  let adminId: string;
  if (!existingAdmin) {
    const admin = await prisma.user.create({
      data: {
        id: uuidv4(),
        username: 'admin',
        password: 'admin123',
        fullName: 'Administrator',
        role: 'ADMIN',
        isActive: true,
      },
    });
    adminId = admin.id;
    console.log('Created admin user');
  } else {
    adminId = existingAdmin.id;
    console.log('Admin user already exists');
  }

  // Seed settings
  for (const setting of DEFAULT_SETTINGS) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      create: { id: uuidv4(), ...setting },
      update: {},
    });
  }
  console.log('Settings seeded');

  // Check if customers already exist
  const customerCount = await prisma.customer.count();
  if (customerCount > 0) {
    console.log('Data already seeded, skipping');
    return;
  }

  // Create customers
  const customers: Array<{ id: string }> = [];
  for (const data of CUSTOMER_DATA) {
    const customer = await prisma.customer.create({
      data: {
        id: uuidv4(),
        fullName: data.fullName,
        phone: data.phone,
        email: data.email,
        address: data.address,
        birthDate: data.birthDate,
        gender: data.gender,
        rideHailingApps: data.rideHailingApps,
        ktpNumber: data.ktpNumber,
        guarantorName: data.guarantorName,
        guarantorPhone: data.guarantorPhone,
        spouseName: '',
        notes: '',
        createdAt: daysAgo(Math.floor(Math.random() * 30) + 5),
      },
    });
    customers.push(customer);
  }

  // Contract scenarios
  const contractScenarios = [
    { customerIdx: 0, motor: MotorModel.ATHENA, battery: BatteryType.REGULAR, dpScheme: DPScheme.FULL, startDaysAgo: 20, status: ContractStatus.ACTIVE, dpPaid: true, unitReceived: true, totalDaysPaid: 14, extensionInvoices: [{ days: 7, paid: true }, { days: 7, paid: true }] },
    { customerIdx: 1, motor: MotorModel.VICTORY, battery: BatteryType.EXTENDED, dpScheme: DPScheme.INSTALLMENT, startDaysAgo: 10, status: ContractStatus.ACTIVE, dpPaid: true, unitReceived: true, totalDaysPaid: 7, extensionInvoices: [{ days: 7, paid: true }] },
    { customerIdx: 2, motor: MotorModel.EDPOWER, battery: BatteryType.REGULAR, dpScheme: DPScheme.FULL, startDaysAgo: 30, status: ContractStatus.ACTIVE, dpPaid: true, unitReceived: true, totalDaysPaid: 21, extensionInvoices: [{ days: 7, paid: true }, { days: 7, paid: true }, { days: 7, paid: true }, { days: 7, paid: false }] },
    { customerIdx: 3, motor: MotorModel.ATHENA, battery: BatteryType.EXTENDED, dpScheme: DPScheme.FULL, startDaysAgo: 2, status: ContractStatus.ACTIVE, dpPaid: true, unitReceived: false, totalDaysPaid: 0 },
    { customerIdx: 4, motor: MotorModel.VICTORY, battery: BatteryType.REGULAR, dpScheme: DPScheme.INSTALLMENT, startDaysAgo: 3, status: ContractStatus.ACTIVE, dpPaid: false, unitReceived: false, totalDaysPaid: 0 },
    { customerIdx: 5, motor: MotorModel.EDPOWER, battery: BatteryType.EXTENDED, dpScheme: DPScheme.FULL, startDaysAgo: 25, status: ContractStatus.OVERDUE, dpPaid: true, unitReceived: true, totalDaysPaid: 14, extensionInvoices: [{ days: 7, paid: true }, { days: 7, paid: true }] },
    { customerIdx: 6, motor: MotorModel.ATHENA, battery: BatteryType.REGULAR, dpScheme: DPScheme.FULL, startDaysAgo: 40, status: ContractStatus.OVERDUE, dpPaid: true, unitReceived: true, totalDaysPaid: 28, extensionInvoices: [{ days: 7, paid: true }, { days: 7, paid: true }, { days: 7, paid: true }, { days: 7, paid: true }] },
    { customerIdx: 7, motor: MotorModel.EDPOWER, battery: BatteryType.REGULAR, dpScheme: DPScheme.FULL, startDaysAgo: 35, status: ContractStatus.REPOSSESSED, dpPaid: true, unitReceived: true, totalDaysPaid: 14, extensionInvoices: [{ days: 7, paid: true }, { days: 7, paid: true }] },
    { customerIdx: 0, motor: MotorModel.VICTORY, battery: BatteryType.REGULAR, dpScheme: DPScheme.FULL, startDaysAgo: 15, status: ContractStatus.ACTIVE, dpPaid: true, unitReceived: true, totalDaysPaid: 7, extensionInvoices: [{ days: 7, paid: true }, { days: 3, paid: false }] },
  ];

  let invoiceIdx = 0;

  for (let i = 0; i < contractScenarios.length; i++) {
    const scenario = contractScenarios[i];
    const customer = customers[scenario.customerIdx];
    const rateKey = `${scenario.motor}_${scenario.battery}`;
    const dailyRate = MOTOR_DAILY_RATES[rateKey] || 0;
    const dpAmount = DP_AMOUNTS[rateKey] || 0;
    const startDate = daysAgo(scenario.startDaysAgo);

    const endDate = new Date(startDate);
    if (scenario.unitReceived && scenario.totalDaysPaid > 0) {
      const advancedDate = advanceWorkingDays(startDate, scenario.totalDaysPaid);
      endDate.setTime(advancedDate.getTime());
    }

    const progress = parseFloat(((scenario.totalDaysPaid / DEFAULT_OWNERSHIP_TARGET_DAYS) * 100).toFixed(2));
    const contractNumber = generateContractNumber(i);
    const contractId = uuidv4();

    await prisma.contract.create({
      data: {
        id: contractId,
        contractNumber,
        customerId: customer.id,
        motorModel: scenario.motor,
        batteryType: scenario.battery,
        dailyRate,
        durationDays: scenario.totalDaysPaid,
        totalAmount: dailyRate * scenario.totalDaysPaid,
        startDate,
        endDate,
        status: scenario.status,
        notes: '',
        createdBy: adminId,
        color: ['Hitam', 'Putih', 'Merah', 'Biru', 'Silver'][i % 5],
        year: 2025,
        vinNumber: `WDS${(2025000 + i).toString()}`,
        engineNumber: `ENG${(100000 + i).toString()}`,
        dpAmount,
        dpScheme: scenario.dpScheme,
        dpPaidAmount: scenario.dpPaid ? dpAmount : (scenario.dpScheme === DPScheme.INSTALLMENT ? Math.ceil(dpAmount / 2) : 0),
        dpFullyPaid: scenario.dpPaid,
        unitReceivedDate: scenario.unitReceived ? daysAgo(scenario.startDaysAgo - 1) : null,
        billingStartDate: scenario.unitReceived ? daysAgo(scenario.startDaysAgo - 2) : null,
        bastPhoto: scenario.unitReceived ? 'https://storage.example.com/bast/sample.jpg' : null,
        bastNotes: scenario.unitReceived ? 'Unit diterima dalam kondisi baik' : '',
        holidayDaysPerMonth: DEFAULT_HOLIDAY_DAYS_PER_MONTH,
        ownershipTargetDays: DEFAULT_OWNERSHIP_TARGET_DAYS,
        totalDaysPaid: scenario.totalDaysPaid,
        ownershipProgress: progress,
        gracePeriodDays: DEFAULT_GRACE_PERIOD_DAYS,
        repossessedAt: scenario.status === ContractStatus.REPOSSESSED ? daysAgo(5) : null,
        createdAt: daysAgo(scenario.startDaysAgo),
      },
    });

    // Create DP invoice(s)
    if (scenario.dpScheme === DPScheme.FULL) {
      const dpInvNumber = generateInvoiceNumber(invoiceIdx++);
      await prisma.invoice.create({
        data: {
          id: uuidv4(),
          invoiceNumber: dpInvNumber,
          contractId,
          customerId: customer.id,
          amount: dpAmount,
          lateFee: 0,
          type: InvoiceType.DP,
          status: scenario.dpPaid ? PaymentStatus.PAID : (scenario.status === ContractStatus.REPOSSESSED ? PaymentStatus.VOID : PaymentStatus.PENDING),
          qrCodeData: `WEDISON-PAY-${dpInvNumber}-${dpAmount}`,
          dueDate: daysAgo(scenario.startDaysAgo - 1),
          paidAt: scenario.dpPaid ? daysAgo(scenario.startDaysAgo - 1) : null,
          createdAt: startDate,
        },
      });
    } else {
      const firstAmount = Math.ceil(dpAmount / 2);
      const secondAmount = Math.floor(dpAmount / 2);

      const dp1Number = generateInvoiceNumber(invoiceIdx++);
      await prisma.invoice.create({
        data: {
          id: uuidv4(),
          invoiceNumber: dp1Number,
          contractId,
          customerId: customer.id,
          amount: firstAmount,
          lateFee: 0,
          type: InvoiceType.DP_INSTALLMENT,
          status: PaymentStatus.PAID,
          qrCodeData: `WEDISON-PAY-${dp1Number}-${firstAmount}`,
          dueDate: daysAgo(scenario.startDaysAgo - 1),
          paidAt: daysAgo(scenario.startDaysAgo - 1),
          createdAt: startDate,
        },
      });

      const dp2Number = generateInvoiceNumber(invoiceIdx++);
      await prisma.invoice.create({
        data: {
          id: uuidv4(),
          invoiceNumber: dp2Number,
          contractId,
          customerId: customer.id,
          amount: secondAmount,
          lateFee: 0,
          type: InvoiceType.DP_INSTALLMENT,
          status: scenario.dpPaid ? PaymentStatus.PAID : PaymentStatus.PENDING,
          qrCodeData: `WEDISON-PAY-${dp2Number}-${secondAmount}`,
          dueDate: daysAgo(scenario.startDaysAgo - 7),
          paidAt: scenario.dpPaid ? daysAgo(scenario.startDaysAgo - 5) : null,
          createdAt: daysAgo(scenario.startDaysAgo - 1),
        },
      });
    }

    // Create extension invoices
    const extensions = (scenario as any).extensionInvoices || [];
    let extensionStart = scenario.startDaysAgo;
    for (let e = 0; e < extensions.length; e++) {
      const ext = extensions[e];
      const isLast = e === extensions.length - 1;
      const extAmount = dailyRate * ext.days;
      const extInvoiceNumber = generateInvoiceNumber(invoiceIdx++);
      const extStatus = isLast && !ext.paid
        ? (scenario.status === ContractStatus.REPOSSESSED ? PaymentStatus.VOID : PaymentStatus.PENDING)
        : ext.paid ? PaymentStatus.PAID : PaymentStatus.PENDING;

      await prisma.invoice.create({
        data: {
          id: uuidv4(),
          invoiceNumber: extInvoiceNumber,
          contractId,
          customerId: customer.id,
          amount: extAmount,
          lateFee: 0,
          type: InvoiceType.MANUAL_PAYMENT,
          status: extStatus,
          qrCodeData: `WEDISON-PAY-${extInvoiceNumber}-${extAmount}`,
          dueDate: daysAgo(extensionStart - 1),
          paidAt: ext.paid ? daysAgo(extensionStart - 1) : null,
          extensionDays: ext.days,
          createdAt: daysAgo(extensionStart),
        },
      });
      extensionStart -= ext.days;
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        id: uuidv4(),
        userId: adminId,
        action: AuditAction.CREATE,
        module: 'contract',
        entityId: contractId,
        description: `Created contract ${contractNumber} for ${CUSTOMER_DATA[scenario.customerIdx].fullName} - ${scenario.motor} ${scenario.battery} (DP: ${scenario.dpScheme})`,
        metadata: { contractNumber, motorModel: scenario.motor, batteryType: scenario.battery, dpScheme: scenario.dpScheme, dpAmount },
        ipAddress: '127.0.0.1',
        createdAt: daysAgo(scenario.startDaysAgo),
      },
    });
  }

  console.log(`Seeded: ${CUSTOMER_DATA.length} customers, ${contractScenarios.length} contracts with DP + RTO model`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
