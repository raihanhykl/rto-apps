export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  module?: string;
  customerId?: string;
  // Additional filters
  gender?: string;
  motorModel?: string;
  batteryType?: string;
  dpScheme?: string;
  dpFullyPaid?: string;
  invoiceType?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
