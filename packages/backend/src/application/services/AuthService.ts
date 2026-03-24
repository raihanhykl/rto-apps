import { IUserRepository } from '../../domain/interfaces';
import { IAuditLogRepository } from '../../domain/interfaces';
import { User } from '../../domain/entities';
import { AuditAction, UserRole } from '../../domain/enums';
import { LoginDto } from '../dtos';
import { v4 as uuidv4 } from 'uuid';

// Simple token store (in production, use JWT)
const tokenStore = new Map<string, { userId: string; expiresAt: Date }>();

export class AuthService {
  constructor(
    private userRepo: IUserRepository,
    private auditRepo: IAuditLogRepository,
  ) {}

  async login(dto: LoginDto): Promise<{ token: string; user: Omit<User, 'password'> }> {
    const user = await this.userRepo.findByUsername(dto.username);
    if (!user) throw new Error('Invalid credentials');
    if (!user.isActive) throw new Error('Account is deactivated');

    // Simple password check (in production, use bcrypt)
    if (user.password !== dto.password) {
      throw new Error('Invalid credentials');
    }

    const token = uuidv4();
    tokenStore.set(token, {
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    await this.auditRepo.create({
      id: uuidv4(),
      userId: user.id,
      action: AuditAction.LOGIN,
      module: 'auth',
      entityId: user.id,
      description: `Admin ${user.fullName} logged in`,
      metadata: {},
      ipAddress: '',
      createdAt: new Date(),
    });

    const { password: _, ...userWithoutPassword } = user;
    return { token, user: userWithoutPassword };
  }

  async validateToken(token: string): Promise<User | null> {
    const session = tokenStore.get(token);
    if (!session) return null;
    if (session.expiresAt < new Date()) {
      tokenStore.delete(token);
      return null;
    }
    return this.userRepo.findById(session.userId);
  }

  async logout(token: string, userId: string): Promise<void> {
    tokenStore.delete(token);
    await this.auditRepo.create({
      id: uuidv4(),
      userId,
      action: AuditAction.LOGOUT,
      module: 'auth',
      entityId: userId,
      description: 'Admin logged out',
      metadata: {},
      ipAddress: '',
      createdAt: new Date(),
    });
  }

  async seedDefaultAdmin(): Promise<void> {
    const existing = await this.userRepo.findByUsername('admin');
    if (!existing) {
      await this.userRepo.create({
        id: uuidv4(),
        username: 'admin',
        password: 'admin123', // In production, hash this
        fullName: 'Super Admin',
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }
}
