import {
  IServiceRecordRepository,
  IContractRepository,
  IInvoiceRepository,
  IAuditLogRepository,
  IPaymentDayRepository,
  ITransactionManager,
} from '../../domain/interfaces';
import { TransactionalRepos } from '../../domain/interfaces/ITransactionManager';
import { ServiceRecord, DaySnapshot } from '../../domain/entities/ServiceRecord';
import { Contract } from '../../domain/entities/Contract';
import {
  ServiceType,
  ServiceRecordStatus,
  PaymentDayStatus,
  PaymentStatus,
  ContractStatus,
  AuditAction,
  MOTOR_DAILY_RATES,
} from '../../domain/enums';
import { toDateKey, toLocalMidnightWib, getWibToday } from '../../domain/utils/dateUtils';
import { PaymentService } from './PaymentService';
import { SavingService } from './SavingService';
import { v4 as uuidv4 } from 'uuid';

export class ServiceCompensationService {
  private savingService?: SavingService;

  constructor(
    private serviceRecordRepo: IServiceRecordRepository,
    private paymentDayRepo: IPaymentDayRepository,
    private contractRepo: IContractRepository,
    private invoiceRepo: IInvoiceRepository,
    private auditRepo: IAuditLogRepository,
    private paymentService: PaymentService,
    private txManager?: ITransactionManager,
  ) {}

  setSavingService(savingService: SavingService): void {
    this.savingService = savingService;
  }

  // ============ Read Operations ============

  async getById(id: string): Promise<ServiceRecord | null> {
    return this.serviceRecordRepo.findById(id);
  }

  async getByContractId(contractId: string): Promise<ServiceRecord[]> {
    return this.serviceRecordRepo.findByContractId(contractId);
  }

  // ============ Create Service Record ============

  async createServiceRecord(
    dto: {
      contractId: string;
      serviceType: ServiceType;
      replacementProvided: boolean;
      startDate: string;
      endDate: string;
      notes?: string;
      attachment?: string | null;
    },
    adminId: string,
  ): Promise<ServiceRecord> {
    // 1. Validate contract (READS outside transaction)
    const contract = await this.contractRepo.findById(dto.contractId);
    if (!contract) throw new Error('Kontrak tidak ditemukan');
    if (contract.status !== ContractStatus.ACTIVE && contract.status !== ContractStatus.OVERDUE) {
      throw new Error('Kompensasi hanya bisa dilakukan pada kontrak ACTIVE atau OVERDUE');
    }

    const startDate = toLocalMidnightWib(new Date(dto.startDate));
    const endDate = toLocalMidnightWib(new Date(dto.endDate));

    if (startDate > endDate) {
      throw new Error('Tanggal mulai harus sebelum atau sama dengan tanggal selesai');
    }

    // 2. Check overlap with existing ACTIVE service records
    const overlapping = await this.serviceRecordRepo.findActiveByContractAndDateRange(
      dto.contractId,
      startDate,
      endDate,
    );
    if (overlapping.length > 0) {
      throw new Error('Terdapat service record aktif yang overlap dengan periode ini');
    }

    const now = new Date();
    const recordId = uuidv4();

    // 3. For MINOR or MAJOR+replacement: just create record, no compensation
    if (
      dto.serviceType === ServiceType.MINOR ||
      (dto.serviceType === ServiceType.MAJOR && dto.replacementProvided)
    ) {
      const record: ServiceRecord = {
        id: recordId,
        contractId: dto.contractId,
        serviceType: dto.serviceType,
        replacementProvided: dto.replacementProvided,
        startDate,
        endDate,
        compensationDays: 0,
        notes: dto.notes || '',
        attachment: dto.attachment || null,
        daySnapshots: null,
        status: ServiceRecordStatus.ACTIVE,
        revokedAt: null,
        revokedBy: null,
        revokeReason: null,
        createdBy: adminId,
        createdAt: now,
        updatedAt: now,
      };

      const writeOps = async (repos: TransactionalRepos) => {
        const created = await repos.serviceRecordRepo.create(record);

        await repos.auditRepo.create({
          id: uuidv4(),
          userId: adminId,
          action: AuditAction.CREATE,
          module: 'SERVICE_RECORD',
          entityId: recordId,
          description: `Service record created: ${dto.serviceType}, no compensation`,
          metadata: { serviceType: dto.serviceType, replacementProvided: dto.replacementProvided },
          ipAddress: '',
          createdAt: now,
        });

        return created;
      };

      if (this.txManager) {
        return this.txManager.runInTransaction(writeOps);
      } else {
        return writeOps({
          contractRepo: this.contractRepo,
          invoiceRepo: this.invoiceRepo,
          paymentDayRepo: this.paymentDayRepo,
          auditRepo: this.auditRepo,
          savingTxRepo: null as any,
          serviceRecordRepo: this.serviceRecordRepo,
          customerRepo: null as any,
          settingRepo: null as any,
        });
      }
    }

    // 4. MAJOR + no replacement: Apply compensation
    // All PaymentDay reads+writes interleave, so wrap everything in transaction
    const dailyRateKey = `${contract.motorModel}_${contract.batteryType}`;
    const dailyRate = MOTOR_DAILY_RATES[dailyRateKey] || contract.dailyRate;

    const writeOps = async (repos: TransactionalRepos) => {
      const snapshots: DaySnapshot[] = [];
      const paidDaysToShift: { date: Date; dateKey: string; invoiceId: string | null }[] = [];
      let compensationDays = 0;

      // Walk through each day in range
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateKey = toDateKey(currentDate);
        const dateClone = new Date(currentDate);

        // Check if this day is a holiday for this contract
        const isHoliday = this.paymentService.isLiburBayar(contract, currentDate);

        // Fetch existing PaymentDay (interface expects Date)
        const existingPD = await repos.paymentDayRepo.findByContractAndDate(
          dto.contractId,
          dateClone,
        );

        if (!existingPD) {
          // No PaymentDay yet — create as COMPENSATED (unless HOLIDAY)
          if (!isHoliday) {
            await repos.paymentDayRepo.create({
              id: uuidv4(),
              contractId: dto.contractId,
              date: dateClone,
              status: PaymentDayStatus.COMPENSATED,
              dailyRate,
              amount: 0,
              paymentId: null,
              notes: null,
              createdAt: now,
              updatedAt: now,
            });
            snapshots.push({
              date: dateKey,
              originalStatus: 'UNPAID',
              shiftedToDate: null,
              invoiceId: null,
            });
            compensationDays++;
          }
          // If isHoliday + no record: skip (holiday will be auto-created by scheduler)
        } else if (
          existingPD.status === PaymentDayStatus.HOLIDAY ||
          existingPD.status === PaymentDayStatus.VOIDED
        ) {
          // Skip holidays and voided days — no compensation needed
        } else if (existingPD.status === PaymentDayStatus.PAID) {
          // PAID → COMPENSATED + needs shift
          snapshots.push({
            date: dateKey,
            originalStatus: 'PAID',
            shiftedToDate: null, // Will be set in shift step
            invoiceId: existingPD.paymentId,
          });
          paidDaysToShift.push({
            date: dateClone,
            dateKey,
            invoiceId: existingPD.paymentId,
          });

          await repos.paymentDayRepo.update(existingPD.id, {
            status: PaymentDayStatus.COMPENSATED,
            amount: 0,
            paymentId: null,
          });
          compensationDays++;
        } else if (existingPD.status === PaymentDayStatus.PENDING) {
          // PENDING → COMPENSATED
          const invoiceId = existingPD.paymentId;

          snapshots.push({
            date: dateKey,
            originalStatus: 'PENDING',
            shiftedToDate: null,
            invoiceId,
          });

          await repos.paymentDayRepo.update(existingPD.id, {
            status: PaymentDayStatus.COMPENSATED,
            amount: 0,
            paymentId: null,
          });

          // Check if invoice needs to be voided or reduced
          if (invoiceId) {
            await this.handleInvoiceAfterCompensationWithRepos(invoiceId, repos);
          }

          compensationDays++;
        } else if (existingPD.status === PaymentDayStatus.UNPAID) {
          // UNPAID → COMPENSATED
          snapshots.push({
            date: dateKey,
            originalStatus: 'UNPAID',
            shiftedToDate: null,
            invoiceId: null,
          });

          await repos.paymentDayRepo.update(existingPD.id, {
            status: PaymentDayStatus.COMPENSATED,
            amount: 0,
          });
          compensationDays++;
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      // 5. Shift PAID days to after endDate
      if (paidDaysToShift.length > 0) {
        const shiftTargets = await this.findNextUnpaidDaysWithRepos(
          contract,
          endDate,
          paidDaysToShift.length,
          repos,
        );

        for (let i = 0; i < paidDaysToShift.length; i++) {
          const source = paidDaysToShift[i];
          const target = shiftTargets[i];

          if (target) {
            // Update snapshot with shift target
            const snapshotIdx = snapshots.findIndex((s) => s.date === source.dateKey);
            if (snapshotIdx >= 0) {
              snapshots[snapshotIdx].shiftedToDate = target.dateKey;
            }

            // Mark target day as PAID
            if (target.existingPD) {
              // If target has PENDING invoice, void it first
              if (
                target.existingPD.paymentId &&
                target.existingPD.status === PaymentDayStatus.PENDING
              ) {
                await this.handleInvoiceAfterCompensationWithRepos(
                  target.existingPD.paymentId,
                  repos,
                );
              }
              await repos.paymentDayRepo.update(target.existingPD.id, {
                status: PaymentDayStatus.PAID,
                amount: dailyRate,
              });
            } else {
              // Create new PaymentDay as PAID
              await repos.paymentDayRepo.create({
                id: uuidv4(),
                contractId: dto.contractId,
                date: target.date,
                status: PaymentDayStatus.PAID,
                dailyRate,
                amount: dailyRate,
                paymentId: null,
                notes: null,
                createdAt: now,
                updatedAt: now,
              });
            }
          }
        }
      }

      // 6. Save service record
      const record: ServiceRecord = {
        id: recordId,
        contractId: dto.contractId,
        serviceType: dto.serviceType,
        replacementProvided: false,
        startDate,
        endDate,
        compensationDays,
        notes: dto.notes || '',
        attachment: dto.attachment || null,
        daySnapshots: snapshots,
        status: ServiceRecordStatus.ACTIVE,
        revokedAt: null,
        revokedBy: null,
        revokeReason: null,
        createdBy: adminId,
        createdAt: now,
        updatedAt: now,
      };

      const created = await repos.serviceRecordRepo.create(record);

      // 7. Audit log
      await repos.auditRepo.create({
        id: uuidv4(),
        userId: adminId,
        action: AuditAction.CREATE,
        module: 'SERVICE_RECORD',
        entityId: recordId,
        description: `Service compensation applied: ${compensationDays} days compensated, ${paidDaysToShift.length} days shifted`,
        metadata: {
          serviceType: dto.serviceType,
          startDate: dto.startDate,
          endDate: dto.endDate,
          compensationDays,
          shiftedDays: paidDaysToShift.length,
        },
        ipAddress: '',
        createdAt: now,
      });

      return created;
    };

    let created: ServiceRecord;
    if (this.txManager) {
      created = await this.txManager.runInTransaction(writeOps);
    } else {
      created = await writeOps({
        contractRepo: this.contractRepo,
        invoiceRepo: this.invoiceRepo,
        paymentDayRepo: this.paymentDayRepo,
        auditRepo: this.auditRepo,
        savingTxRepo: null as any,
        serviceRecordRepo: this.serviceRecordRepo,
        customerRepo: null as any,
        settingRepo: null as any,
      });
    }

    // 8. Sync contract (outside transaction — uses PaymentService's own repos)
    await this.paymentService.syncContractFromPaymentDays(dto.contractId);

    return created;
  }

  // ============ Revoke Service Record ============

  async revokeServiceRecord(id: string, reason: string, adminId: string): Promise<ServiceRecord> {
    // READS outside transaction
    const record = await this.serviceRecordRepo.findById(id);
    if (!record) throw new Error('Service record tidak ditemukan');
    if (record.status !== ServiceRecordStatus.ACTIVE) {
      throw new Error('Hanya service record ACTIVE yang bisa di-revoke');
    }

    const contract = await this.contractRepo.findById(record.contractId);
    if (!contract) throw new Error('Kontrak tidak ditemukan');

    const dailyRateKey = `${contract.motorModel}_${contract.batteryType}`;
    const dailyRate = MOTOR_DAILY_RATES[dailyRateKey] || contract.dailyRate;

    // WRITES inside transaction
    const writeOps = async (repos: TransactionalRepos) => {
      // Restore from snapshots
      if (record.daySnapshots && record.daySnapshots.length > 0) {
        for (const snap of record.daySnapshots) {
          // findByContractAndDate expects Date, not string
          const snapDate = toLocalMidnightWib(new Date(snap.date));
          const pd = await repos.paymentDayRepo.findByContractAndDate(record.contractId, snapDate);

          if (!pd) continue;

          if (snap.originalStatus === 'PAID') {
            // Restore compensated day to PAID
            await repos.paymentDayRepo.update(pd.id, {
              status: PaymentDayStatus.PAID,
              amount: dailyRate,
              paymentId: snap.invoiceId,
            });

            // Revert shifted day back to UNPAID
            if (snap.shiftedToDate) {
              const shiftedDate = toLocalMidnightWib(new Date(snap.shiftedToDate));
              const shiftedPD = await repos.paymentDayRepo.findByContractAndDate(
                record.contractId,
                shiftedDate,
              );
              if (shiftedPD) {
                await repos.paymentDayRepo.update(shiftedPD.id, {
                  status: PaymentDayStatus.UNPAID,
                  amount: dailyRate,
                  paymentId: null,
                });
              }
            }
          } else if (snap.originalStatus === 'PENDING' || snap.originalStatus === 'UNPAID') {
            // Temporarily restore to UNPAID — will be re-linked to invoice below
            await repos.paymentDayRepo.update(pd.id, {
              status: PaymentDayStatus.UNPAID,
              amount: dailyRate,
              paymentId: null,
            });
          }
        }

        // Re-link originally PENDING days back to active invoice
        const pendingSnapshots = record.daySnapshots.filter((s) => s.originalStatus === 'PENDING');
        if (pendingSnapshots.length > 0) {
          const activeInvoice = await repos.invoiceRepo.findActiveByContractId(record.contractId);

          if (activeInvoice) {
            // Re-link restored days to the active invoice
            for (const snap of pendingSnapshots) {
              const snapDate = toLocalMidnightWib(new Date(snap.date));
              const pd = await repos.paymentDayRepo.findByContractAndDate(
                record.contractId,
                snapDate,
              );
              if (pd) {
                await repos.paymentDayRepo.update(pd.id, {
                  status: PaymentDayStatus.PENDING,
                  paymentId: activeInvoice.id,
                });
              }
            }

            // Expand invoice: recalculate from all linked PENDING days
            const allLinkedDays = await repos.paymentDayRepo.findByPaymentId(activeInvoice.id);
            const pendingLinked = allLinkedDays.filter(
              (d) => d.status === PaymentDayStatus.PENDING,
            );
            if (pendingLinked.length > 0) {
              const dates = pendingLinked
                .map((d) => d.date)
                .sort((a, b) => a.getTime() - b.getTime());
              const effectiveDailyRate = activeInvoice.dailyRate ?? dailyRate;
              const newAmount = pendingLinked.length * effectiveDailyRate;

              // Recalculate lateFee
              const nowWib = getWibToday();
              const lateFee = await this.paymentService.calculateLateFee(
                pendingLinked,
                nowWib,
                contract.holidayScheme,
              );

              await repos.invoiceRepo.update(activeInvoice.id, {
                daysCount: pendingLinked.length,
                amount: newAmount,
                periodStart: dates[0],
                periodEnd: dates[dates.length - 1],
                lateFee,
              });
            }
          }
          // If no active invoice (was fully voided), leave as UNPAID — scheduler will pick up
        }
      }

      // Update service record status
      const updated = await repos.serviceRecordRepo.update(id, {
        status: ServiceRecordStatus.REVOKED,
        revokedAt: new Date(),
        revokedBy: adminId,
        revokeReason: reason,
      });

      // Audit log
      await repos.auditRepo.create({
        id: uuidv4(),
        userId: adminId,
        action: AuditAction.UPDATE,
        module: 'SERVICE_RECORD',
        entityId: id,
        description: `Service compensation revoked: ${reason}`,
        metadata: { reason, compensationDays: record.compensationDays },
        ipAddress: '',
        createdAt: new Date(),
      });

      return updated;
    };

    let updated: ServiceRecord;
    if (this.txManager) {
      updated = await this.txManager.runInTransaction(writeOps);
    } else {
      updated = await writeOps({
        contractRepo: this.contractRepo,
        invoiceRepo: this.invoiceRepo,
        paymentDayRepo: this.paymentDayRepo,
        auditRepo: this.auditRepo,
        savingTxRepo: null as any,
        serviceRecordRepo: this.serviceRecordRepo,
        customerRepo: null as any,
        settingRepo: null as any,
      });
    }

    // Sync contract (outside transaction — uses PaymentService's own repos)
    await this.paymentService.syncContractFromPaymentDays(record.contractId);

    return updated;
  }

  // ============ Helper Methods ============

  /**
   * Find N UNPAID/PENDING days after the given date, skipping HOLIDAYs and COMPENSATED.
   * Returns slots where a shifted PAID day can be placed.
   * Uses transactional repos when available.
   */
  private async findNextUnpaidDaysWithRepos(
    contract: Contract,
    afterDate: Date,
    count: number,
    repos: TransactionalRepos,
  ): Promise<
    {
      date: Date;
      dateKey: string;
      existingPD: { id: string; status: PaymentDayStatus; paymentId: string | null } | null;
    }[]
  > {
    const results: {
      date: Date;
      dateKey: string;
      existingPD: { id: string; status: PaymentDayStatus; paymentId: string | null } | null;
    }[] = [];

    const currentDate = new Date(afterDate);
    currentDate.setDate(currentDate.getDate() + 1); // Start from day after endDate

    let maxIterations = 365; // Safety limit

    while (results.length < count && maxIterations > 0) {
      maxIterations--;
      const dateKey = toDateKey(currentDate);
      const dateClone = new Date(currentDate);

      // Skip holidays
      if (this.paymentService.isLiburBayar(contract, currentDate)) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      const existingPD = await repos.paymentDayRepo.findByContractAndDate(contract.id, dateClone);

      if (!existingPD) {
        // No record yet — this is an available slot
        results.push({ date: dateClone, dateKey, existingPD: null });
      } else if (existingPD.status === PaymentDayStatus.UNPAID) {
        results.push({
          date: dateClone,
          dateKey,
          existingPD: {
            id: existingPD.id,
            status: existingPD.status,
            paymentId: existingPD.paymentId,
          },
        });
      } else if (existingPD.status === PaymentDayStatus.PENDING) {
        // PENDING day can be used — its invoice will be voided/reduced when shifting
        results.push({
          date: dateClone,
          dateKey,
          existingPD: {
            id: existingPD.id,
            status: existingPD.status,
            paymentId: existingPD.paymentId,
          },
        });
      }
      // Skip PAID, HOLIDAY, COMPENSATED, VOIDED

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return results;
  }

  /**
   * After removing a PaymentDay from an invoice, check if the invoice should be
   * voided entirely or reduced in amount/daysCount.
   * Uses transactional repos when available.
   */
  private async handleInvoiceAfterCompensationWithRepos(
    invoiceId: string,
    repos: TransactionalRepos,
  ): Promise<void> {
    const invoice = await repos.invoiceRepo.findById(invoiceId);
    if (!invoice) return;
    if (invoice.status !== PaymentStatus.PENDING) return;

    // Check remaining PENDING days still linked to this invoice
    const linkedDays = await repos.paymentDayRepo.findByPaymentId(invoiceId);
    const remainingPendingDays = linkedDays.filter((d) => d.status === PaymentDayStatus.PENDING);

    if (remainingPendingDays.length === 0) {
      // All days removed — void the invoice
      await repos.invoiceRepo.update(invoiceId, {
        status: PaymentStatus.VOID,
      });
    } else {
      // Reduce invoice: recalculate daysCount, amount, period, and lateFee
      const newDaysCount = remainingPendingDays.length;
      const effectiveDailyRate = invoice.dailyRate ?? 0;
      const newAmount = newDaysCount * effectiveDailyRate;
      const dates = remainingPendingDays
        .map((d) => d.date)
        .sort((a, b) => a.getTime() - b.getTime());

      // Recalculate lateFee for remaining days
      const invContract = await repos.contractRepo.findById(invoice.contractId);
      const now = getWibToday();
      const lateFee = invContract
        ? await this.paymentService.calculateLateFee(
            remainingPendingDays,
            now,
            invContract.holidayScheme,
          )
        : 0;

      await repos.invoiceRepo.update(invoiceId, {
        daysCount: newDaysCount,
        amount: newAmount,
        periodStart: dates[0],
        periodEnd: dates[dates.length - 1],
        lateFee,
      });
    }
  }
}
