import { UserRole } from '../enums';

export interface User {
  id: string;
  username: string;
  password: string; // hashed
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
