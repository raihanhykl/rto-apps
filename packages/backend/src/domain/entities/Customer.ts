export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  ktpNumber: string;
  notes: string;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
