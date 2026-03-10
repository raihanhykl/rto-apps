import { v4 as uuidv4 } from 'uuid';
import { ICustomerRepository, IContractRepository, IInvoiceRepository, IAuditLogRepository } from '../domain/interfaces';
import { Customer, Contract, Invoice } from '../domain/entities';
import { MotorModel, BatteryType, ContractStatus, PaymentStatus, AuditAction, DPScheme, InvoiceType, Gender, HolidayScheme, MOTOR_DAILY_RATES, DP_AMOUNTS, DEFAULT_OWNERSHIP_TARGET_DAYS, DEFAULT_GRACE_PERIOD_DAYS, DEFAULT_HOLIDAY_SCHEME } from '../domain/enums';
import { getWibToday, getWibDateParts } from '../domain/utils/dateUtils';

const CUSTOMER_DATA = [
  { fullName: 'Budi Santoso', phone: '08123456789', email: 'budi.santoso@gmail.com', address: 'Jl. Sudirman No. 45, Jakarta Selatan', ktpNumber: '3174012305900001', birthDate: '1990-05-23', gender: Gender.MALE, rideHailingApps: ['Grab', 'Gojek'], guarantorName: 'Joko Santoso', guarantorPhone: '08129876543' },
  { fullName: 'Siti Rahmawati', phone: '08567891234', email: 'siti.rahma@yahoo.com', address: 'Jl. Gatot Subroto No. 12, Jakarta Pusat', ktpNumber: '3174024506880002', birthDate: '1988-06-45', gender: Gender.FEMALE, rideHailingApps: ['Gojek', 'Maxim'], guarantorName: 'Ahmad Rahmawati', guarantorPhone: '08561234567' },
  { fullName: 'Ahmad Hidayat', phone: '08198765432', email: 'ahmad.h@gmail.com', address: 'Jl. Kemang Raya No. 78, Jakarta Selatan', ktpNumber: '3174031207950003', birthDate: '1995-07-12', gender: Gender.MALE, rideHailingApps: ['Grab', 'Shopee'], guarantorName: 'Fatimah Hidayat', guarantorPhone: '08191234567' },
  { fullName: 'Dewi Lestari', phone: '08211234567', email: 'dewi.lestari@outlook.com', address: 'Jl. Ampera Raya No. 33, Jakarta Selatan', ktpNumber: '3174044408920004', birthDate: '1992-08-04', gender: Gender.FEMALE, rideHailingApps: ['Grab', 'Gojek', 'Indrive'], guarantorName: 'Bambang Lestari', guarantorPhone: '08219876543' },
  { fullName: 'Rizky Pratama', phone: '08534567890', email: 'rizky.p@gmail.com', address: 'Jl. Casablanca No. 100, Jakarta Selatan', ktpNumber: '3174050903970005', birthDate: '1997-03-09', gender: Gender.MALE, rideHailingApps: ['Maxim', 'Indrive'], guarantorName: 'Sari Pratama', guarantorPhone: '08539876543' },
  { fullName: 'Nur Fadilah', phone: '08157890123', email: 'nur.fadilah@gmail.com', address: 'Jl. Tebet Raya No. 55, Jakarta Selatan', ktpNumber: '3174061511940006', birthDate: '1994-11-15', gender: Gender.FEMALE, rideHailingApps: ['Gojek'], guarantorName: 'Hasan Fadilah', guarantorPhone: '08151234567' },
  { fullName: 'Hendra Wijaya', phone: '08789012345', email: 'hendra.w@yahoo.com', address: 'Jl. Pramuka No. 22, Jakarta Timur', ktpNumber: '3174072008910007', birthDate: '1991-08-20', gender: Gender.MALE, rideHailingApps: ['Grab', 'Gojek', 'Shopee'], guarantorName: 'Linda Wijaya', guarantorPhone: '08781234567' },
  { fullName: 'Rina Marlina', phone: '08345678901', email: 'rina.m@gmail.com', address: 'Jl. Cikini Raya No. 67, Jakarta Pusat', ktpNumber: '3174081703890008', birthDate: '1989-03-17', gender: Gender.FEMALE, rideHailingApps: ['Grab', 'Maxim'], guarantorName: 'Agus Marlina', guarantorPhone: '08341234567' },
];

function daysAgo(days: number): Date {
  const d = getWibToday();
  d.setDate(d.getDate() - days);
  d.setHours(9, 0, 0, 0);
  return d;
}

function generateContractNumber(idx: number): string {
  const { year, month } = getWibDateParts();
  const y = year.toString().slice(-2);
  const m = month.toString().padStart(2, '0');
  return `RTO-${y}${m}${(idx + 1).toString().padStart(2, '0')}-${(1000 + idx).toString()}`;
}

function generateInvoiceNumber(idx: number): string {
  const { year, month } = getWibDateParts();
  const y = year.toString().slice(-2);
  const m = month.toString().padStart(2, '0');
  return `PMT-${y}${m}${(idx + 1).toString().padStart(2, '0')}-${(2000 + idx).toString()}`;
}

/**
 * Check if a date is a Libur Bayar based on holiday scheme.
 * OLD_CONTRACT: all Sundays are holidays.
 * NEW_CONTRACT: dates 29-31 are holidays.
 */
function isLiburBayar(date: Date, scheme: HolidayScheme): boolean {
  if (scheme === HolidayScheme.OLD_CONTRACT) {
    return date.getDay() === 0;
  } else {
    return date.getDate() > 28;
  }
}

// Walk calendar from billingStart, count N working days + all holidays in between
function countCalendarDays(billingStart: Date, workingDays: number, scheme: HolidayScheme = DEFAULT_HOLIDAY_SCHEME) {
  const cursor = new Date(billingStart);
  let workingCount = 0;
  let holidayCount = 0;
  while (workingCount < workingDays) {
    if (isLiburBayar(cursor, scheme)) {
      holidayCount++;
    } else {
      workingCount++;
    }
    if (workingCount < workingDays) {
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return { totalDaysPaid: workingCount + holidayCount, workingCount, holidayCount, lastDate: cursor };
}

let invoiceIdx = 0;

export async function seedDummyData(
  customerRepo: ICustomerRepository,
  contractRepo: IContractRepository,
  invoiceRepo: IInvoiceRepository,
  auditRepo: IAuditLogRepository,
  adminId: string,
) {
  // Check if already seeded
  const existingCount = await customerRepo.count();
  if (existingCount > 0) return;

  console.log('🌱 Seeding dummy data...');

  // Create customers
  const customers: Customer[] = [];
  for (const data of CUSTOMER_DATA) {
    const customer: Customer = {
      id: uuidv4(),
      fullName: data.fullName,
      phone: data.phone,
      email: data.email,
      address: data.address,
      birthDate: data.birthDate,
      gender: data.gender,
      rideHailingApps: data.rideHailingApps,
      ktpNumber: data.ktpNumber,
      ktpPhoto: null,
      simPhoto: null,
      kkPhoto: null,
      guarantorName: data.guarantorName,
      guarantorPhone: data.guarantorPhone,
      guarantorKtpPhoto: null,
      spouseName: '',
      spouseKtpPhoto: null,
      notes: '',
      isDeleted: false,
      deletedAt: null,
      createdAt: daysAgo(Math.floor(Math.random() * 30) + 5),
      updatedAt: new Date(),
    };
    await customerRepo.create(customer);
    customers.push(customer);
  }

  // Contract scenarios with DP + RTO model
  const contractScenarios: Array<{
    customerIdx: number;
    motor: MotorModel;
    battery: BatteryType;
    dpScheme: DPScheme;
    startDaysAgo: number;
    status: ContractStatus;
    dpPaid: boolean; // is DP fully paid?
    unitReceived: boolean; // has unit been delivered?
    totalDaysPaid: number; // cumulative billing days paid
    extensionInvoices?: Array<{ days: number; paid: boolean }>;
  }> = [
    // Active: DP paid, unit received, some billing extensions paid
    { customerIdx: 0, motor: MotorModel.ATHENA, battery: BatteryType.REGULAR, dpScheme: DPScheme.FULL, startDaysAgo: 20, status: ContractStatus.ACTIVE, dpPaid: true, unitReceived: true, totalDaysPaid: 14,
      extensionInvoices: [{ days: 7, paid: true }, { days: 7, paid: true }] },
    // Active: DP installment, unit received, 1 extension
    { customerIdx: 1, motor: MotorModel.VICTORY, battery: BatteryType.EXTENDED, dpScheme: DPScheme.INSTALLMENT, startDaysAgo: 10, status: ContractStatus.ACTIVE, dpPaid: true, unitReceived: true, totalDaysPaid: 7,
      extensionInvoices: [{ days: 7, paid: true }] },
    // Active: DP paid, unit received, extension pending payment
    { customerIdx: 2, motor: MotorModel.EDPOWER, battery: BatteryType.REGULAR, dpScheme: DPScheme.FULL, startDaysAgo: 30, status: ContractStatus.ACTIVE, dpPaid: true, unitReceived: true, totalDaysPaid: 21,
      extensionInvoices: [{ days: 7, paid: true }, { days: 7, paid: true }, { days: 7, paid: true }, { days: 7, paid: false }] },
    // Active: DP paid, unit NOT yet received (waiting delivery)
    { customerIdx: 3, motor: MotorModel.ATHENA, battery: BatteryType.EXTENDED, dpScheme: DPScheme.FULL, startDaysAgo: 2, status: ContractStatus.ACTIVE, dpPaid: true, unitReceived: false, totalDaysPaid: 0 },
    // Active: DP installment, only 1st paid, unit NOT received
    { customerIdx: 4, motor: MotorModel.VICTORY, battery: BatteryType.REGULAR, dpScheme: DPScheme.INSTALLMENT, startDaysAgo: 3, status: ContractStatus.ACTIVE, dpPaid: false, unitReceived: false, totalDaysPaid: 0 },
    // Overdue: DP paid, unit received, past grace period
    { customerIdx: 5, motor: MotorModel.EDPOWER, battery: BatteryType.EXTENDED, dpScheme: DPScheme.FULL, startDaysAgo: 25, status: ContractStatus.OVERDUE, dpPaid: true, unitReceived: true, totalDaysPaid: 14,
      extensionInvoices: [{ days: 7, paid: true }, { days: 7, paid: true }] },
    // Overdue: long-running, many extensions
    { customerIdx: 6, motor: MotorModel.ATHENA, battery: BatteryType.REGULAR, dpScheme: DPScheme.FULL, startDaysAgo: 40, status: ContractStatus.OVERDUE, dpPaid: true, unitReceived: true, totalDaysPaid: 28,
      extensionInvoices: [{ days: 7, paid: true }, { days: 7, paid: true }, { days: 7, paid: true }, { days: 7, paid: true }] },
    // Repossessed
    { customerIdx: 7, motor: MotorModel.EDPOWER, battery: BatteryType.REGULAR, dpScheme: DPScheme.FULL, startDaysAgo: 35, status: ContractStatus.REPOSSESSED, dpPaid: true, unitReceived: true, totalDaysPaid: 14,
      extensionInvoices: [{ days: 7, paid: true }, { days: 7, paid: true }] },
    // Active: failed payment on latest extension
    { customerIdx: 0, motor: MotorModel.VICTORY, battery: BatteryType.REGULAR, dpScheme: DPScheme.FULL, startDaysAgo: 15, status: ContractStatus.ACTIVE, dpPaid: true, unitReceived: true, totalDaysPaid: 7,
      extensionInvoices: [{ days: 7, paid: true }, { days: 3, paid: false }] },
  ];

  for (let i = 0; i < contractScenarios.length; i++) {
    const scenario = contractScenarios[i];
    const customer = customers[scenario.customerIdx];
    const rateKey = `${scenario.motor}_${scenario.battery}`;
    const dailyRate = MOTOR_DAILY_RATES[rateKey] || 0;
    const dpAmount = DP_AMOUNTS[rateKey] || 0;
    const startDate = daysAgo(scenario.startDaysAgo);

    // Calculate endDate, totalDaysPaid (working + holidays), and workingCount
    const billingStart = scenario.unitReceived ? daysAgo(scenario.startDaysAgo - 2) : null;
    let endDate = new Date(startDate);
    let actualTotalDaysPaid = 0;
    let workingCount = 0;
    if (billingStart && scenario.totalDaysPaid > 0) {
      const calc = countCalendarDays(billingStart, scenario.totalDaysPaid);
      actualTotalDaysPaid = calc.totalDaysPaid;
      workingCount = calc.workingCount;
      endDate = calc.lastDate;
    }

    const progress = parseFloat(((actualTotalDaysPaid / DEFAULT_OWNERSHIP_TARGET_DAYS) * 100).toFixed(2));

    const contractNumber = generateContractNumber(i);
    const contract: Contract = {
      id: uuidv4(),
      contractNumber,
      customerId: customer.id,
      motorModel: scenario.motor,
      batteryType: scenario.battery,
      dailyRate,
      durationDays: actualTotalDaysPaid,
      totalAmount: dailyRate * workingCount,
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
      billingStartDate: billingStart,
      bastPhoto: scenario.unitReceived ? 'https://storage.example.com/bast/sample.jpg' : null,
      bastNotes: scenario.unitReceived ? 'Unit diterima dalam kondisi baik' : '',
      holidayScheme: DEFAULT_HOLIDAY_SCHEME,
      ownershipTargetDays: DEFAULT_OWNERSHIP_TARGET_DAYS,
      totalDaysPaid: actualTotalDaysPaid,
      workingDaysPaid: workingCount,
      holidayDaysPaid: actualTotalDaysPaid - workingCount,
      ownershipProgress: progress,
      gracePeriodDays: DEFAULT_GRACE_PERIOD_DAYS,
      repossessedAt: scenario.status === ContractStatus.REPOSSESSED ? daysAgo(5) : null,
      completedAt: null,
      isDeleted: false,
      deletedAt: null,
      createdAt: daysAgo(scenario.startDaysAgo),
      updatedAt: new Date(),
    };
    await contractRepo.create(contract);

    // Create DP invoice(s)
    if (scenario.dpScheme === DPScheme.FULL) {
      const dpInvNumber = generateInvoiceNumber(invoiceIdx++);
      const dpInvoice: Invoice = {
        id: uuidv4(),
        invoiceNumber: dpInvNumber,
        contractId: contract.id,
        customerId: customer.id,
        amount: dpAmount,
        lateFee: 0,
        type: InvoiceType.DP,
        status: scenario.dpPaid ? PaymentStatus.PAID : (scenario.status === ContractStatus.REPOSSESSED ? PaymentStatus.VOID : PaymentStatus.PENDING),
        qrCodeData: `WEDISON-PAY-${dpInvNumber}-${dpAmount}`,
        dueDate: daysAgo(scenario.startDaysAgo - 1),
        paidAt: scenario.dpPaid ? daysAgo(scenario.startDaysAgo - 1) : null,
        extensionDays: null,
        dokuPaymentUrl: null,
        dokuReferenceId: null,
        dailyRate: null,
        daysCount: null,
        periodStart: null,
        periodEnd: null,
        expiredAt: null,
        previousPaymentId: null,
        isHoliday: false,
        createdAt: startDate,
        updatedAt: new Date(),
      };
      await invoiceRepo.create(dpInvoice);
    } else {
      // INSTALLMENT: 2 DP invoices
      const firstAmount = Math.ceil(dpAmount / 2);
      const secondAmount = Math.floor(dpAmount / 2);

      const dp1Number = generateInvoiceNumber(invoiceIdx++);
      const dpInv1: Invoice = {
        id: uuidv4(),
        invoiceNumber: dp1Number,
        contractId: contract.id,
        customerId: customer.id,
        amount: firstAmount,
        lateFee: 0,
        type: InvoiceType.DP_INSTALLMENT,
        status: PaymentStatus.PAID, // 1st installment always paid for seeded data
        qrCodeData: `WEDISON-PAY-${dp1Number}-${firstAmount}`,
        dueDate: daysAgo(scenario.startDaysAgo - 1),
        paidAt: daysAgo(scenario.startDaysAgo - 1),
        extensionDays: null,
        dokuPaymentUrl: null,
        dokuReferenceId: null,
        dailyRate: null,
        daysCount: null,
        periodStart: null,
        periodEnd: null,
        expiredAt: null,
        previousPaymentId: null,
        isHoliday: false,
        createdAt: startDate,
        updatedAt: new Date(),
      };
      await invoiceRepo.create(dpInv1);

      const dp2Number = generateInvoiceNumber(invoiceIdx++);
      const dpInv2: Invoice = {
        id: uuidv4(),
        invoiceNumber: dp2Number,
        contractId: contract.id,
        customerId: customer.id,
        amount: secondAmount,
        lateFee: 0,
        type: InvoiceType.DP_INSTALLMENT,
        status: scenario.dpPaid ? PaymentStatus.PAID : PaymentStatus.PENDING,
        qrCodeData: `WEDISON-PAY-${dp2Number}-${secondAmount}`,
        dueDate: daysAgo(scenario.startDaysAgo - 7),
        paidAt: scenario.dpPaid ? daysAgo(scenario.startDaysAgo - 5) : null,
        extensionDays: null,
        dokuPaymentUrl: null,
        dokuReferenceId: null,
        dailyRate: null,
        daysCount: null,
        periodStart: null,
        periodEnd: null,
        expiredAt: null,
        previousPaymentId: null,
        isHoliday: false,
        createdAt: daysAgo(scenario.startDaysAgo - 1),
        updatedAt: new Date(),
      };
      await invoiceRepo.create(dpInv2);
    }

    // Create extension invoices (billing payments)
    const extensions = scenario.extensionInvoices || [];
    let extensionStart = scenario.startDaysAgo;
    for (let e = 0; e < extensions.length; e++) {
      const ext = extensions[e];
      const isLast = e === extensions.length - 1;
      const extAmount = dailyRate * ext.days;
      const extInvoiceNumber = generateInvoiceNumber(invoiceIdx++);
      const extStatus = isLast && !ext.paid
        ? (scenario.status === ContractStatus.REPOSSESSED ? PaymentStatus.VOID : PaymentStatus.PENDING)
        : ext.paid ? PaymentStatus.PAID : PaymentStatus.PENDING;

      const extInvoice: Invoice = {
        id: uuidv4(),
        invoiceNumber: extInvoiceNumber,
        contractId: contract.id,
        customerId: customer.id,
        amount: extAmount,
        lateFee: 0,
        type: InvoiceType.MANUAL_PAYMENT,
        status: extStatus,
        qrCodeData: `WEDISON-PAY-${extInvoiceNumber}-${extAmount}`,
        dueDate: daysAgo(extensionStart - 1),
        paidAt: ext.paid ? daysAgo(extensionStart - 1) : null,
        extensionDays: ext.days,
        dokuPaymentUrl: null,
        dokuReferenceId: null,
        dailyRate: null,
        daysCount: null,
        periodStart: null,
        periodEnd: null,
        expiredAt: null,
        previousPaymentId: null,
        isHoliday: false,
        createdAt: daysAgo(extensionStart),
        updatedAt: new Date(),
      };
      await invoiceRepo.create(extInvoice);
      extensionStart -= ext.days;
    }

    // Audit log for creation
    await auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.CREATE,
      module: 'contract',
      entityId: contract.id,
      description: `Created contract ${contractNumber} for ${customer.fullName} - ${scenario.motor} ${scenario.battery} (DP: ${scenario.dpScheme})`,
      metadata: { contractNumber, motorModel: scenario.motor, batteryType: scenario.battery, dpScheme: scenario.dpScheme, dpAmount },
      ipAddress: '127.0.0.1',
      createdAt: contract.createdAt,
    });
  }

  console.log(`✅ Seeded: ${customers.length} customers, ${contractScenarios.length} contracts with DP + RTO model`);
}
