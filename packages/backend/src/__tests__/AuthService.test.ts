import { AuthService } from '../application/services/AuthService';
import { InMemoryUserRepository } from '../infrastructure/repositories/InMemoryUserRepository';
import { InMemoryAuditLogRepository } from '../infrastructure/repositories/InMemoryAuditLogRepository';
import { UserRole } from '../domain/enums';

describe('AuthService', () => {
  let authService: AuthService;
  let userRepo: InMemoryUserRepository;
  let auditRepo: InMemoryAuditLogRepository;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    auditRepo = new InMemoryAuditLogRepository();
    authService = new AuthService(userRepo, auditRepo);
  });

  describe('seedDefaultAdmin', () => {
    it('should create default admin user', async () => {
      await authService.seedDefaultAdmin();
      const admin = await userRepo.findByUsername('admin');
      expect(admin).not.toBeNull();
      expect(admin!.username).toBe('admin');
      expect(admin!.password).toBe('admin123');
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

    it('should login with valid credentials', async () => {
      const result = await authService.login({ username: 'admin', password: 'admin123' });
      expect(result.token).toBeDefined();
      expect(result.user.username).toBe('admin');
      expect((result.user as any).password).toBeUndefined();
    });

    it('should throw on invalid username', async () => {
      await expect(
        authService.login({ username: 'wrong', password: 'admin123' })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw on invalid password', async () => {
      await expect(
        authService.login({ username: 'admin', password: 'wrong' })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw if account is deactivated', async () => {
      const admin = await userRepo.findByUsername('admin');
      await userRepo.update(admin!.id, { isActive: false });

      await expect(
        authService.login({ username: 'admin', password: 'admin123' })
      ).rejects.toThrow('Account is deactivated');
    });

    it('should create audit log on login', async () => {
      await authService.login({ username: 'admin', password: 'admin123' });
      const logs = await auditRepo.findAll();
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('LOGIN');
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token', async () => {
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
  });

  describe('logout', () => {
    it('should invalidate token after logout', async () => {
      await authService.seedDefaultAdmin();
      const { token, user } = await authService.login({ username: 'admin', password: 'admin123' });

      await authService.logout(token, user.id);

      const validatedUser = await authService.validateToken(token);
      expect(validatedUser).toBeNull();
    });

    it('should create audit log on logout', async () => {
      await authService.seedDefaultAdmin();
      const { token, user } = await authService.login({ username: 'admin', password: 'admin123' });
      await authService.logout(token, user.id);

      const logs = await auditRepo.findAll();
      expect(logs.length).toBe(2); // login + logout
      const actions = logs.map(l => l.action);
      expect(actions).toContain('LOGIN');
      expect(actions).toContain('LOGOUT');
    });
  });
});
