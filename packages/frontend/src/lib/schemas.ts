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
  birthDate: z.string().or(z.literal("")),
  gender: z.string().or(z.literal("")),
  rideHailingApps: z.array(z.string()),
  ktpNumber: z.string().length(16, "Nomor KTP harus 16 digit").regex(/^\d+$/, "KTP hanya boleh berisi angka"),
  guarantorName: z.string(),
  guarantorPhone: z.string(),
  spouseName: z.string(),
  notes: z.string(),
});

export type CustomerFormData = z.infer<typeof customerSchema>;

export const contractSchema = z.object({
  customerId: z.string().min(1, "Customer wajib dipilih"),
  motorModel: z.enum(["ATHENA", "VICTORY", "EDPOWER"], { message: "Model motor wajib dipilih" }),
  batteryType: z.enum(["REGULAR", "EXTENDED"], { message: "Tipe baterai wajib dipilih" }),
  dpScheme: z.enum(["FULL", "INSTALLMENT"], { message: "Skema DP wajib dipilih" }),
  holidayScheme: z.enum(["OLD_CONTRACT", "NEW_CONTRACT"], { message: "Tipe kontrak wajib dipilih" }),
  startDate: z.string().min(1, "Tanggal mulai wajib diisi"),
  color: z.string(),
  year: z.string(),
  vinNumber: z.string(),
  engineNumber: z.string(),
  notes: z.string(),
});

export type ContractFormData = z.infer<typeof contractSchema>;
