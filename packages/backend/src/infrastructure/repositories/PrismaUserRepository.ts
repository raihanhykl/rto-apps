import { PrismaClient, Prisma } from '@prisma/client';
import { User } from '../../domain/entities';
import { IUserRepository } from '../../domain/interfaces';

type PrismaUser = Prisma.UserGetPayload<object>;

export class PrismaUserRepository implements IUserRepository {
  constructor(private prisma: PrismaClient) {}

  private toEntity(raw: PrismaUser): User {
    return raw as User;
  }

  async findAll(): Promise<User[]> {
    const rows = await this.prisma.user.findMany();
    return rows.map((r) => this.toEntity(r));
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { username } });
    return row ? this.toEntity(row) : null;
  }

  async create(user: User): Promise<User> {
    const row = await this.prisma.user.create({
      data: {
        id: user.id,
        username: user.username,
        password: user.password,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
    return this.toEntity(row);
  }

  async update(id: string, data: Partial<User>): Promise<User | null> {
    try {
      const { id: _id, ...updateData } = data;
      const row = await this.prisma.user.update({
        where: { id },
        data: updateData,
      });
      return this.toEntity(row);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as Record<string, unknown>).code === 'P2025'
      ) {
        return null;
      }
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.user.delete({ where: { id } });
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
