import { MotorModel, ContractStatus } from '../enums';

export interface Contract {
  id: string;
  contractNumber: string;
  customerId: string;
  motorModel: MotorModel;
  dailyRate: number;
  durationDays: number;
  totalAmount: number;
  startDate: Date;
  endDate: Date;
  status: ContractStatus;
  notes: string;
  createdBy: string; // admin user id
  createdAt: Date;
  updatedAt: Date;
}
