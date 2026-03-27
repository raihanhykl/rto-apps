import { PrismaClient } from '@prisma/client';
import {
  IRefreshTokenRepository,
  RefreshTokenRecord,
} from '../../domain/interfaces/IRefreshTokenRepository';

export class PrismaRefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    token: string;
    userId: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord> {
    return this.prisma.refreshToken.create({
      data: {
        token: data.token,
        userId: data.userId,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findByToken(token: string): Promise<RefreshTokenRecord | null> {
    return this.prisma.refreshToken.findUnique({
      where: { token },
    });
  }

  async deleteByToken(token: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { token },
    });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }
}
