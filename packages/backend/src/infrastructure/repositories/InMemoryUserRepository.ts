import { User } from '../../domain/entities';
import { IUserRepository } from '../../domain/interfaces';

export class InMemoryUserRepository implements IUserRepository {
  private users: Map<string, User> = new Map();

  async findAll(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findByUsername(username: string): Promise<User | null> {
    return Array.from(this.users.values()).find(u => u.username === username) || null;
  }

  async create(user: User): Promise<User> {
    this.users.set(user.id, { ...user });
    return { ...user };
  }

  async update(id: string, data: Partial<User>): Promise<User | null> {
    const existing = this.users.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.users.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    return this.users.delete(id);
  }
}
