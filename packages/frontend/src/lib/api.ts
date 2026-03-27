const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private token: string | null = null;
  private refreshing: Promise<boolean> | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  private async tryRefresh(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;
      const data = await res.json();
      this.token = data.token;
      return true;
    } catch {
      return false;
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (res.status === 401 && path !== '/auth/login' && path !== '/auth/refresh') {
      // Attempt token refresh (deduplicate concurrent refreshes)
      if (!this.refreshing) {
        this.refreshing = this.tryRefresh().finally(() => {
          this.refreshing = null;
        });
      }
      const refreshed = await this.refreshing;

      if (refreshed) {
        // Retry original request with new token
        const retryHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          ...((options.headers as Record<string, string>) || {}),
          Authorization: `Bearer ${this.token}`,
        };
        const retryRes = await fetch(`${API_BASE}${path}`, {
          ...options,
          headers: retryHeaders,
          credentials: 'include',
        });

        if (retryRes.ok) {
          return this.parseResponse<T>(retryRes);
        }

        if (retryRes.status === 401) {
          this.token = null;
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
          throw new Error('Unauthorized');
        }

        const data = await retryRes.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(data.error || 'Request failed');
      }

      // Refresh failed — redirect to login
      this.token = null;
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(data.error || 'Request failed');
    }

    return this.parseResponse<T>(res);
  }

  private async parseResponse<T>(res: Response): Promise<T> {
    const contentType = res.headers.get('content-type');
    if (contentType?.includes('text/csv') || contentType?.includes('text/tab-separated-values')) {
      return (await res.text()) as unknown as T;
    }
    if (contentType?.includes('application/pdf')) {
      return (await res.blob()) as unknown as T;
    }
    return res.json();
  }

  // Auth
  async login(username: string, password: string) {
    const result = await this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    // Store access token in memory
    this.token = result.token;
    return result;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.token = null;
    }
  }

  async refreshToken(): Promise<boolean> {
    return this.tryRefresh();
  }

  async getMe() {
    return this.request<{ user: any }>('/auth/me');
  }

  // Dashboard
  async getDashboardStats() {
    return this.request<any>('/dashboard/stats');
  }

  // Customers
  async getCustomers(search?: string) {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request<any[]>(`/customers${query}`);
  }

  async getCustomersPaginated(params: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    search?: string;
    gender?: string;
  }) {
    const query = new URLSearchParams();
    query.set('page', String(params.page || 1));
    query.set('limit', String(params.limit || 20));
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);
    if (params.search) query.set('search', params.search);
    if (params.gender) query.set('gender', params.gender);
    return this.request<any>(`/customers?${query.toString()}`);
  }

  async getCustomer(id: string) {
    return this.request<any>(`/customers/${id}`);
  }

  async createCustomer(data: any) {
    return this.request<any>('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCustomer(id: string, data: any) {
    return this.request<any>(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCustomer(id: string) {
    return this.request(`/customers/${id}`, { method: 'DELETE' });
  }

  // Contracts
  async getContracts() {
    return this.request<any[]>('/contracts');
  }

  async getContractsPaginated(params: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    search?: string;
    status?: string;
    motorModel?: string;
    batteryType?: string;
    dpScheme?: string;
    dpFullyPaid?: string;
  }) {
    const query = new URLSearchParams();
    query.set('page', String(params.page || 1));
    query.set('limit', String(params.limit || 20));
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.motorModel) query.set('motorModel', params.motorModel);
    if (params.batteryType) query.set('batteryType', params.batteryType);
    if (params.dpScheme) query.set('dpScheme', params.dpScheme);
    if (params.dpFullyPaid) query.set('dpFullyPaid', params.dpFullyPaid);
    return this.request<any>(`/contracts?${query.toString()}`);
  }

  async getContract(id: string) {
    return this.request<any>(`/contracts/${id}`);
  }

  async getContractDetail(id: string) {
    return this.request<any>(`/contracts/${id}/detail`);
  }

  async getContractsByCustomer(customerId: string) {
    return this.request<any[]>(`/contracts/customer/${customerId}`);
  }

  async createContract(data: any) {
    return this.request<any>('/contracts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateContractStatus(id: string, status: string) {
    return this.request<any>(`/contracts/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async extendContract(id: string, durationDays: number) {
    return this.request<any>(`/contracts/${id}/extend`, {
      method: 'POST',
      body: JSON.stringify({ durationDays }),
    });
  }

  async receiveUnit(id: string, bastPhoto: string, bastNotes?: string) {
    return this.request<any>(`/contracts/${id}/receive-unit`, {
      method: 'PATCH',
      body: JSON.stringify({ bastPhoto, bastNotes }),
    });
  }

  async editContract(
    id: string,
    data: {
      notes?: string;
      gracePeriodDays?: number;
      ownershipTargetDays?: number;
      color?: string;
      year?: number | null;
      vinNumber?: string;
      engineNumber?: string;
    },
  ) {
    return this.request<any>(`/contracts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async cancelContract(id: string, reason: string) {
    return this.request<any>(`/contracts/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  }

  async repossessContract(id: string) {
    return this.request<any>(`/contracts/${id}/repossess`, {
      method: 'PATCH',
    });
  }

  async deleteContract(id: string) {
    return this.request<any>(`/contracts/${id}`, {
      method: 'DELETE',
    });
  }

  async getOverdueWarnings() {
    return this.request<any[]>('/contracts/overdue-warnings');
  }

  // Payments (unified billing + invoice)
  async getPayments() {
    return this.request<any[]>('/payments');
  }

  async getPaymentsPaginated(params: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    search?: string;
    status?: string;
    customerId?: string;
    invoiceType?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const query = new URLSearchParams();
    query.set('page', String(params.page || 1));
    query.set('limit', String(params.limit || 20));
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.customerId) query.set('customerId', params.customerId);
    if (params.invoiceType) query.set('invoiceType', params.invoiceType);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    return this.request<any>(`/payments?${query.toString()}`);
  }

  async getPayment(id: string) {
    return this.request<any>(`/payments/${id}`);
  }

  async searchPayments(query: string) {
    return this.request<any[]>(`/payments/search?q=${encodeURIComponent(query)}`);
  }

  async getPaymentQR(id: string) {
    return this.request<{ qrCode: string }>(`/payments/${id}/qr`);
  }

  async simulatePayment(id: string, status: 'PAID' | 'FAILED') {
    return this.request<any>(`/payments/${id}/simulate`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  async voidPayment(id: string) {
    return this.request<any>(`/payments/${id}/void`, {
      method: 'PATCH',
    });
  }

  async markPaymentPaid(id: string) {
    return this.request<any>(`/payments/${id}/mark-paid`, {
      method: 'PATCH',
    });
  }

  async revertPaymentStatus(id: string) {
    return this.request<any>(`/payments/${id}/revert`, {
      method: 'PATCH',
    });
  }

  async bulkMarkPaid(paymentIds: string[]) {
    return this.request<{ success: string[]; failed: Array<{ id: string; error: string }> }>(
      '/payments/bulk-pay',
      {
        method: 'POST',
        body: JSON.stringify({ paymentIds }),
      },
    );
  }

  async payPayment(id: string) {
    return this.request<any>(`/payments/${id}/pay`, {
      method: 'POST',
    });
  }

  async getPaymentsByContract(contractId: string) {
    return this.request<any[]>(`/payments/contract/${contractId}`);
  }

  async getActivePaymentByContract(contractId: string) {
    return this.request<any>(`/payments/contract/${contractId}/active`);
  }

  async getCalendarData(contractId: string, year: number, month: number) {
    return this.request<Array<{ date: string; status: string; amount?: number }>>(
      `/payments/contract/${contractId}/calendar?year=${year}&month=${month}`,
    );
  }

  async previewManualPayment(contractId: string, days: number) {
    return this.request<{
      amount: number;
      lateFee: number;
      total: number;
      daysCount: number;
      dailyRate: number;
    }>(`/payments/contract/${contractId}/manual-preview?days=${days}`);
  }

  async createManualPayment(contractId: string, days: number) {
    return this.request<any>(`/payments/contract/${contractId}/manual`, {
      method: 'POST',
      body: JSON.stringify({ days }),
    });
  }

  async cancelPayment(paymentId: string) {
    return this.request<any>(`/payments/${paymentId}/cancel`, {
      method: 'PATCH',
    });
  }

  async updatePaymentDayStatus(contractId: string, date: string, status: string, notes?: string) {
    return this.request<any>(`/payments/contract/${contractId}/day/${date}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    });
  }

  async reducePayment(paymentId: string, newDaysCount: number, notes?: string) {
    return this.request<any>(`/payments/${paymentId}/reduce`, {
      method: 'POST',
      body: JSON.stringify({ newDaysCount, notes }),
    });
  }

  async downloadPaymentPdf(id: string) {
    return this.request<Blob>(`/payments/${id}/pdf`);
  }

  // Reports
  async getReport(filters?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    motorModel?: string;
    batteryType?: string;
  }) {
    const query = new URLSearchParams();
    if (filters?.startDate) query.set('startDate', filters.startDate);
    if (filters?.endDate) query.set('endDate', filters.endDate);
    if (filters?.status) query.set('status', filters.status);
    if (filters?.motorModel) query.set('motorModel', filters.motorModel);
    if (filters?.batteryType) query.set('batteryType', filters.batteryType);
    const queryStr = query.toString() ? `?${query.toString()}` : '';
    return this.request<any>(`/reports${queryStr}`);
  }

  async exportReportJSON(filters?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    motorModel?: string;
    batteryType?: string;
  }) {
    const query = new URLSearchParams();
    if (filters?.startDate) query.set('startDate', filters.startDate);
    if (filters?.endDate) query.set('endDate', filters.endDate);
    if (filters?.status) query.set('status', filters.status);
    if (filters?.motorModel) query.set('motorModel', filters.motorModel);
    if (filters?.batteryType) query.set('batteryType', filters.batteryType);
    const queryStr = query.toString() ? `?${query.toString()}` : '';
    return this.request<string>(`/reports/export/json${queryStr}`);
  }

  async exportReportCSV(filters?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    motorModel?: string;
    batteryType?: string;
  }) {
    const query = new URLSearchParams();
    if (filters?.startDate) query.set('startDate', filters.startDate);
    if (filters?.endDate) query.set('endDate', filters.endDate);
    if (filters?.status) query.set('status', filters.status);
    if (filters?.motorModel) query.set('motorModel', filters.motorModel);
    if (filters?.batteryType) query.set('batteryType', filters.batteryType);
    const queryStr = query.toString() ? `?${query.toString()}` : '';
    return this.request<string>(`/reports/export/csv${queryStr}`);
  }

  async exportReportXLSV(filters?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    motorModel?: string;
    batteryType?: string;
  }) {
    const query = new URLSearchParams();
    if (filters?.startDate) query.set('startDate', filters.startDate);
    if (filters?.endDate) query.set('endDate', filters.endDate);
    if (filters?.status) query.set('status', filters.status);
    if (filters?.motorModel) query.set('motorModel', filters.motorModel);
    if (filters?.batteryType) query.set('batteryType', filters.batteryType);
    const queryStr = query.toString() ? `?${query.toString()}` : '';
    return this.request<string>(`/reports/export/xlsv${queryStr}`);
  }

  // Audit Logs
  async getAuditLogs(params?: { module?: string; userId?: string }) {
    const query = new URLSearchParams();
    if (params?.module) query.set('module', params.module);
    if (params?.userId) query.set('userId', params.userId);
    const queryStr = query.toString() ? `?${query.toString()}` : '';
    return this.request<any[]>(`/audit-logs${queryStr}`);
  }

  async getAuditLogsPaginated(params: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    search?: string;
    module?: string;
  }) {
    const query = new URLSearchParams();
    query.set('page', String(params.page || 1));
    query.set('limit', String(params.limit || 20));
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);
    if (params.search) query.set('search', params.search);
    if (params.module) query.set('module', params.module);
    return this.request<any>(`/audit-logs?${query.toString()}`);
  }

  async getRecentAuditLogs(limit: number = 50) {
    return this.request<any[]>(`/audit-logs/recent?limit=${limit}`);
  }

  // Settings
  async getSettings() {
    return this.request<any[]>('/settings');
  }

  async getMotorRates() {
    return this.request<Record<string, number>>('/settings/rates');
  }

  async updateSetting(data: { key: string; value: string; description?: string }) {
    return this.request<any>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Saving
  async getSavingByContract(contractId: string) {
    return this.request<{ balance: number; transactions: any[] }>(
      `/savings/contract/${contractId}`,
    );
  }

  async getSavingBalance(contractId: string) {
    return this.request<{ balance: number }>(`/savings/contract/${contractId}/balance`);
  }

  async debitSavingForService(
    contractId: string,
    data: { amount: number; description: string; photo?: string; notes?: string },
  ) {
    return this.request<any>(`/savings/contract/${contractId}/debit/service`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async debitSavingForTransfer(
    contractId: string,
    data: { amount: number; description: string; photo?: string; notes?: string },
  ) {
    return this.request<any>(`/savings/contract/${contractId}/debit/transfer`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async claimSaving(contractId: string, data?: { amount?: number; notes?: string }) {
    return this.request<any>(`/savings/contract/${contractId}/claim`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  async recalculateSavingBalance(contractId: string) {
    return this.request<{ balance: number }>(`/savings/contract/${contractId}/recalculate`, {
      method: 'POST',
    });
  }

  // Service Records
  async getServiceRecordsByContract(contractId: string) {
    return this.request<any[]>(`/service-records/contract/${contractId}`);
  }

  async getServiceRecordById(id: string) {
    return this.request<any>(`/service-records/${id}`);
  }

  async createServiceRecord(data: {
    contractId: string;
    serviceType: string;
    replacementProvided: boolean;
    startDate: string;
    endDate: string;
    notes?: string;
    attachment?: string | null;
  }) {
    return this.request<any>('/service-records', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async revokeServiceRecord(id: string, reason: string) {
    return this.request<any>(`/service-records/${id}/revoke`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  }

  // Scheduler
  async runDailyTasks() {
    return this.request<{ success: boolean; message: string }>('/scheduler/run-daily-tasks', {
      method: 'POST',
    });
  }

  async getSchedulerStatus() {
    return this.request<{
      isStarted: boolean;
      isJobRunning: boolean;
      lastRunAt: string | null;
      lastRunResult: 'success' | 'error' | null;
    }>('/scheduler/status');
  }
}

export const api = new ApiClient();
