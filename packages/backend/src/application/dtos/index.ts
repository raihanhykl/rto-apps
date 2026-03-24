import { z } from 'zod';
import {
  MotorModel,
  BatteryType,
  DPScheme,
  ContractStatus,
  PaymentStatus,
  Gender,
  HolidayScheme,
} from '../../domain/enums';

// Auth DTOs
export const LoginDto = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginDto = z.infer<typeof LoginDto>;

// Customer DTOs
export const CreateCustomerDto = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  phone: z
    .string()
    .regex(
      /^(\+62|62|0)8[0-9]{8,12}$/,
      'Format nomor telepon tidak valid (contoh: 08xxx atau +628xxx)',
    ),
  email: z.string().email('Invalid email').optional().default(''),
  address: z.string().min(1, 'Address is required'),
  birthDate: z.string().optional().nullable().default(null),
  gender: z.nativeEnum(Gender).optional().nullable().default(null),
  rideHailingApps: z.array(z.string()).optional().default([]),
  ktpNumber: z.string().regex(/^\d{16}$/, 'KTP harus 16 digit angka'),
  // Document photos (paths/URLs)
  ktpPhoto: z.string().optional().nullable().default(null),
  simPhoto: z.string().optional().nullable().default(null),
  kkPhoto: z.string().optional().nullable().default(null),
  // Guarantor
  guarantorName: z.string().optional().default(''),
  guarantorPhone: z.string().optional().default(''),
  guarantorKtpPhoto: z.string().optional().nullable().default(null),
  // Spouse (optional)
  spouseName: z.string().optional().default(''),
  spouseKtpPhoto: z.string().optional().nullable().default(null),
  notes: z.string().optional().default(''),
});
export type CreateCustomerDto = z.infer<typeof CreateCustomerDto>;

export const UpdateCustomerDto = CreateCustomerDto.partial();
export type UpdateCustomerDto = z.infer<typeof UpdateCustomerDto>;

// Contract DTOs
export const CreateContractDto = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  motorModel: z.nativeEnum(MotorModel),
  batteryType: z.nativeEnum(BatteryType),
  dpScheme: z.nativeEnum(DPScheme),
  startDate: z.string().min(1, 'Start date is required'),
  color: z.string().optional().default(''),
  year: z.number().int().optional().nullable().default(null),
  vinNumber: z.string().optional().default(''),
  engineNumber: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  holidayScheme: z.nativeEnum(HolidayScheme).optional().default(HolidayScheme.NEW_CONTRACT),
});
export type CreateContractDto = z.infer<typeof CreateContractDto>;

export const UpdateContractStatusDto = z.object({
  status: z.nativeEnum(ContractStatus),
});
export type UpdateContractStatusDto = z.infer<typeof UpdateContractStatusDto>;

export const UpdateContractDto = z.object({
  notes: z.string().optional(),
  gracePeriodDays: z.number().int().min(1).optional(),
  ownershipTargetDays: z.number().int().min(1).optional(),
  color: z.string().optional(),
  year: z.number().int().optional().nullable(),
  vinNumber: z.string().optional(),
  engineNumber: z.string().optional(),
  holidayScheme: z.nativeEnum(HolidayScheme).optional(),
});
export type UpdateContractDto = z.infer<typeof UpdateContractDto>;

export const ExtendContractDto = z.object({
  durationDays: z.number().int().min(1).max(7, 'Maximum 7 days per extension'),
});
export type ExtendContractDto = z.infer<typeof ExtendContractDto>;

export const CancelContractDto = z.object({
  reason: z.string().min(1, 'Cancellation reason is required'),
});
export type CancelContractDto = z.infer<typeof CancelContractDto>;

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

// Saving DTOs
export const DebitSavingDto = z.object({
  amount: z.number().int().positive('Nominal harus lebih dari 0'),
  description: z.string().min(1, 'Deskripsi wajib diisi'),
  photo: z.string().optional().nullable().default(null),
  notes: z.string().optional().nullable().default(null),
});
export type DebitSavingDto = z.infer<typeof DebitSavingDto>;

export const ClaimSavingDto = z.object({
  amount: z.number().int().positive('Nominal harus lebih dari 0').optional(), // Jika tidak diisi = claim semua sisa
  notes: z.string().optional().nullable().default(null),
});
export type ClaimSavingDto = z.infer<typeof ClaimSavingDto>;
