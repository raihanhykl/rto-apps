import { Gender } from '../enums';

export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  birthDate: string | null; // TTL (format: YYYY-MM-DD)
  gender: Gender | null;
  rideHailingApps: string[]; // Grab, Gojek, Maxim, Indrive, Shopee, etc.
  ktpNumber: string;

  // Document photos (file paths/URLs)
  ktpPhoto: string | null;
  simPhoto: string | null;
  kkPhoto: string | null;

  // Guarantor (Penjamin)
  guarantorName: string;
  guarantorPhone: string;
  guarantorKtpPhoto: string | null;

  // Spouse (Istri/Suami) - optional
  spouseName: string;
  spouseKtpPhoto: string | null;

  notes: string;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
