import {
  IRefreshTokenRepository,
  RefreshTokenRecord,
} from '../../domain/interfaces/IRefreshTokenRepository';
import { v4 as uuidv4 } from 'uuid';

export class InMemoryRefreshTokenRepository implements IRefreshTokenRepository {
  private tokens = new Map<string, RefreshTokenRecord>();

  async create(data: {
    token: string;
    userId: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord> {
    const record: RefreshTokenRecord = {
      id: uuidv4(),
      token: data.token,
      userId: data.userId,
      expiresAt: data.expiresAt,
      createdAt: new Date(),
    };
    this.tokens.set(record.token, record);
    return record;
  }

  async findByToken(token: string): Promise<RefreshTokenRecord | null> {
    return this.tokens.get(token) ?? null;
  }

  async deleteByToken(token: string): Promise<void> {
    this.tokens.delete(token);
  }

  async deleteByUserId(userId: string): Promise<void> {
    for (const [key, record] of this.tokens) {
      if (record.userId === userId) {
        this.tokens.delete(key);
      }
    }
  }
}
