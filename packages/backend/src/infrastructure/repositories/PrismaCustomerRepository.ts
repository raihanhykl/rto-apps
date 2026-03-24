import { PrismaClient, Prisma } from '@prisma/client';
import { Customer } from '../../domain/entities';
import { ICustomerRepository } from '../../domain/interfaces';
import { PaginationParams, PaginatedResult } from '../../domain/interfaces/Pagination';

export class PrismaCustomerRepository implements ICustomerRepository {
  constructor(private prisma: PrismaClient) {}

  private toEntity(raw: any): Customer {
    return raw as Customer;
  }

  async findAll(): Promise<Customer[]> {
    const rows = await this.prisma.customer.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findAllPaginated(params: PaginationParams): Promise<PaginatedResult<Customer>> {
    const where: Prisma.CustomerWhereInput = { isDeleted: false };

    if (params.search) {
      where.OR = [
        { fullName: { contains: params.search, mode: 'insensitive' } },
        { phone: { contains: params.search } },
        { email: { contains: params.search, mode: 'insensitive' } },
        { ktpNumber: { contains: params.search } },
      ];
    }
    if (params.gender && params.gender !== 'ALL') {
      where.gender = params.gender as any;
    }

    const page = params.page || 1;
    const limit = params.limit || 20;
    const sortBy = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder || 'desc';

    const [rows, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data: rows.map((r) => this.toEntity(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<Customer | null> {
    const row = await this.prisma.customer.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findByKtpNumber(ktpNumber: string): Promise<Customer | null> {
    const row = await this.prisma.customer.findFirst({
      where: { ktpNumber, isDeleted: false },
    });
    return row ? this.toEntity(row) : null;
  }

  async search(query: string): Promise<Customer[]> {
    const rows = await this.prisma.customer.findMany({
      where: {
        isDeleted: false,
        OR: [
          { fullName: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
          { email: { contains: query, mode: 'insensitive' } },
          { ktpNumber: { contains: query } },
        ],
      },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async create(customer: Customer): Promise<Customer> {
    const row = await this.prisma.customer.create({
      data: {
        id: customer.id,
        fullName: customer.fullName,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        birthDate: customer.birthDate,
        gender: customer.gender,
        rideHailingApps: customer.rideHailingApps,
        ktpNumber: customer.ktpNumber,
        ktpPhoto: customer.ktpPhoto,
        simPhoto: customer.simPhoto,
        kkPhoto: customer.kkPhoto,
        guarantorName: customer.guarantorName,
        guarantorPhone: customer.guarantorPhone,
        guarantorKtpPhoto: customer.guarantorKtpPhoto,
        spouseName: customer.spouseName,
        spouseKtpPhoto: customer.spouseKtpPhoto,
        notes: customer.notes,
        isDeleted: customer.isDeleted,
        deletedAt: customer.deletedAt,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      },
    });
    return this.toEntity(row);
  }

  async update(id: string, data: Partial<Customer>): Promise<Customer | null> {
    try {
      const { id: _id, ...updateData } = data as any;
      const row = await this.prisma.customer.update({
        where: { id },
        data: updateData,
      });
      return this.toEntity(row);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.customer.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async count(): Promise<number> {
    return this.prisma.customer.count({ where: { isDeleted: false } });
  }
}
