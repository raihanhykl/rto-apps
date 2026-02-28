import { Setting } from '../../domain/entities';
import { ISettingRepository } from '../../domain/interfaces';

export class InMemorySettingRepository implements ISettingRepository {
  private settings: Map<string, Setting> = new Map();

  async findAll(): Promise<Setting[]> {
    return Array.from(this.settings.values());
  }

  async findByKey(key: string): Promise<Setting | null> {
    return this.settings.get(key) || null;
  }

  async upsert(setting: Setting): Promise<Setting> {
    this.settings.set(setting.key, { ...setting });
    return { ...setting };
  }

  async delete(key: string): Promise<boolean> {
    return this.settings.delete(key);
  }
}
