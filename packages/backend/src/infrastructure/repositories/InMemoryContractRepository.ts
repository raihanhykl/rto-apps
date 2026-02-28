import { Contract } from '../../domain/entities';
import { IContractRepository } from '../../domain/interfaces';
import { ContractStatus } from '../../domain/enums';

export class InMemoryContractRepository implements IContractRepository {
  private contracts: Map<string, Contract> = new Map();

  async findAll(): Promise<Contract[]> {
    return Array.from(this.contracts.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async findById(id: string): Promise<Contract | null> {
    return this.contracts.get(id) || null;
  }

  async findByCustomerId(customerId: string): Promise<Contract[]> {
    return Array.from(this.contracts.values()).filter(c => c.customerId === customerId);
  }

  async findByStatus(status: ContractStatus): Promise<Contract[]> {
    return Array.from(this.contracts.values()).filter(c => c.status === status);
  }

  async create(contract: Contract): Promise<Contract> {
    this.contracts.set(contract.id, { ...contract });
    return { ...contract };
  }

  async update(id: string, data: Partial<Contract>): Promise<Contract | null> {
    const existing = this.contracts.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.contracts.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    return this.contracts.delete(id);
  }

  async count(): Promise<number> {
    return this.contracts.size;
  }

  async countByStatus(status: ContractStatus): Promise<number> {
    return Array.from(this.contracts.values()).filter(c => c.status === status).length;
  }
}
