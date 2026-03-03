import { v4 as uuidv4 } from 'uuid';
import { ICustomerRepository, IContractRepository, IInvoiceRepository, IAuditLogRepository } from '../domain/interfaces';
import { Customer, Contract, Invoice } from '../domain/entities';
import { MotorModel, ContractStatus, PaymentStatus, AuditAction, MOTOR_DAILY_RATES, DEFAULT_OWNERSHIP_TARGET_DAYS, DEFAULT_GRACE_PERIOD_DAYS } from '../domain/enums';

const CUSTOMER_DATA = [
  { fullName: 'Budi Santoso', phone: '08123456789', email: 'budi.santoso@gmail.com', address: 'Jl. Sudirman No. 45, Jakarta Selatan', ktpNumber: '3174012305900001' },
  { fullName: 'Siti Rahmawati', phone: '08567891234', email: 'siti.rahma@yahoo.com', address: 'Jl. Gatot Subroto No. 12, Jakarta Pusat', ktpNumber: '3174024506880002' },
  { fullName: 'Ahmad Hidayat', phone: '08198765432', email: 'ahmad.h@gmail.com', address: 'Jl. Kemang Raya No. 78, Jakarta Selatan', ktpNumber: '3174031207950003' },
  { fullName: 'Dewi Lestari', phone: '08211234567', email: 'dewi.lestari@outlook.com', address: 'Jl. Ampera Raya No. 33, Jakarta Selatan', ktpNumber: '3174044408920004' },
  { fullName: 'Rizky Pratama', phone: '08534567890', email: 'rizky.p@gmail.com', address: 'Jl. Casablanca No. 100, Jakarta Selatan', ktpNumber: '3174050903970005' },
  { fullName: 'Nur Fadilah', phone: '08157890123', email: 'nur.fadilah@gmail.com', address: 'Jl. Tebet Raya No. 55, Jakarta Selatan', ktpNumber: '3174061511940006' },
  { fullName: 'Hendra Wijaya', phone: '08789012345', email: 'hendra.w@yahoo.com', address: 'Jl. Pramuka No. 22, Jakarta Timur', ktpNumber: '3174072008910007' },
  { fullName: 'Rina Marlina', phone: '08345678901', email: 'rina.m@gmail.com', address: 'Jl. Cikini Raya No. 67, Jakarta Pusat', ktpNumber: '3174081703890008' },
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
  return `INV-${y}${m}${(idx + 1).toString().padStart(2, '0')}-${(2000 + idx).toString()}`;
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
      ktpNumber: data.ktpNumber,
      notes: '',
      isDeleted: false,
      deletedAt: null,
      createdAt: daysAgo(Math.floor(Math.random() * 30) + 5),
      updatedAt: new Date(),
    };
    await customerRepo.create(customer);
    customers.push(customer);
  }

  // Contract scenarios with RTO model
  // totalDaysPaid reflects only PAID invoices (not pending ones)
  // initialDays = first period days
  const contractScenarios: Array<{
    customerIdx: number;
    motor: MotorModel;
    initialDays: number; // first period days
    startDaysAgo: number;
    status: ContractStatus;
    currentInvoiceStatus: PaymentStatus; // status of the latest invoice
    totalDaysPaid: number; // cumulative PAID days only
    extensionInvoices?: Array<{ days: number; paid: boolean }>; // additional invoices after initial
  }> = [
    // Active contracts - initial invoice PAID, no extensions yet
    { customerIdx: 0, motor: MotorModel.ATHENA, initialDays: 5, startDaysAgo: 2, status: ContractStatus.ACTIVE, currentInvoiceStatus: PaymentStatus.PAID, totalDaysPaid: 5 },
    { customerIdx: 1, motor: MotorModel.VICTORY, initialDays: 3, startDaysAgo: 1, status: ContractStatus.ACTIVE, currentInvoiceStatus: PaymentStatus.PAID, totalDaysPaid: 3 },
    { customerIdx: 2, motor: MotorModel.EDPOWER, initialDays: 7, startDaysAgo: 3, status: ContractStatus.ACTIVE, currentInvoiceStatus: PaymentStatus.PAID, totalDaysPaid: 7 },
    // Active contract with multiple paid extensions
    {
      customerIdx: 3, motor: MotorModel.ATHENA, initialDays: 7, startDaysAgo: 35, status: ContractStatus.ACTIVE,
      currentInvoiceStatus: PaymentStatus.PENDING, totalDaysPaid: 28,
      extensionInvoices: [
        { days: 7, paid: true }, { days: 7, paid: true }, { days: 7, paid: true },
        { days: 7, paid: false }, // current pending extension
      ],
    },
    // Active contract nearing end, all paid
    {
      customerIdx: 4, motor: MotorModel.VICTORY, initialDays: 5, startDaysAgo: 20, status: ContractStatus.ACTIVE,
      currentInvoiceStatus: PaymentStatus.PAID, totalDaysPaid: 19,
      extensionInvoices: [{ days: 7, paid: true }, { days: 7, paid: true }],
    },
    // Overdue contract (past endDate + grace period)
    {
      customerIdx: 5, motor: MotorModel.EDPOWER, initialDays: 7, startDaysAgo: 21, status: ContractStatus.OVERDUE,
      currentInvoiceStatus: PaymentStatus.PAID, totalDaysPaid: 14,
      extensionInvoices: [{ days: 7, paid: true }],
    },
    // Overdue contract past grace period
    {
      customerIdx: 6, motor: MotorModel.ATHENA, initialDays: 7, startDaysAgo: 35, status: ContractStatus.OVERDUE,
      currentInvoiceStatus: PaymentStatus.PAID, totalDaysPaid: 28,
      extensionInvoices: [{ days: 7, paid: true }, { days: 7, paid: true }, { days: 7, paid: true }],
    },
    // Repossessed contract
    {
      customerIdx: 7, motor: MotorModel.EDPOWER, initialDays: 3, startDaysAgo: 30, status: ContractStatus.REPOSSESSED,
      currentInvoiceStatus: PaymentStatus.VOID, totalDaysPaid: 10,
      extensionInvoices: [{ days: 7, paid: true }],
    },
    // Contract with failed payment on latest invoice
    {
      customerIdx: 0, motor: MotorModel.VICTORY, initialDays: 3, startDaysAgo: 10, status: ContractStatus.ACTIVE,
      currentInvoiceStatus: PaymentStatus.FAILED, totalDaysPaid: 10,
      extensionInvoices: [{ days: 7, paid: true }, { days: 3, paid: false }],
    },
  ];

  for (let i = 0; i < contractScenarios.length; i++) {
    const scenario = contractScenarios[i];
    const customer = customers[scenario.customerIdx];
    const dailyRate = MOTOR_DAILY_RATES[scenario.motor];
    const initialAmount = dailyRate * scenario.initialDays;
    const totalPaidAmount = dailyRate * scenario.totalDaysPaid;
    const startDate = daysAgo(scenario.startDaysAgo);

    // Calculate current endDate based on totalDaysPaid
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + scenario.totalDaysPaid);

    // Cumulative durationDays = all paid days + any pending extension
    let cumulativeDays = scenario.totalDaysPaid;
    const extensions = scenario.extensionInvoices || [];

    const progress = parseFloat(((scenario.totalDaysPaid / DEFAULT_OWNERSHIP_TARGET_DAYS) * 100).toFixed(2));

    const contractNumber = generateContractNumber(i);
    const contract: Contract = {
      id: uuidv4(),
      contractNumber,
      customerId: customer.id,
      motorModel: scenario.motor,
      dailyRate,
      durationDays: cumulativeDays,
      totalAmount: totalPaidAmount,
      startDate,
      endDate,
      status: scenario.status,
      notes: '',
      createdBy: adminId,
      ownershipTargetDays: DEFAULT_OWNERSHIP_TARGET_DAYS,
      totalDaysPaid: scenario.totalDaysPaid,
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

    // Create initial invoice (always first, with extensionDays = initialDays)
    const initialInvoiceNumber = generateInvoiceNumber(invoiceIdx++);
    const initialDueDate = new Date(startDate);
    initialDueDate.setDate(initialDueDate.getDate() + 1);
    const initialPaid = extensions.length === 0
      ? scenario.currentInvoiceStatus === PaymentStatus.PAID
      : true; // If there are extensions, initial must have been paid

    const initialInvoice: Invoice = {
      id: uuidv4(),
      invoiceNumber: initialInvoiceNumber,
      contractId: contract.id,
      customerId: customer.id,
      amount: initialAmount,
      lateFee: 0,
      status: initialPaid ? PaymentStatus.PAID : scenario.currentInvoiceStatus,
      qrCodeData: `WEDISON-PAY-${initialInvoiceNumber}-${initialAmount}`,
      dueDate: initialDueDate,
      paidAt: initialPaid ? daysAgo(scenario.startDaysAgo - 1) : null,
      extensionDays: scenario.initialDays,
      createdAt: startDate,
      updatedAt: new Date(),
    };
    await invoiceRepo.create(initialInvoice);

    // Create extension invoices
    let extensionStart = scenario.startDaysAgo - scenario.initialDays;
    for (let e = 0; e < extensions.length; e++) {
      const ext = extensions[e];
      const isLast = e === extensions.length - 1;
      const extAmount = dailyRate * ext.days;
      const extInvoiceNumber = generateInvoiceNumber(invoiceIdx++);
      const extStatus = isLast && !ext.paid
        ? scenario.currentInvoiceStatus
        : ext.paid ? PaymentStatus.PAID : PaymentStatus.PENDING;

      const extInvoice: Invoice = {
        id: uuidv4(),
        invoiceNumber: extInvoiceNumber,
        contractId: contract.id,
        customerId: customer.id,
        amount: extAmount,
        lateFee: 0,
        status: extStatus,
        qrCodeData: `WEDISON-PAY-${extInvoiceNumber}-${extAmount}`,
        dueDate: daysAgo(extensionStart - 1),
        paidAt: ext.paid ? daysAgo(extensionStart - 1) : null,
        extensionDays: ext.days,
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
      description: `Created contract ${contractNumber} for ${customer.fullName} - ${scenario.motor} (${scenario.initialDays} days)`,
      metadata: { contractNumber, motorModel: scenario.motor, totalAmount: initialAmount },
      ipAddress: '127.0.0.1',
      createdAt: contract.createdAt,
    });

    // Audit log for initial payment if paid
    if (initialPaid) {
      await auditRepo.create({
        id: uuidv4(),
        userId: adminId,
        action: AuditAction.PAYMENT,
        module: 'invoice',
        entityId: initialInvoice.id,
        description: `Payment paid for invoice ${initialInvoiceNumber} - Rp ${initialAmount.toLocaleString('id-ID')}`,
        metadata: { invoiceNumber: initialInvoiceNumber, amount: initialAmount, paymentStatus: 'PAID' },
        ipAddress: '127.0.0.1',
        createdAt: daysAgo(scenario.startDaysAgo - 1),
      });
    }
  }

  console.log(`✅ Seeded: ${customers.length} customers, ${contractScenarios.length} contracts with RTO model`);
}
