import { MotorModel, BatteryType, ContractStatus, DPScheme } from '../enums';

export interface Contract {
  id: string;
  contractNumber: string;
  customerId: string;
  motorModel: MotorModel;
  batteryType: BatteryType;
  dailyRate: number;
  durationDays: number; // current active period days
  totalAmount: number; // total amount paid so far
  startDate: Date;
  endDate: Date; // current period end date
  status: ContractStatus;
  notes: string;
  createdBy: string; // admin user id

  // Unit details
  color: string;
  year: number | null;
  vinNumber: string;
  engineNumber: string;

  // DP fields
  dpAmount: number; // DP amount based on motor+battery
  dpScheme: DPScheme; // FULL or INSTALLMENT
  dpPaidAmount: number; // amount of DP paid so far
  dpFullyPaid: boolean; // whether DP is fully paid

  // Unit delivery & billing
  unitReceivedDate: Date | null; // when customer received the motor
  billingStartDate: Date | null; // H+1 after unitReceivedDate (when daily billing starts)
  bastPhoto: string | null; // BAST (Berita Acara Serah Terima) photo URL
  bastNotes: string; // notes from unit handover
  holidayDaysPerMonth: number; // Libur Bayar days per month (2-4, default 2)

  // RTO fields
  ownershipTargetDays: number; // total days needed to own (default 1278)
  totalDaysPaid: number; // cumulative days paid across all payments
  ownershipProgress: number; // percentage (0-100)
  gracePeriodDays: number; // days allowed after endDate before repossession
  repossessedAt: Date | null;
  completedAt: Date | null; // date when ownership was achieved
  isDeleted: boolean;
  deletedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}
