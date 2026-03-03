import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "Username wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const customerSchema = z.object({
  fullName: z.string().min(1, "Nama lengkap wajib diisi"),
  phone: z.string().min(1, "Telepon wajib diisi").regex(/^0\d{9,12}$/, "Format telepon tidak valid (contoh: 08123456789)"),
  email: z.string().email("Format email tidak valid").or(z.literal("")),
  address: z.string().min(1, "Alamat wajib diisi"),
  ktpNumber: z.string().length(16, "Nomor KTP harus 16 digit").regex(/^\d+$/, "KTP hanya boleh berisi angka"),
  notes: z.string(),
});

export type CustomerFormData = z.infer<typeof customerSchema>;

export const contractSchema = z.object({
  customerId: z.string().min(1, "Customer wajib dipilih"),
  motorModel: z.enum(["ATHENA", "VICTORY", "EDPOWER"], { message: "Model motor wajib dipilih" }),
  durationDays: z.number().min(1, "Minimal 1 hari").max(7, "Maksimal 7 hari"),
  startDate: z.string().min(1, "Tanggal mulai wajib diisi"),
  notes: z.string(),
});

export type ContractFormData = z.infer<typeof contractSchema>;
