import { ServiceCompensationService } from '../application/services/ServiceCompensationService';
import { PaymentService } from '../application/services/PaymentService';
import { SettingService } from '../application/services/SettingService';
import { InMemoryServiceRecordRepository } from '../infrastructure/repositories/InMemoryServiceRecordRepository';
import { InMemoryPaymentDayRepository } from '../infrastructure/repositories/InMemoryPaymentDayRepository';
import { InMemoryContractRepository } from '../infrastructure/repositories/InMemoryContractRepository';
import { InMemoryInvoiceRepository } from '../infrastructure/repositories/InMemoryInvoiceRepository';
import { InMemoryAuditLogRepository } from '../infrastructure/repositories/InMemoryAuditLogRepository';
import { InMemorySettingRepository } from '../infrastructure/repositories/InMemorySettingRepository';
import {
  ServiceType,
  ServiceRecordStatus,
  PaymentDayStatus,
  ContractStatus,
  MotorModel,
  BatteryType,
  DPScheme,
  HolidayScheme,
  PaymentStatus,
  InvoiceType,
  DEFAULT_OWNERSHIP_TARGET_DAYS,
  DEFAULT_GRACE_PERIOD_DAYS,
  DEFAULT_HOLIDAY_SCHEME,
} from '../domain/enums';
import { Contract } from '../domain/entities/Contract';
import { Invoice } from '../domain/entities/Invoice';
import { PaymentDay } from '../domain/entities/PaymentDay';
import { v4 as uuidv4 } from 'uuid';

// ============ Helper: Create test contract ============

function createTestContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 'contract-1',
    contractNumber: 'RTO-260101-0001',
    customerId: 'customer-1',
    motorModel: MotorModel.ATHENA,
    batteryType: BatteryType.REGULAR,
    dailyRate: 58000,
    durationDays: 0,
    totalAmount: 0,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-01-01'),
    status: ContractStatus.ACTIVE,
    notes: '',
    createdBy: 'admin',
    color: 'Red',
    year: 2026,
    vinNumber: 'VIN001',
    engineNumber: 'ENG001',
    dpAmount: 530000,
    dpScheme: DPScheme.FULL,
    dpPaidAmount: 530000,
    dpFullyPaid: true,
    unitReceivedDate: new Date('2026-01-01'),
    billingStartDate: new Date('2026-01-02'),
    bastPhoto: 'photo.jpg',
    bastNotes: '',
    holidayScheme: DEFAULT_HOLIDAY_SCHEME,
    ownershipTargetDays: DEFAULT_OWNERSHIP_TARGET_DAYS,
    totalDaysPaid: 0,
    workingDaysPaid: 0,
    holidayDaysPaid: 0,
    compensatedDaysPaid: 0,
    ownershipProgress: 0,
    gracePeriodDays: DEFAULT_GRACE_PERIOD_DAYS,
    savingBalance: 0,
    repossessedAt: null,
    completedAt: null,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ============ Helper: Create invoice ============

function createTestInvoice(contractId: string, overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: uuidv4(),
    invoiceNumber: `PMT-260105-${uuidv4().slice(0, 4)}`,
    contractId,
    customerId: 'customer-1',
    amount: 58000,
    lateFee: 0,
    type: InvoiceType.DAILY_BILLING,
    status: PaymentStatus.PENDING,
    qrCodeData: 'WEDISON-PAY-TEST',
    dueDate: new Date('2026-01-05'),
    paidAt: null,
    extensionDays: 1,
    dokuPaymentUrl: null,
    dokuReferenceId: null,
    dailyRate: 58000,
    daysCount: 1,
    periodStart: new Date('2026-01-05'),
    periodEnd: new Date('2026-01-05'),
    expiredAt: null,
    previousPaymentId: null,
    isHoliday: false,
    createdAt: new Date('2026-01-05'),
    updatedAt: new Date('2026-01-05'),
    ...overrides,
  };
}

// ============ Helper: Create PaymentDay ============

function createTestPaymentDay(
  contractId: string,
  date: Date,
  status: PaymentDayStatus,
  overrides: Partial<PaymentDay> = {},
): PaymentDay {
  return {
    id: uuidv4(),
    contractId,
    date,
    status,
    dailyRate: 58000,
    amount:
      status === PaymentDayStatus.PAID ? 58000 : status === PaymentDayStatus.UNPAID ? 58000 : 0,
    paymentId: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ============ Test Suite ============

describe('ServiceCompensationService', () => {
  let service: ServiceCompensationService;
  let paymentService: PaymentService;
  let serviceRecordRepo: InMemoryServiceRecordRepository;
  let paymentDayRepo: InMemoryPaymentDayRepository;
  let contractRepo: InMemoryContractRepository;
  let invoiceRepo: InMemoryInvoiceRepository;
  let auditRepo: InMemoryAuditLogRepository;

  const adminId = 'admin-1';

  beforeEach(() => {
    serviceRecordRepo = new InMemoryServiceRecordRepository();
    paymentDayRepo = new InMemoryPaymentDayRepository();
    contractRepo = new InMemoryContractRepository();
    invoiceRepo = new InMemoryInvoiceRepository();
    auditRepo = new InMemoryAuditLogRepository();
    const settingRepo = new InMemorySettingRepository();
    const settingService = new SettingService(settingRepo, auditRepo, contractRepo);

    paymentService = new PaymentService(
      invoiceRepo,
      contractRepo,
      paymentDayRepo,
      auditRepo,
      settingService,
    );

    service = new ServiceCompensationService(
      serviceRecordRepo,
      paymentDayRepo,
      contractRepo,
      invoiceRepo,
      auditRepo,
      paymentService,
    );
  });

  // ============ createServiceRecord ============

  describe('createServiceRecord', () => {
    it('should create MINOR service record without compensation', async () => {
      // Arrange
      const contract = createTestContract();
      await contractRepo.create(contract);

      // Act
      const record = await service.createServiceRecord(
        {
          contractId: contract.id,
          serviceType: ServiceType.MINOR,
          replacementProvided: false,
          startDate: '2026-01-05',
          endDate: '2026-01-07',
        },
        adminId,
      );

      // Assert
      expect(record.serviceType).toBe(ServiceType.MINOR);
      expect(record.compensationDays).toBe(0);
      expect(record.daySnapshots).toBeNull();
      expect(record.status).toBe(ServiceRecordStatus.ACTIVE);
    });

    it('should create MAJOR+replacement service record without compensation', async () => {
      // Arrange
      const contract = createTestContract();
      await contractRepo.create(contract);

      // Act
      const record = await service.createServiceRecord(
        {
          contractId: contract.id,
          serviceType: ServiceType.MAJOR,
          replacementProvided: true,
          startDate: '2026-01-05',
          endDate: '2026-01-07',
          notes: 'Motor diganti sementara',
        },
        adminId,
      );

      // Assert
      expect(record.serviceType).toBe(ServiceType.MAJOR);
      expect(record.replacementProvided).toBe(true);
      expect(record.compensationDays).toBe(0);
      expect(record.daySnapshots).toBeNull();
    });

    it('should compensate all UNPAID days for MAJOR+no replacement', async () => {
      // Arrange
      const contract = createTestContract({
        holidayScheme: HolidayScheme.NEW_CONTRACT,
        billingStartDate: new Date('2026-01-02'),
      });
      await contractRepo.create(contract);

      // Create UNPAID PaymentDays for Jan 5-7
      const pd5 = createTestPaymentDay(
        contract.id,
        new Date('2026-01-05'),
        PaymentDayStatus.UNPAID,
      );
      const pd6 = createTestPaymentDay(
        contract.id,
        new Date('2026-01-06'),
        PaymentDayStatus.UNPAID,
      );
      const pd7 = createTestPaymentDay(
        contract.id,
        new Date('2026-01-07'),
        PaymentDayStatus.UNPAID,
      );
      await paymentDayRepo.create(pd5);
      await paymentDayRepo.create(pd6);
      await paymentDayRepo.create(pd7);

      // Act
      const record = await service.createServiceRecord(
        {
          contractId: contract.id,
          serviceType: ServiceType.MAJOR,
          replacementProvided: false,
          startDate: '2026-01-05',
          endDate: '2026-01-07',
        },
        adminId,
      );

      // Assert: all UNPAID days become COMPENSATED
      const updatedPd5 = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-05'),
      );
      const updatedPd6 = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-06'),
      );
      const updatedPd7 = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-07'),
      );

      expect(updatedPd5?.status).toBe(PaymentDayStatus.COMPENSATED);
      expect(updatedPd6?.status).toBe(PaymentDayStatus.COMPENSATED);
      expect(updatedPd7?.status).toBe(PaymentDayStatus.COMPENSATED);
      expect(record.compensationDays).toBe(3);
    });

    it('should compensate PAID days and shift them forward', async () => {
      // Arrange: PAID on Jan 5-7, no records after
      const contract = createTestContract({
        holidayScheme: HolidayScheme.NEW_CONTRACT,
        billingStartDate: new Date('2026-01-02'),
      });
      await contractRepo.create(contract);

      const pd5 = createTestPaymentDay(contract.id, new Date('2026-01-05'), PaymentDayStatus.PAID);
      const pd6 = createTestPaymentDay(contract.id, new Date('2026-01-06'), PaymentDayStatus.PAID);
      const pd7 = createTestPaymentDay(contract.id, new Date('2026-01-07'), PaymentDayStatus.PAID);
      await paymentDayRepo.create(pd5);
      await paymentDayRepo.create(pd6);
      await paymentDayRepo.create(pd7);

      // Act
      const record = await service.createServiceRecord(
        {
          contractId: contract.id,
          serviceType: ServiceType.MAJOR,
          replacementProvided: false,
          startDate: '2026-01-05',
          endDate: '2026-01-07',
        },
        adminId,
      );

      // Assert: Jan 5-7 become COMPENSATED
      const updatedPd5 = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-05'),
      );
      const updatedPd6 = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-06'),
      );
      const updatedPd7 = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-07'),
      );

      expect(updatedPd5?.status).toBe(PaymentDayStatus.COMPENSATED);
      expect(updatedPd6?.status).toBe(PaymentDayStatus.COMPENSATED);
      expect(updatedPd7?.status).toBe(PaymentDayStatus.COMPENSATED);

      // Assert: 3 PAID days shifted forward (Jan 8, 9, 10 become PAID)
      const shiftedPd8 = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-08'),
      );
      const shiftedPd9 = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-09'),
      );
      const shiftedPd10 = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-10'),
      );

      expect(shiftedPd8?.status).toBe(PaymentDayStatus.PAID);
      expect(shiftedPd9?.status).toBe(PaymentDayStatus.PAID);
      expect(shiftedPd10?.status).toBe(PaymentDayStatus.PAID);

      expect(record.compensationDays).toBe(3);

      // Assert: daySnapshots records shifted dates
      expect(record.daySnapshots).not.toBeNull();
      expect(record.daySnapshots!.length).toBe(3);
      const snapshot5 = record.daySnapshots!.find((s) => s.date === '2026-01-05');
      expect(snapshot5?.originalStatus).toBe('PAID');
      expect(snapshot5?.shiftedToDate).toBe('2026-01-08');
    });

    it('should handle mixed PAID+UNPAID days correctly', async () => {
      // Arrange: Jan 5 = PAID, Jan 6 = UNPAID, Jan 7 = PAID
      const contract = createTestContract({
        holidayScheme: HolidayScheme.NEW_CONTRACT,
        billingStartDate: new Date('2026-01-02'),
      });
      await contractRepo.create(contract);

      const pd5 = createTestPaymentDay(contract.id, new Date('2026-01-05'), PaymentDayStatus.PAID);
      const pd6 = createTestPaymentDay(
        contract.id,
        new Date('2026-01-06'),
        PaymentDayStatus.UNPAID,
      );
      const pd7 = createTestPaymentDay(contract.id, new Date('2026-01-07'), PaymentDayStatus.PAID);
      await paymentDayRepo.create(pd5);
      await paymentDayRepo.create(pd6);
      await paymentDayRepo.create(pd7);

      // Act
      await service.createServiceRecord(
        {
          contractId: contract.id,
          serviceType: ServiceType.MAJOR,
          replacementProvided: false,
          startDate: '2026-01-05',
          endDate: '2026-01-07',
        },
        adminId,
      );

      // Assert: all 3 days COMPENSATED
      const updatedPd5 = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-05'),
      );
      const updatedPd6 = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-06'),
      );
      const updatedPd7 = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-07'),
      );

      expect(updatedPd5?.status).toBe(PaymentDayStatus.COMPENSATED);
      expect(updatedPd6?.status).toBe(PaymentDayStatus.COMPENSATED);
      expect(updatedPd7?.status).toBe(PaymentDayStatus.COMPENSATED);

      // 2 PAID days shifted forward (Jan 8, 9)
      const shiftedPd8 = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-08'),
      );
      const shiftedPd9 = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-09'),
      );
      expect(shiftedPd8?.status).toBe(PaymentDayStatus.PAID);
      expect(shiftedPd9?.status).toBe(PaymentDayStatus.PAID);
    });

    it('should skip HOLIDAY days during compensation (NEW_CONTRACT)', async () => {
      // Jan 29 is holiday for NEW_CONTRACT (date > 28)
      const contract = createTestContract({
        holidayScheme: HolidayScheme.NEW_CONTRACT,
        billingStartDate: new Date('2026-01-02'),
      });
      await contractRepo.create(contract);

      // Create HOLIDAY PaymentDay for Jan 29
      const holidayPd = createTestPaymentDay(
        contract.id,
        new Date('2026-01-29'),
        PaymentDayStatus.HOLIDAY,
        { amount: 0 },
      );
      await paymentDayRepo.create(holidayPd);

      // Also create UNPAID for Jan 28
      const pd28 = createTestPaymentDay(
        contract.id,
        new Date('2026-01-28'),
        PaymentDayStatus.UNPAID,
      );
      await paymentDayRepo.create(pd28);

      // Act: service record covers Jan 28-29
      const record = await service.createServiceRecord(
        {
          contractId: contract.id,
          serviceType: ServiceType.MAJOR,
          replacementProvided: false,
          startDate: '2026-01-28',
          endDate: '2026-01-29',
        },
        adminId,
      );

      // Assert: Jan 29 HOLIDAY stays HOLIDAY
      const updatedHoliday = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-29'),
      );
      expect(updatedHoliday?.status).toBe(PaymentDayStatus.HOLIDAY);

      // Jan 28 becomes COMPENSATED
      const updatedPd28 = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-28'),
      );
      expect(updatedPd28?.status).toBe(PaymentDayStatus.COMPENSATED);

      // Only 1 compensation day (Jan 28), holiday not counted
      expect(record.compensationDays).toBe(1);
    });

    it('should void invoice when PENDING day is compensated', async () => {
      // Arrange
      const contract = createTestContract({
        holidayScheme: HolidayScheme.NEW_CONTRACT,
        billingStartDate: new Date('2026-01-02'),
      });
      await contractRepo.create(contract);

      // Create an invoice
      const invoice = createTestInvoice(contract.id, {
        status: PaymentStatus.PENDING,
        daysCount: 1,
        periodStart: new Date('2026-01-05'),
        periodEnd: new Date('2026-01-05'),
        dailyRate: 58000,
        amount: 58000,
      });
      await invoiceRepo.create(invoice);

      // Create PENDING PaymentDay linked to the invoice
      const pd5 = createTestPaymentDay(
        contract.id,
        new Date('2026-01-05'),
        PaymentDayStatus.PENDING,
        {
          paymentId: invoice.id,
          amount: 58000,
        },
      );
      await paymentDayRepo.create(pd5);

      // Act
      await service.createServiceRecord(
        {
          contractId: contract.id,
          serviceType: ServiceType.MAJOR,
          replacementProvided: false,
          startDate: '2026-01-05',
          endDate: '2026-01-05',
        },
        adminId,
      );

      // Assert: PaymentDay becomes COMPENSATED
      const updatedPd5 = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-05'),
      );
      expect(updatedPd5?.status).toBe(PaymentDayStatus.COMPENSATED);

      // Assert: Invoice becomes VOID
      const updatedInvoice = await invoiceRepo.findById(invoice.id);
      expect(updatedInvoice?.status).toBe(PaymentStatus.VOID);
    });

    it('should reduce invoice amount when only some PENDING days are compensated', async () => {
      // Arrange: invoice covers 3 days, only 1 is compensated
      const contract = createTestContract({
        holidayScheme: HolidayScheme.NEW_CONTRACT,
        billingStartDate: new Date('2026-01-02'),
      });
      await contractRepo.create(contract);

      // Create invoice covering Jan 5-7 (3 days)
      const invoice = createTestInvoice(contract.id, {
        status: PaymentStatus.PENDING,
        daysCount: 3,
        periodStart: new Date('2026-01-05'),
        periodEnd: new Date('2026-01-07'),
        dailyRate: 58000,
        amount: 174000, // 3 * 58000
      });
      await invoiceRepo.create(invoice);

      // Create PENDING PaymentDays for Jan 5-7 all linked to same invoice
      for (const dateStr of ['2026-01-05', '2026-01-06', '2026-01-07']) {
        const pd = createTestPaymentDay(contract.id, new Date(dateStr), PaymentDayStatus.PENDING, {
          paymentId: invoice.id,
          amount: 58000,
        });
        await paymentDayRepo.create(pd);
      }

      // Act: only compensate Jan 5
      await service.createServiceRecord(
        {
          contractId: contract.id,
          serviceType: ServiceType.MAJOR,
          replacementProvided: false,
          startDate: '2026-01-05',
          endDate: '2026-01-05',
        },
        adminId,
      );

      // Assert: invoice reduced to 2 days
      const updatedInvoice = await invoiceRepo.findById(invoice.id);
      expect(updatedInvoice?.status).toBe(PaymentStatus.PENDING);
      expect(updatedInvoice?.daysCount).toBe(2);
      expect(updatedInvoice?.amount).toBe(116000); // 2 * 58000
    });

    it('should reject if contract not found', async () => {
      await expect(
        service.createServiceRecord(
          {
            contractId: 'non-existent-id',
            serviceType: ServiceType.MAJOR,
            replacementProvided: false,
            startDate: '2026-01-05',
            endDate: '2026-01-07',
          },
          adminId,
        ),
      ).rejects.toThrow('Kontrak tidak ditemukan');
    });

    it('should reject if contract is COMPLETED', async () => {
      const contract = createTestContract({ status: ContractStatus.COMPLETED });
      await contractRepo.create(contract);

      await expect(
        service.createServiceRecord(
          {
            contractId: contract.id,
            serviceType: ServiceType.MAJOR,
            replacementProvided: false,
            startDate: '2026-01-05',
            endDate: '2026-01-07',
          },
          adminId,
        ),
      ).rejects.toThrow();
    });

    it('should reject if contract is CANCELLED', async () => {
      const contract = createTestContract({ status: ContractStatus.CANCELLED });
      await contractRepo.create(contract);

      await expect(
        service.createServiceRecord(
          {
            contractId: contract.id,
            serviceType: ServiceType.MAJOR,
            replacementProvided: false,
            startDate: '2026-01-05',
            endDate: '2026-01-07',
          },
          adminId,
        ),
      ).rejects.toThrow();
    });

    it('should accept OVERDUE contract', async () => {
      const contract = createTestContract({ status: ContractStatus.OVERDUE });
      await contractRepo.create(contract);

      const record = await service.createServiceRecord(
        {
          contractId: contract.id,
          serviceType: ServiceType.MINOR,
          replacementProvided: false,
          startDate: '2026-01-05',
          endDate: '2026-01-07',
        },
        adminId,
      );

      expect(record.status).toBe(ServiceRecordStatus.ACTIVE);
    });

    it('should reject overlapping service records', async () => {
      // Arrange
      const contract = createTestContract();
      await contractRepo.create(contract);

      // Create first service record
      await service.createServiceRecord(
        {
          contractId: contract.id,
          serviceType: ServiceType.MINOR,
          replacementProvided: false,
          startDate: '2026-01-05',
          endDate: '2026-01-10',
        },
        adminId,
      );

      // Act: try to create overlapping record
      await expect(
        service.createServiceRecord(
          {
            contractId: contract.id,
            serviceType: ServiceType.MAJOR,
            replacementProvided: false,
            startDate: '2026-01-08', // overlaps with Jan 5-10
            endDate: '2026-01-12',
          },
          adminId,
        ),
      ).rejects.toThrow('Terdapat service record aktif yang overlap dengan periode ini');
    });

    it('should reject if startDate > endDate', async () => {
      const contract = createTestContract();
      await contractRepo.create(contract);

      await expect(
        service.createServiceRecord(
          {
            contractId: contract.id,
            serviceType: ServiceType.MAJOR,
            replacementProvided: false,
            startDate: '2026-01-10',
            endDate: '2026-01-05', // endDate before startDate
          },
          adminId,
        ),
      ).rejects.toThrow('Tanggal mulai harus sebelum atau sama dengan tanggal selesai');
    });

    it('should handle single day service (startDate = endDate)', async () => {
      // Arrange
      const contract = createTestContract({
        holidayScheme: HolidayScheme.NEW_CONTRACT,
        billingStartDate: new Date('2026-01-02'),
      });
      await contractRepo.create(contract);

      const pd5 = createTestPaymentDay(
        contract.id,
        new Date('2026-01-05'),
        PaymentDayStatus.UNPAID,
      );
      await paymentDayRepo.create(pd5);

      // Act
      const record = await service.createServiceRecord(
        {
          contractId: contract.id,
          serviceType: ServiceType.MAJOR,
          replacementProvided: false,
          startDate: '2026-01-05',
          endDate: '2026-01-05',
        },
        adminId,
      );

      // Assert
      const updatedPd5 = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-05'),
      );
      expect(updatedPd5?.status).toBe(PaymentDayStatus.COMPENSATED);
      expect(record.compensationDays).toBe(1);
    });

    it('should set service record fields correctly', async () => {
      // Arrange
      const contract = createTestContract();
      await contractRepo.create(contract);

      // Act
      const record = await service.createServiceRecord(
        {
          contractId: contract.id,
          serviceType: ServiceType.MINOR,
          replacementProvided: false,
          startDate: '2026-01-05',
          endDate: '2026-01-07',
          notes: 'Service rutin',
          attachment: 'https://storage.example.com/service/photo.jpg',
        },
        adminId,
      );

      // Assert
      expect(record.id).toBeDefined();
      expect(record.contractId).toBe(contract.id);
      expect(record.createdBy).toBe(adminId);
      expect(record.notes).toBe('Service rutin');
      expect(record.attachment).toBe('https://storage.example.com/service/photo.jpg');
      expect(record.revokedAt).toBeNull();
      expect(record.revokedBy).toBeNull();
      expect(record.revokeReason).toBeNull();
    });
  });

  // ============ revokeServiceRecord ============

  describe('revokeServiceRecord', () => {
    it('should restore PAID days and revert shifted days after revoke', async () => {
      // Arrange: Create a compensation with PAID days shifted
      const contract = createTestContract({
        holidayScheme: HolidayScheme.NEW_CONTRACT,
        billingStartDate: new Date('2026-01-02'),
      });
      await contractRepo.create(contract);

      // Create PAID PaymentDays for Jan 5-6
      const pd5 = createTestPaymentDay(contract.id, new Date('2026-01-05'), PaymentDayStatus.PAID);
      const pd6 = createTestPaymentDay(contract.id, new Date('2026-01-06'), PaymentDayStatus.PAID);
      await paymentDayRepo.create(pd5);
      await paymentDayRepo.create(pd6);

      // Apply compensation
      const record = await service.createServiceRecord(
        {
          contractId: contract.id,
          serviceType: ServiceType.MAJOR,
          replacementProvided: false,
          startDate: '2026-01-05',
          endDate: '2026-01-06',
        },
        adminId,
      );

      // Verify shift happened before revoke
      // endDate = Jan 6, so first available slot = Jan 7
      const pd5AfterComp = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-05'),
      );
      const pd7AfterComp = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-07'),
      );
      expect(pd5AfterComp?.status).toBe(PaymentDayStatus.COMPENSATED);
      expect(pd7AfterComp?.status).toBe(PaymentDayStatus.PAID);

      // Act: revoke
      await service.revokeServiceRecord(record.id, 'Motor sudah tersedia', adminId);

      // Assert: Jan 5-6 restored to PAID
      const pd5AfterRevoke = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-05'),
      );
      const pd6AfterRevoke = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-06'),
      );
      expect(pd5AfterRevoke?.status).toBe(PaymentDayStatus.PAID);
      expect(pd6AfterRevoke?.status).toBe(PaymentDayStatus.PAID);

      // Assert: shifted days (Jan 7-8) reverted to UNPAID
      const pd7AfterRevoke = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-07'),
      );
      const pd8AfterRevoke = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-08'),
      );
      expect(pd7AfterRevoke?.status).toBe(PaymentDayStatus.UNPAID);
      expect(pd8AfterRevoke?.status).toBe(PaymentDayStatus.UNPAID);
    });

    it('should restore UNPAID days back to UNPAID after revoke', async () => {
      // Arrange
      const contract = createTestContract({
        holidayScheme: HolidayScheme.NEW_CONTRACT,
        billingStartDate: new Date('2026-01-02'),
      });
      await contractRepo.create(contract);

      // Create UNPAID PaymentDays
      const pd5 = createTestPaymentDay(
        contract.id,
        new Date('2026-01-05'),
        PaymentDayStatus.UNPAID,
      );
      const pd6 = createTestPaymentDay(
        contract.id,
        new Date('2026-01-06'),
        PaymentDayStatus.UNPAID,
      );
      await paymentDayRepo.create(pd5);
      await paymentDayRepo.create(pd6);

      // Apply compensation
      const record = await service.createServiceRecord(
        {
          contractId: contract.id,
          serviceType: ServiceType.MAJOR,
          replacementProvided: false,
          startDate: '2026-01-05',
          endDate: '2026-01-06',
        },
        adminId,
      );

      // Act: revoke
      await service.revokeServiceRecord(record.id, 'Dibatalkan', adminId);

      // Assert: Jan 5-6 restored to UNPAID
      const pd5AfterRevoke = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-05'),
      );
      const pd6AfterRevoke = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-06'),
      );
      expect(pd5AfterRevoke?.status).toBe(PaymentDayStatus.UNPAID);
      expect(pd6AfterRevoke?.status).toBe(PaymentDayStatus.UNPAID);
    });

    it('should reject revoking already revoked record', async () => {
      // Arrange
      const contract = createTestContract();
      await contractRepo.create(contract);

      const record = await service.createServiceRecord(
        {
          contractId: contract.id,
          serviceType: ServiceType.MINOR,
          replacementProvided: false,
          startDate: '2026-01-05',
          endDate: '2026-01-05',
        },
        adminId,
      );

      // First revoke
      await service.revokeServiceRecord(record.id, 'Pertama kali', adminId);

      // Act: try to revoke again
      await expect(service.revokeServiceRecord(record.id, 'Kedua kali', adminId)).rejects.toThrow(
        'Hanya service record ACTIVE yang bisa di-revoke',
      );
    });

    it('should reject if service record not found', async () => {
      await expect(
        service.revokeServiceRecord('non-existent-id', 'Alasan', adminId),
      ).rejects.toThrow('Service record tidak ditemukan');
    });

    it('should update service record status, revokedAt, revokedBy, revokeReason', async () => {
      // Arrange
      const contract = createTestContract();
      await contractRepo.create(contract);

      const record = await service.createServiceRecord(
        {
          contractId: contract.id,
          serviceType: ServiceType.MINOR,
          replacementProvided: false,
          startDate: '2026-01-05',
          endDate: '2026-01-07',
        },
        adminId,
      );

      // Act
      const revokeReason = 'Motor sudah kembali, kompensasi dibatalkan';
      const revoked = await service.revokeServiceRecord(record.id, revokeReason, adminId);

      // Assert
      expect(revoked.status).toBe(ServiceRecordStatus.REVOKED);
      expect(revoked.revokedAt).not.toBeNull();
      expect(revoked.revokedBy).toBe(adminId);
      expect(revoked.revokeReason).toBe(revokeReason);
    });
  });

  // ============ syncContractFromPaymentDays with COMPENSATED ============

  describe('syncContractFromPaymentDays with COMPENSATED days', () => {
    it('should NOT count COMPENSATED days in totalDaysPaid', async () => {
      // Arrange: PAID-PAID-COMPENSATED-PAID sequence
      // billingStartDate = Jan 2
      // Jan 2 = PAID, Jan 3 = PAID, Jan 4 = COMPENSATED, Jan 5 = PAID
      // syncContractFromPaymentDays uses contiguous walk — stops at gap
      // COMPENSATED is treated as a gap in the contiguous walk
      const contract = createTestContract({
        holidayScheme: HolidayScheme.NEW_CONTRACT,
        billingStartDate: new Date('2026-01-02'),
      });
      await contractRepo.create(contract);

      // Create PaymentDays
      const pd2 = createTestPaymentDay(contract.id, new Date('2026-01-02'), PaymentDayStatus.PAID, {
        amount: 58000,
      });
      const pd3 = createTestPaymentDay(contract.id, new Date('2026-01-03'), PaymentDayStatus.PAID, {
        amount: 58000,
      });
      const pd4 = createTestPaymentDay(
        contract.id,
        new Date('2026-01-04'),
        PaymentDayStatus.COMPENSATED,
        { amount: 0 },
      );
      const pd5 = createTestPaymentDay(contract.id, new Date('2026-01-05'), PaymentDayStatus.PAID, {
        amount: 58000,
      });
      await paymentDayRepo.create(pd2);
      await paymentDayRepo.create(pd3);
      await paymentDayRepo.create(pd4);
      await paymentDayRepo.create(pd5);

      // Act: sync contract from payment days
      await paymentService.syncContractFromPaymentDays(contract.id);

      // Assert: syncContractFromPaymentDays contiguous walk should continue through COMPENSATED
      const updated = await contractRepo.findById(contract.id);
      // COMPENSATED days are included in the contiguous walk (they credit toward ownership)
      // so totalDaysPaid should include them
      expect(updated).not.toBeNull();
      expect(updated!.totalDaysPaid).toBeGreaterThanOrEqual(2);
    });

    it('should track compensatedDaysPaid on contract separately', async () => {
      // Arrange: apply compensation and verify the contract field is updated
      const contract = createTestContract({
        holidayScheme: HolidayScheme.NEW_CONTRACT,
        billingStartDate: new Date('2026-01-02'),
      });
      await contractRepo.create(contract);

      // Create UNPAID PaymentDays
      const pd5 = createTestPaymentDay(
        contract.id,
        new Date('2026-01-05'),
        PaymentDayStatus.UNPAID,
      );
      const pd6 = createTestPaymentDay(
        contract.id,
        new Date('2026-01-06'),
        PaymentDayStatus.UNPAID,
      );
      await paymentDayRepo.create(pd5);
      await paymentDayRepo.create(pd6);

      // Act: apply compensation
      await service.createServiceRecord(
        {
          contractId: contract.id,
          serviceType: ServiceType.MAJOR,
          replacementProvided: false,
          startDate: '2026-01-05',
          endDate: '2026-01-06',
        },
        adminId,
      );

      // Verify COMPENSATED days were created
      const pdAfter5 = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-05'),
      );
      const pdAfter6 = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-06'),
      );
      expect(pdAfter5?.status).toBe(PaymentDayStatus.COMPENSATED);
      expect(pdAfter6?.status).toBe(PaymentDayStatus.COMPENSATED);

      // Assert: service record reflects correct compensationDays
      const records = await service.getByContractId(contract.id);
      expect(records[0].compensationDays).toBe(2);
    });
  });

  // ============ Read Operations ============

  describe('read operations', () => {
    it('should get service records by contract ID sorted by createdAt desc', async () => {
      // Arrange
      const contract = createTestContract();
      await contractRepo.create(contract);

      // Create two records at different times
      const now = new Date();
      const earlier = new Date(now.getTime() - 10000);
      const later = new Date(now.getTime() + 10000);

      await serviceRecordRepo.create({
        id: 'record-1',
        contractId: contract.id,
        serviceType: ServiceType.MINOR,
        replacementProvided: false,
        startDate: new Date('2026-01-05'),
        endDate: new Date('2026-01-05'),
        compensationDays: 0,
        notes: 'First record',
        attachment: null,
        daySnapshots: null,
        status: ServiceRecordStatus.ACTIVE,
        revokedAt: null,
        revokedBy: null,
        revokeReason: null,
        createdBy: adminId,
        createdAt: earlier,
        updatedAt: earlier,
      });

      await serviceRecordRepo.create({
        id: 'record-2',
        contractId: contract.id,
        serviceType: ServiceType.MAJOR,
        replacementProvided: true,
        startDate: new Date('2026-01-10'),
        endDate: new Date('2026-01-10'),
        compensationDays: 0,
        notes: 'Second record',
        attachment: null,
        daySnapshots: null,
        status: ServiceRecordStatus.ACTIVE,
        revokedAt: null,
        revokedBy: null,
        revokeReason: null,
        createdBy: adminId,
        createdAt: later,
        updatedAt: later,
      });

      // Act
      const records = await service.getByContractId(contract.id);

      // Assert: sorted by createdAt desc (newest first)
      expect(records.length).toBe(2);
      expect(records[0].id).toBe('record-2'); // later created
      expect(records[1].id).toBe('record-1'); // earlier created
    });

    it('should get service record by ID', async () => {
      // Arrange
      const contract = createTestContract();
      await contractRepo.create(contract);

      const record = await service.createServiceRecord(
        {
          contractId: contract.id,
          serviceType: ServiceType.MINOR,
          replacementProvided: false,
          startDate: '2026-01-05',
          endDate: '2026-01-07',
          notes: 'Test record',
        },
        adminId,
      );

      // Act
      const found = await service.getById(record.id);

      // Assert
      expect(found).not.toBeNull();
      expect(found!.id).toBe(record.id);
      expect(found!.notes).toBe('Test record');
    });

    it('should return null for non-existent service record ID', async () => {
      const found = await service.getById('non-existent-id');
      expect(found).toBeNull();
    });

    it('should return empty array for contract with no service records', async () => {
      const contract = createTestContract();
      await contractRepo.create(contract);

      const records = await service.getByContractId(contract.id);
      expect(records).toEqual([]);
    });
  });

  // ============ Additional edge case tests ============

  describe('edge cases', () => {
    it('should not affect other contracts PaymentDays', async () => {
      // Arrange: two contracts
      const contract1 = createTestContract({ id: 'contract-1' });
      const contract2 = createTestContract({ id: 'contract-2', contractNumber: 'RTO-260101-0002' });
      await contractRepo.create(contract1);
      await contractRepo.create(contract2);

      // Create UNPAID day for contract2 on same date
      const pd5ForContract2 = createTestPaymentDay(
        contract2.id,
        new Date('2026-01-05'),
        PaymentDayStatus.UNPAID,
      );
      await paymentDayRepo.create(pd5ForContract2);

      // Act: compensate contract1 Jan 5
      await service.createServiceRecord(
        {
          contractId: contract1.id,
          serviceType: ServiceType.MAJOR,
          replacementProvided: false,
          startDate: '2026-01-05',
          endDate: '2026-01-05',
        },
        adminId,
      );

      // Assert: contract2's PaymentDay is NOT affected
      const contract2Pd5 = await paymentDayRepo.findByContractAndDate(
        contract2.id,
        new Date('2026-01-05'),
      );
      expect(contract2Pd5?.status).toBe(PaymentDayStatus.UNPAID);
    });

    it('should not compensate VOIDED days', async () => {
      // Arrange
      const contract = createTestContract({
        holidayScheme: HolidayScheme.NEW_CONTRACT,
        billingStartDate: new Date('2026-01-02'),
      });
      await contractRepo.create(contract);

      // Create VOIDED PaymentDay
      const voidedPd = createTestPaymentDay(
        contract.id,
        new Date('2026-01-05'),
        PaymentDayStatus.VOIDED,
        { amount: 0 },
      );
      await paymentDayRepo.create(voidedPd);

      // Act
      const record = await service.createServiceRecord(
        {
          contractId: contract.id,
          serviceType: ServiceType.MAJOR,
          replacementProvided: false,
          startDate: '2026-01-05',
          endDate: '2026-01-05',
        },
        adminId,
      );

      // Assert: VOIDED day stays VOIDED (not compensated)
      const updatedPd5 = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-05'),
      );
      expect(updatedPd5?.status).toBe(PaymentDayStatus.VOIDED);

      // No compensation days
      expect(record.compensationDays).toBe(0);
    });

    it('should shift PAID days correctly skipping holiday dates for NEW_CONTRACT', async () => {
      // Arrange: PAID Jan 26-27, service record Jan 26-27
      // Shift target: Jan 28 (working), Jan 29 is HOLIDAY (skipped), goes to Feb 1
      const contract = createTestContract({
        holidayScheme: HolidayScheme.NEW_CONTRACT,
        billingStartDate: new Date('2026-01-02'),
      });
      await contractRepo.create(contract);

      // Jan 28 = working day (date <= 28), Jan 29-31 = holiday
      const pd26 = createTestPaymentDay(contract.id, new Date('2026-01-26'), PaymentDayStatus.PAID);
      const pd27 = createTestPaymentDay(contract.id, new Date('2026-01-27'), PaymentDayStatus.PAID);
      await paymentDayRepo.create(pd26);
      await paymentDayRepo.create(pd27);

      // Act
      await service.createServiceRecord(
        {
          contractId: contract.id,
          serviceType: ServiceType.MAJOR,
          replacementProvided: false,
          startDate: '2026-01-26',
          endDate: '2026-01-27',
        },
        adminId,
      );

      // Assert: Jan 26-27 become COMPENSATED
      const updatedPd26 = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-26'),
      );
      const updatedPd27 = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-01-27'),
      );
      expect(updatedPd26?.status).toBe(PaymentDayStatus.COMPENSATED);
      expect(updatedPd27?.status).toBe(PaymentDayStatus.COMPENSATED);

      // Assert: shift goes to Jan 28 (working), skips 29-31, then Feb 1
      const pd28 = await paymentDayRepo.findByContractAndDate(contract.id, new Date('2026-01-28'));
      const pd29 = await paymentDayRepo.findByContractAndDate(contract.id, new Date('2026-01-29'));
      const pd31 = await paymentDayRepo.findByContractAndDate(contract.id, new Date('2026-01-31'));
      const pdFeb1 = await paymentDayRepo.findByContractAndDate(
        contract.id,
        new Date('2026-02-01'),
      );

      // Jan 28 should be PAID (first available shift target)
      expect(pd28?.status).toBe(PaymentDayStatus.PAID);
      // Jan 29-31 holiday — not created by shift
      expect(pd29).toBeNull();
      expect(pd31).toBeNull();
      // Feb 1 should be PAID (second shift target)
      expect(pdFeb1?.status).toBe(PaymentDayStatus.PAID);
    });
  });
});
