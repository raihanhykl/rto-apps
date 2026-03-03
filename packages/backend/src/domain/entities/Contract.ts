import { MotorModel, ContractStatus } from '../enums';

export interface Contract {
  id: string;
  contractNumber: string;
  customerId: string;
  motorModel: MotorModel;
  dailyRate: number;
  durationDays: number; // current active period days
  totalAmount: number; // total amount paid so far
  startDate: Date;
  endDate: Date; // current period end date
  status: ContractStatus;
  notes: string;
  createdBy: string; // admin user id

  // RTO fields
  ownershipTargetDays: number; // total days needed to own (default 1825 = 5 years)
  totalDaysPaid: number; // cumulative days paid across all extensions
  ownershipProgress: number; // percentage (0-100)
  gracePeriodDays: number; // days allowed after endDate before repossession
  repossessedAt: Date | null;
  completedAt: Date | null; // date when ownership was achieved
  isDeleted: boolean;
  deletedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}
