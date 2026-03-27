import { PrismaClient } from '@prisma/client';
import { Setting } from '../../domain/entities';
import { ISettingRepository } from '../../domain/interfaces';

export class PrismaSettingRepository implements ISettingRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(): Promise<Setting[]> {
    return this.prisma.setting.findMany();
  }

  async findByKey(key: string): Promise<Setting | null> {
    return this.prisma.setting.findUnique({ where: { key } });
  }

  async upsert(setting: Setting): Promise<Setting> {
    return this.prisma.setting.upsert({
      where: { key: setting.key },
      create: {
        id: setting.id,
        key: setting.key,
        value: setting.value,
        description: setting.description,
      },
      update: {
        value: setting.value,
        description: setting.description,
      },
    });
  }

  async delete(key: string): Promise<boolean> {
    try {
      await this.prisma.setting.delete({ where: { key } });
      return true;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as Record<string, unknown>).code === 'P2025'
      ) {
        return false;
      }
      throw error;
    }
  }
}
