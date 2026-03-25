import {
  ISettingRepository,
  IAuditLogRepository,
  IContractRepository,
} from '../../domain/interfaces';
import { Setting } from '../../domain/entities';
import { AuditAction, ContractStatus } from '../../domain/enums';
import { UpdateSettingDto } from '../dtos';
import { v4 as uuidv4 } from 'uuid';
import { getWibToday } from '../../domain/utils/dateUtils';

export class SettingService {
  constructor(
    private settingRepo: ISettingRepository,
    private auditRepo: IAuditLogRepository,
    private contractRepo?: IContractRepository,
  ) {}

  async getAll(): Promise<Setting[]> {
    return this.settingRepo.findAll();
  }

  async getByKey(key: string): Promise<Setting | null> {
    return this.settingRepo.findByKey(key);
  }

  async getNumberSetting(key: string, fallback: number): Promise<number> {
    const setting = await this.settingRepo.findByKey(key);
    if (!setting) return fallback;
    const parsed = parseInt(setting.value, 10);
    return isNaN(parsed) ? fallback : parsed;
  }

  async update(dto: UpdateSettingDto, adminId: string): Promise<Setting> {
    const setting: Setting = {
      id: uuidv4(),
      key: dto.key,
      value: dto.value,
      description: dto.description || '',
      updatedAt: new Date(),
    };

    const result = await this.settingRepo.upsert(setting);

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.UPDATE,
      module: 'settings',
      entityId: dto.key,
      description: `Updated setting: ${dto.key}`,
      metadata: { key: dto.key, value: dto.value },
      ipAddress: '',
      createdAt: new Date(),
    });

    // Auto-sync grace_period_days ke semua kontrak ACTIVE + OVERDUE
    if (dto.key === 'grace_period_days' && this.contractRepo) {
      const days = parseInt(dto.value, 10);
      if (!isNaN(days) && days > 0) {
        const updatedCount = await this.contractRepo.updateGracePeriodByStatuses(days, [
          ContractStatus.ACTIVE,
          ContractStatus.OVERDUE,
        ]);

        // Recalculate status: ACTIVE → OVERDUE atau OVERDUE → ACTIVE
        const today = getWibToday();
        let newOverdueCount = 0;
        let reactivatedCount = 0;

        // ACTIVE contracts yang seharusnya OVERDUE dengan grace period baru
        const activeContracts = await this.contractRepo.findByStatus(ContractStatus.ACTIVE);
        for (const contract of activeContracts) {
          const graceEnd = new Date(contract.endDate);
          graceEnd.setDate(graceEnd.getDate() + days);
          if (graceEnd < today) {
            await this.contractRepo.update(contract.id, { status: ContractStatus.OVERDUE });
            newOverdueCount++;
          }
        }

        // OVERDUE contracts yang seharusnya kembali ACTIVE dengan grace period baru
        const overdueContracts = await this.contractRepo.findByStatus(ContractStatus.OVERDUE);
        for (const contract of overdueContracts) {
          const graceEnd = new Date(contract.endDate);
          graceEnd.setDate(graceEnd.getDate() + days);
          if (graceEnd >= today) {
            await this.contractRepo.update(contract.id, { status: ContractStatus.ACTIVE });
            reactivatedCount++;
          }
        }

        await this.auditRepo.create({
          id: uuidv4(),
          userId: adminId,
          action: AuditAction.UPDATE,
          module: 'contract',
          entityId: 'bulk',
          description: `Synced grace period to ${days} days for ${updatedCount} contracts (${newOverdueCount} → OVERDUE, ${reactivatedCount} → ACTIVE)`,
          metadata: {
            gracePeriodDays: days,
            contractsUpdated: updatedCount,
            newOverdueCount,
            reactivatedCount,
          },
          ipAddress: '',
          createdAt: new Date(),
        });
      }
    }

    return result;
  }

  async seedDefaults(): Promise<void> {
    const defaults: Array<{ key: string; value: string; description: string }> = [
      { key: 'company_name', value: 'WEDISON', description: 'Company name' },
      { key: 'company_address', value: 'Jakarta, Indonesia', description: 'Company address' },
      { key: 'company_phone', value: '+62-xxx-xxxx', description: 'Company phone' },
      { key: 'invoice_prefix', value: 'INV', description: 'Invoice number prefix' },
      { key: 'contract_prefix', value: 'RTO', description: 'Contract number prefix' },
      {
        key: 'max_rental_days',
        value: '7',
        description: 'Maximum rental days per contract/extension',
      },
      {
        key: 'ownership_target_days',
        value: '1278',
        description: 'Total days to own motor (default ~3.5 years)',
      },
      {
        key: 'grace_period_days',
        value: '7',
        description: 'Masa tenggang (hari) setelah endDate sebelum status OVERDUE',
      },
      {
        key: 'penalty_grace_days',
        value: '2',
        description: 'Toleransi (hari) sebelum denda keterlambatan berlaku',
      },
      { key: 'late_fee_per_day', value: '20000', description: 'Denda keterlambatan per hari (Rp)' },
    ];

    for (const d of defaults) {
      const existing = await this.settingRepo.findByKey(d.key);
      if (!existing) {
        await this.settingRepo.upsert({
          id: uuidv4(),
          key: d.key,
          value: d.value,
          description: d.description,
          updatedAt: new Date(),
        });
      }
    }

    // Migrasi: update setting lama yang belum pernah dikustomisasi admin
    await this.migrateSettings();
  }

  /**
   * Migrasi setting yang default-nya berubah antar versi.
   * Hanya update jika nilai di DB masih sama dengan nilai lama (belum dikustomisasi admin).
   */
  private async migrateSettings(): Promise<void> {
    const migrations: Array<{
      key: string;
      fromValue: string;
      toValue: string;
      description: string;
    }> = [
      {
        key: 'late_fee_per_day',
        fromValue: '10000',
        toValue: '20000',
        description: 'Denda keterlambatan per hari (Rp)',
      },
      {
        key: 'grace_period_days',
        fromValue: '2',
        toValue: '7',
        description: 'Masa tenggang (hari) setelah endDate sebelum status OVERDUE',
      },
    ];

    for (const m of migrations) {
      const existing = await this.settingRepo.findByKey(m.key);
      if (existing && existing.value === m.fromValue) {
        await this.settingRepo.upsert({
          ...existing,
          value: m.toValue,
          description: m.description,
          updatedAt: new Date(),
        });
      }
    }
  }
}
