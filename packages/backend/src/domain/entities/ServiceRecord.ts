import { ServiceType, ServiceRecordStatus } from '../enums';

export interface DaySnapshot {
  date: string; // "YYYY-MM-DD"
  originalStatus: string; // "PAID" | "UNPAID" | "PENDING" | "HOLIDAY" | "VOIDED"
  shiftedToDate: string | null; // tanggal tujuan shift (jika originally PAID)
  invoiceId: string | null; // invoice yang linked (jika originally PAID/PENDING)
}

export interface ServiceRecord {
  id: string;
  contractId: string;
  serviceType: ServiceType;
  replacementProvided: boolean;
  startDate: Date;
  endDate: Date;
  compensationDays: number;
  notes: string;
  attachment: string | null;

  // Metadata untuk revoke
  daySnapshots: DaySnapshot[] | null;

  // Status & Revoke
  status: ServiceRecordStatus;
  revokedAt: Date | null;
  revokedBy: string | null;
  revokeReason: string | null;

  // Admin & Audit
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
