import { z } from 'zod';
import { MotorModel, ContractStatus, PaymentStatus } from '../../domain/enums';

// Auth DTOs
export const LoginDto = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginDto = z.infer<typeof LoginDto>;

// Customer DTOs
export const CreateCustomerDto = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email('Invalid email').optional().default(''),
  address: z.string().min(1, 'Address is required'),
  ktpNumber: z.string().min(16, 'KTP must be 16 digits').max(16, 'KTP must be 16 digits'),
  notes: z.string().optional().default(''),
});
export type CreateCustomerDto = z.infer<typeof CreateCustomerDto>;

export const UpdateCustomerDto = CreateCustomerDto.partial();
export type UpdateCustomerDto = z.infer<typeof UpdateCustomerDto>;

// Contract DTOs
export const CreateContractDto = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  motorModel: z.nativeEnum(MotorModel),
  durationDays: z.number().int().min(1).max(7, 'Maximum 7 days'),
  startDate: z.string().min(1, 'Start date is required'),
  notes: z.string().optional().default(''),
});
export type CreateContractDto = z.infer<typeof CreateContractDto>;

export const UpdateContractStatusDto = z.object({
  status: z.nativeEnum(ContractStatus),
});
export type UpdateContractStatusDto = z.infer<typeof UpdateContractStatusDto>;

// Payment DTOs
export const SimulatePaymentDto = z.object({
  invoiceId: z.string().min(1, 'Invoice is required'),
  status: z.enum([PaymentStatus.PAID, PaymentStatus.FAILED]),
});
export type SimulatePaymentDto = z.infer<typeof SimulatePaymentDto>;

// Setting DTOs
export const UpdateSettingDto = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
  description: z.string().optional().default(''),
});
export type UpdateSettingDto = z.infer<typeof UpdateSettingDto>;
