import { v4 as uuidv4 } from 'uuid';
import { ICustomerRepository, IContractRepository, IInvoiceRepository, IAuditLogRepository } from '../domain/interfaces';
import { Customer, Contract, Invoice } from '../domain/entities';
import { MotorModel, ContractStatus, PaymentStatus, AuditAction, MOTOR_DAILY_RATES } from '../domain/enums';

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
      createdAt: daysAgo(Math.floor(Math.random() * 30) + 5),
      updatedAt: new Date(),
    };
    await customerRepo.create(customer);
    customers.push(customer);
  }

  // Contract scenarios
  const contractScenarios: Array<{
    customerIdx: number;
    motor: MotorModel;
    days: number;
    startDaysAgo: number;
    status: ContractStatus;
    paymentStatus: PaymentStatus;
  }> = [
    // Active contracts
    { customerIdx: 0, motor: MotorModel.ATHENA, days: 5, startDaysAgo: 2, status: ContractStatus.ACTIVE, paymentStatus: PaymentStatus.PENDING },
    { customerIdx: 1, motor: MotorModel.VICTORY, days: 3, startDaysAgo: 1, status: ContractStatus.ACTIVE, paymentStatus: PaymentStatus.PENDING },
    { customerIdx: 2, motor: MotorModel.EDPOWER, days: 7, startDaysAgo: 3, status: ContractStatus.ACTIVE, paymentStatus: PaymentStatus.PENDING },
    // Completed contracts (paid)
    { customerIdx: 3, motor: MotorModel.ATHENA, days: 3, startDaysAgo: 10, status: ContractStatus.COMPLETED, paymentStatus: PaymentStatus.PAID },
    { customerIdx: 4, motor: MotorModel.VICTORY, days: 5, startDaysAgo: 15, status: ContractStatus.COMPLETED, paymentStatus: PaymentStatus.PAID },
    { customerIdx: 5, motor: MotorModel.EDPOWER, days: 2, startDaysAgo: 8, status: ContractStatus.COMPLETED, paymentStatus: PaymentStatus.PAID },
    { customerIdx: 0, motor: MotorModel.VICTORY, days: 4, startDaysAgo: 20, status: ContractStatus.COMPLETED, paymentStatus: PaymentStatus.PAID },
    // Overdue contract
    { customerIdx: 6, motor: MotorModel.ATHENA, days: 7, startDaysAgo: 12, status: ContractStatus.OVERDUE, paymentStatus: PaymentStatus.PENDING },
    // Failed payment
    { customerIdx: 7, motor: MotorModel.EDPOWER, days: 3, startDaysAgo: 6, status: ContractStatus.ACTIVE, paymentStatus: PaymentStatus.FAILED },
  ];

  for (let i = 0; i < contractScenarios.length; i++) {
    const scenario = contractScenarios[i];
    const customer = customers[scenario.customerIdx];
    const dailyRate = MOTOR_DAILY_RATES[scenario.motor];
    const totalAmount = dailyRate * scenario.days;
    const startDate = daysAgo(scenario.startDaysAgo);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + scenario.days);

    const contractNumber = generateContractNumber(i);
    const contract: Contract = {
      id: uuidv4(),
      contractNumber,
      customerId: customer.id,
      motorModel: scenario.motor,
      dailyRate,
      durationDays: scenario.days,
      totalAmount,
      startDate,
      endDate,
      status: scenario.status,
      notes: '',
      createdBy: adminId,
      createdAt: startDate,
      updatedAt: new Date(),
    };
    await contractRepo.create(contract);

    const invoiceNumber = generateInvoiceNumber(i);
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + 1);

    const invoice: Invoice = {
      id: uuidv4(),
      invoiceNumber,
      contractId: contract.id,
      customerId: customer.id,
      amount: totalAmount,
      status: scenario.paymentStatus,
      qrCodeData: `WEDISON-PAY-${invoiceNumber}-${totalAmount}`,
      dueDate,
      paidAt: scenario.paymentStatus === PaymentStatus.PAID ? daysAgo(scenario.startDaysAgo - 1) : null,
      createdAt: startDate,
      updatedAt: new Date(),
    };
    await invoiceRepo.create(invoice);

    // Audit log for creation
    await auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.CREATE,
      module: 'contract',
      entityId: contract.id,
      description: `Created contract ${contractNumber} for ${customer.fullName} - ${scenario.motor} (${scenario.days} days)`,
      metadata: { contractNumber, motorModel: scenario.motor, totalAmount },
      ipAddress: '127.0.0.1',
      createdAt: startDate,
    });

    // Audit log for payment if paid
    if (scenario.paymentStatus === PaymentStatus.PAID) {
      await auditRepo.create({
        id: uuidv4(),
        userId: adminId,
        action: AuditAction.PAYMENT,
        module: 'invoice',
        entityId: invoice.id,
        description: `Payment paid for invoice ${invoiceNumber} - Rp ${totalAmount.toLocaleString('id-ID')}`,
        metadata: { invoiceNumber, amount: totalAmount, paymentStatus: 'PAID' },
        ipAddress: '127.0.0.1',
        createdAt: daysAgo(scenario.startDaysAgo - 1),
      });
    }
  }

  console.log(`✅ Seeded: ${customers.length} customers, ${contractScenarios.length} contracts & invoices`);
}
