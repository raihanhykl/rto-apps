import { ISettingRepository, IAuditLogRepository } from '../../domain/interfaces';
import { Setting } from '../../domain/entities';
import { AuditAction } from '../../domain/enums';
import { UpdateSettingDto } from '../dtos';
import { v4 as uuidv4 } from 'uuid';

export class SettingService {
  constructor(
    private settingRepo: ISettingRepository,
    private auditRepo: IAuditLogRepository
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

    return result;
  }

  async seedDefaults(): Promise<void> {
    const defaults: Array<{ key: string; value: string; description: string }> = [
      { key: 'company_name', value: 'WEDISON', description: 'Company name' },
      { key: 'company_address', value: 'Jakarta, Indonesia', description: 'Company address' },
      { key: 'company_phone', value: '+62-xxx-xxxx', description: 'Company phone' },
      { key: 'invoice_prefix', value: 'INV', description: 'Invoice number prefix' },
      { key: 'contract_prefix', value: 'RTO', description: 'Contract number prefix' },
      { key: 'max_rental_days', value: '7', description: 'Maximum rental days per contract/extension' },
      { key: 'ownership_target_days', value: '1825', description: 'Total days to own motor (default 5 years)' },
      { key: 'grace_period_days', value: '7', description: 'Grace period days before repossession' },
      { key: 'late_fee_per_day', value: '10000', description: 'Late fee per day (Rp) for overdue invoices' },
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
  }
}
