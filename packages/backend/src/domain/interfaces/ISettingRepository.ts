import { Setting } from '../entities';

export interface ISettingRepository {
  findAll(): Promise<Setting[]>;
  findByKey(key: string): Promise<Setting | null>;
  upsert(setting: Setting): Promise<Setting>;
  delete(key: string): Promise<boolean>;
}
