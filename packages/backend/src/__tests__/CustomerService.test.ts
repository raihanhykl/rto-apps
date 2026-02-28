import { CustomerService } from '../application/services/CustomerService';
import { InMemoryCustomerRepository } from '../infrastructure/repositories/InMemoryCustomerRepository';
import { InMemoryAuditLogRepository } from '../infrastructure/repositories/InMemoryAuditLogRepository';

describe('CustomerService', () => {
  let customerService: CustomerService;
  let customerRepo: InMemoryCustomerRepository;
  let auditRepo: InMemoryAuditLogRepository;
  const adminId = 'admin-1';

  const sampleCustomer = {
    fullName: 'Budi Santoso',
    phone: '081234567890',
    email: 'budi@example.com',
    address: 'Jl. Merdeka No. 10, Jakarta',
    ktpNumber: '3201011234567890',
    notes: '',
  };

  beforeEach(() => {
    customerRepo = new InMemoryCustomerRepository();
    auditRepo = new InMemoryAuditLogRepository();
    customerService = new CustomerService(customerRepo, auditRepo);
  });

  describe('create', () => {
    it('should create a customer', async () => {
      const customer = await customerService.create(sampleCustomer, adminId);
      expect(customer.id).toBeDefined();
      expect(customer.fullName).toBe('Budi Santoso');
      expect(customer.ktpNumber).toBe('3201011234567890');
    });

    it('should reject duplicate KTP number', async () => {
      await customerService.create(sampleCustomer, adminId);
      await expect(
        customerService.create(sampleCustomer, adminId)
      ).rejects.toThrow('Customer with this KTP already exists');
    });

    it('should create audit log on create', async () => {
      await customerService.create(sampleCustomer, adminId);
      const logs = await auditRepo.findAll();
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('CREATE');
      expect(logs[0].module).toBe('customer');
    });
  });

  describe('getAll', () => {
    it('should return all customers', async () => {
      await customerService.create(sampleCustomer, adminId);
      await customerService.create(
        { ...sampleCustomer, fullName: 'Siti Rahayu', ktpNumber: '3201019876543210', phone: '081299999999' },
        adminId
      );
      const all = await customerService.getAll();
      expect(all.length).toBe(2);
    });
  });

  describe('getById', () => {
    it('should return customer by id', async () => {
      const created = await customerService.create(sampleCustomer, adminId);
      const found = await customerService.getById(created.id);
      expect(found.fullName).toBe('Budi Santoso');
    });

    it('should throw if customer not found', async () => {
      await expect(customerService.getById('non-existent')).rejects.toThrow('Customer not found');
    });
  });

  describe('update', () => {
    it('should update customer fields', async () => {
      const created = await customerService.create(sampleCustomer, adminId);
      const updated = await customerService.update(created.id, { fullName: 'Budi Updated' }, adminId);
      expect(updated.fullName).toBe('Budi Updated');
    });

    it('should reject duplicate KTP on update', async () => {
      const c1 = await customerService.create(sampleCustomer, adminId);
      await customerService.create(
        { ...sampleCustomer, fullName: 'Siti', ktpNumber: '9999999999999999', phone: '081200000000' },
        adminId
      );
      await expect(
        customerService.update(c1.id, { ktpNumber: '9999999999999999' }, adminId)
      ).rejects.toThrow('Customer with this KTP already exists');
    });

    it('should throw if customer not found', async () => {
      await expect(
        customerService.update('non-existent', { fullName: 'Test' }, adminId)
      ).rejects.toThrow('Customer not found');
    });
  });

  describe('delete', () => {
    it('should delete customer', async () => {
      const created = await customerService.create(sampleCustomer, adminId);
      await customerService.delete(created.id, adminId);
      const count = await customerService.count();
      expect(count).toBe(0);
    });

    it('should throw if customer not found', async () => {
      await expect(customerService.delete('non-existent', adminId)).rejects.toThrow('Customer not found');
    });
  });

  describe('search', () => {
    it('should search by name', async () => {
      await customerService.create(sampleCustomer, adminId);
      const results = await customerService.search('budi');
      expect(results.length).toBe(1);
    });

    it('should search by phone', async () => {
      await customerService.create(sampleCustomer, adminId);
      const results = await customerService.search('081234');
      expect(results.length).toBe(1);
    });

    it('should return empty for no match', async () => {
      await customerService.create(sampleCustomer, adminId);
      const results = await customerService.search('zzzzz');
      expect(results.length).toBe(0);
    });
  });
});
