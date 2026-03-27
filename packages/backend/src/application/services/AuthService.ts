import { IUserRepository } from '../../domain/interfaces';
import { IAuditLogRepository } from '../../domain/interfaces';
import { IRefreshTokenRepository } from '../../domain/interfaces';
import { User } from '../../domain/entities';
import { AuditAction, UserRole } from '../../domain/enums';
import { LoginDto } from '../dtos';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export class AuthService {
  constructor(
    private userRepo: IUserRepository,
    private auditRepo: IAuditLogRepository,
    private jwtSecret: string = 'dev-secret-change-in-production',
    private jwtExpiresIn: string = '15m',
    private refreshTokenRepo?: IRefreshTokenRepository,
    private jwtRefreshExpiresIn: string = '7d',
  ) {}

  async login(
    dto: LoginDto,
  ): Promise<{ token: string; refreshToken?: string; user: Omit<User, 'password'> }> {
    const user = await this.userRepo.findByUsername(dto.username);
    if (!user) throw new Error('Invalid credentials');
    if (!user.isActive) throw new Error('Account is deactivated');

    if (!(await bcrypt.compare(dto.password, user.password))) {
      throw new Error('Invalid credentials');
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    });

    let refreshToken: string | undefined;
    if (this.refreshTokenRepo) {
      refreshToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.parseRefreshExpiresDays());
      await this.refreshTokenRepo.create({
        token: refreshToken,
        userId: user.id,
        expiresAt,
      });
    }

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
    return { token, refreshToken, user: userWithoutPassword };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    if (!this.refreshTokenRepo) {
      throw new Error('Refresh token not supported');
    }

    const record = await this.refreshTokenRepo.findByToken(refreshToken);
    if (!record) {
      throw new Error('Invalid refresh token');
    }

    if (record.expiresAt < new Date()) {
      await this.refreshTokenRepo.deleteByToken(refreshToken);
      throw new Error('Refresh token expired');
    }

    // Delete old token
    await this.refreshTokenRepo.deleteByToken(refreshToken);

    // Verify user still exists and is active
    const user = await this.userRepo.findById(record.userId);
    if (!user || !user.isActive) {
      throw new Error('User not found or deactivated');
    }

    // Generate new access token
    const accessToken = jwt.sign({ userId: user.id, role: user.role }, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    });

    // Generate new refresh token (rotation)
    const newRefreshToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.parseRefreshExpiresDays());
    await this.refreshTokenRepo.create({
      token: newRefreshToken,
      userId: user.id,
      expiresAt,
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async validateToken(token: string): Promise<User | null> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as { userId: string; role: string };
      return this.userRepo.findById(payload.userId);
    } catch {
      return null;
    }
  }

  async logout(token: string, userId: string): Promise<void> {
    // Delete all refresh tokens for this user
    if (this.refreshTokenRepo) {
      await this.refreshTokenRepo.deleteByUserId(userId);
    }

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
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const existing = await this.userRepo.findByUsername('admin');
    if (!existing) {
      await this.userRepo.create({
        id: uuidv4(),
        username: 'admin',
        password: hashedPassword,
        fullName: 'Super Admin',
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else if (!existing.password.startsWith('$2')) {
      // Password masih plaintext — hash ulang
      await this.userRepo.update(existing.id, { password: hashedPassword });
    }
  }

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }

  private parseRefreshExpiresDays(): number {
    const match = this.jwtRefreshExpiresIn.match(/^(\d+)d$/);
    if (match) return parseInt(match[1], 10);
    return 7; // default 7 days
  }
}
