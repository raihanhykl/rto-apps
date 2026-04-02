import { AuthService } from '../application/services/AuthService';
import { InMemoryUserRepository } from '../infrastructure/repositories/InMemoryUserRepository';
import { InMemoryAuditLogRepository } from '../infrastructure/repositories/InMemoryAuditLogRepository';
import { InMemoryRefreshTokenRepository } from '../infrastructure/repositories/InMemoryRefreshTokenRepository';
import { UserRole } from '../domain/enums';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const TEST_JWT_SECRET = 'test-secret';
const TEST_JWT_EXPIRES_IN = '15m';

describe('AuthService', () => {
  let authService: AuthService;
  let userRepo: InMemoryUserRepository;
  let auditRepo: InMemoryAuditLogRepository;
  let refreshTokenRepo: InMemoryRefreshTokenRepository;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    auditRepo = new InMemoryAuditLogRepository();
    refreshTokenRepo = new InMemoryRefreshTokenRepository();
    authService = new AuthService(
      userRepo,
      auditRepo,
      TEST_JWT_SECRET,
      TEST_JWT_EXPIRES_IN,
      refreshTokenRepo,
      '7d',
    );
  });

  describe('seedDefaultAdmin', () => {
    it('should create default admin user', async () => {
      await authService.seedDefaultAdmin();
      const admin = await userRepo.findByUsername('admin');
      expect(admin).not.toBeNull();
      expect(admin!.username).toBe('admin');
      expect(await bcrypt.compare('admin123', admin!.password)).toBe(true);
      expect(admin!.role).toBe(UserRole.SUPER_ADMIN);
    });

    it('should not create duplicate admin', async () => {
      await authService.seedDefaultAdmin();
      await authService.seedDefaultAdmin();
      const users = await userRepo.findAll();
      expect(users.length).toBe(1);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await authService.seedDefaultAdmin();
    });

    it('should login with valid credentials and return JWT token + refresh token', async () => {
      const result = await authService.login({ username: 'admin', password: 'admin123' });
      expect(result.token).toBeDefined();
      // JWT tokens have 3 dot-separated segments
      expect(result.token.split('.').length).toBe(3);
      expect(result.refreshToken).toBeDefined();
      expect(typeof result.refreshToken).toBe('string');
      expect(result.user.username).toBe('admin');
      expect((result.user as any).password).toBeUndefined();
    });

    it('should return JWT with correct payload', async () => {
      const result = await authService.login({ username: 'admin', password: 'admin123' });
      const payload = jwt.verify(result.token, TEST_JWT_SECRET) as {
        userId: string;
        role: string;
      };
      expect(payload.userId).toBeDefined();
      expect(payload.role).toBe(UserRole.SUPER_ADMIN);
    });

    it('should store refresh token in repository', async () => {
      const result = await authService.login({ username: 'admin', password: 'admin123' });
      const stored = await refreshTokenRepo.findByToken(result.refreshToken!);
      expect(stored).not.toBeNull();
      expect(stored!.userId).toBeDefined();
      expect(stored!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should throw on invalid username', async () => {
      await expect(authService.login({ username: 'wrong', password: 'admin123' })).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw on invalid password', async () => {
      await expect(authService.login({ username: 'admin', password: 'wrong' })).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw if account is deactivated', async () => {
      const admin = await userRepo.findByUsername('admin');
      await userRepo.update(admin!.id, { isActive: false });

      await expect(authService.login({ username: 'admin', password: 'admin123' })).rejects.toThrow(
        'Account is deactivated',
      );
    });

    it('should create audit log on login', async () => {
      await authService.login({ username: 'admin', password: 'admin123' });
      const logs = await auditRepo.findAll();
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('LOGIN');
    });
  });

  describe('refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      await authService.seedDefaultAdmin();
      const result = await authService.login({ username: 'admin', password: 'admin123' });
      refreshToken = result.refreshToken!;
    });

    it('should return new access and refresh tokens', async () => {
      const result = await authService.refresh(refreshToken);
      expect(result.accessToken).toBeDefined();
      expect(result.accessToken.split('.').length).toBe(3);
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe(refreshToken); // rotation
    });

    it('should invalidate old refresh token after use', async () => {
      await authService.refresh(refreshToken);
      // Old token should be deleted
      await expect(authService.refresh(refreshToken)).rejects.toThrow('Invalid refresh token');
    });

    it('should throw on invalid refresh token', async () => {
      await expect(authService.refresh('non-existent-token')).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('should throw on expired refresh token', async () => {
      // Manually create an expired token record
      const record = await refreshTokenRepo.findByToken(refreshToken);
      // Delete and recreate with past expiry
      await refreshTokenRepo.deleteByToken(refreshToken);
      await refreshTokenRepo.create({
        token: 'expired-token',
        userId: record!.userId,
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
      });

      await expect(authService.refresh('expired-token')).rejects.toThrow('Refresh token expired');
    });

    it('should throw if user is deactivated during refresh', async () => {
      const admin = await userRepo.findByUsername('admin');
      await userRepo.update(admin!.id, { isActive: false });

      await expect(authService.refresh(refreshToken)).rejects.toThrow(
        'User not found or deactivated',
      );
    });

    it('should return valid JWT in new access token', async () => {
      const result = await authService.refresh(refreshToken);
      const payload = jwt.verify(result.accessToken, TEST_JWT_SECRET) as {
        userId: string;
        role: string;
      };
      expect(payload.userId).toBeDefined();
      expect(payload.role).toBe(UserRole.SUPER_ADMIN);
    });
  });

  describe('validateToken', () => {
    it('should validate a valid JWT token', async () => {
      await authService.seedDefaultAdmin();
      const { token } = await authService.login({ username: 'admin', password: 'admin123' });
      const user = await authService.validateToken(token);
      expect(user).not.toBeNull();
      expect(user!.username).toBe('admin');
    });

    it('should return null for invalid token', async () => {
      const user = await authService.validateToken('invalid-token');
      expect(user).toBeNull();
    });

    it('should return null for token signed with wrong secret', async () => {
      await authService.seedDefaultAdmin();
      const admin = await userRepo.findByUsername('admin');
      const fakeToken = jwt.sign({ userId: admin!.id, role: admin!.role }, 'wrong-secret', {
        expiresIn: '15m',
      });
      const user = await authService.validateToken(fakeToken);
      expect(user).toBeNull();
    });

    it('should return null for expired token', async () => {
      await authService.seedDefaultAdmin();
      const admin = await userRepo.findByUsername('admin');
      // Create a token that expired 1 hour ago
      const _expiredToken = jwt.sign(
        { userId: admin!.id, role: admin!.role, iat: Math.floor(Date.now() / 1000) - 7200 },
        TEST_JWT_SECRET,
        { expiresIn: '1h' },
      );
      // This token was issued 2h ago with 1h expiry, so it's expired
      // Actually we need to manually set exp in the past
      const reallyExpiredToken = jwt.sign(
        {
          userId: admin!.id,
          role: admin!.role,
          exp: Math.floor(Date.now() / 1000) - 60,
        },
        TEST_JWT_SECRET,
      );
      const user = await authService.validateToken(reallyExpiredToken);
      expect(user).toBeNull();
    });
  });

  describe('logout', () => {
    it('should create audit log on logout', async () => {
      await authService.seedDefaultAdmin();
      const { token, user } = await authService.login({ username: 'admin', password: 'admin123' });
      await authService.logout(token, user.id);

      const logs = await auditRepo.findAll();
      expect(logs.length).toBe(2); // login + logout
      const actions = logs.map((l) => l.action);
      expect(actions).toContain('LOGIN');
      expect(actions).toContain('LOGOUT');
    });

    it('should delete all refresh tokens for user on logout', async () => {
      await authService.seedDefaultAdmin();
      const { token, refreshToken, user } = await authService.login({
        username: 'admin',
        password: 'admin123',
      });

      // Verify token exists before logout
      const before = await refreshTokenRepo.findByToken(refreshToken!);
      expect(before).not.toBeNull();

      await authService.logout(token, user.id);

      // Verify token is deleted after logout
      const after = await refreshTokenRepo.findByToken(refreshToken!);
      expect(after).toBeNull();
    });

    it('should not throw on logout', async () => {
      await authService.seedDefaultAdmin();
      const { token, user } = await authService.login({ username: 'admin', password: 'admin123' });
      await expect(authService.logout(token, user.id)).resolves.not.toThrow();
    });
  });
});
