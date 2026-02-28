const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      if (typeof window !== 'undefined') localStorage.setItem('token', token);
    } else {
      if (typeof window !== 'undefined') localStorage.removeItem('token');
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      this.setToken(null);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(data.error || 'Request failed');
    }

    // Handle download responses
    const contentType = res.headers.get('content-type');
    if (contentType?.includes('text/csv')) {
      return (await res.text()) as unknown as T;
    }

    return res.json();
  }

  // Auth
  async login(username: string, password: string) {
    return this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async logout() {
    return this.request('/auth/logout', { method: 'POST' });
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

  async getContract(id: string) {
    return this.request<any>(`/contracts/${id}`);
  }

  async getContractDetail(id: string) {
    return this.request<any>(`/contracts/${id}/detail`);
  }

  async getContractsByCustomer(customerId: string) {
    return this.request<any[]>(`/contracts/customer/${customerId}`);
  }

  async getInvoicesByCustomer(customerId: string) {
    return this.request<any[]>(`/invoices?customerId=${customerId}`);
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

  // Invoices
  async getInvoices() {
    return this.request<any[]>('/invoices');
  }

  async getInvoice(id: string) {
    return this.request<any>(`/invoices/${id}`);
  }

  async getInvoiceQR(id: string) {
    return this.request<{ qrCode: string }>(`/invoices/${id}/qr`);
  }

  async simulatePayment(id: string, status: 'PAID' | 'FAILED') {
    return this.request<any>(`/invoices/${id}/payment`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  // Reports
  async getReport() {
    return this.request<any>('/reports');
  }

  async exportReportJSON() {
    return this.request<string>('/reports/export/json');
  }

  async exportReportCSV() {
    return this.request<string>('/reports/export/csv');
  }

  // Audit Logs
  async getAuditLogs(params?: { module?: string; userId?: string }) {
    const query = new URLSearchParams();
    if (params?.module) query.set('module', params.module);
    if (params?.userId) query.set('userId', params.userId);
    const queryStr = query.toString() ? `?${query.toString()}` : '';
    return this.request<any[]>(`/audit-logs${queryStr}`);
  }

  async getRecentAuditLogs(limit: number = 50) {
    return this.request<any[]>(`/audit-logs/recent?limit=${limit}`);
  }

  // Settings
  async getSettings() {
    return this.request<any[]>('/settings');
  }

  async updateSetting(data: { key: string; value: string; description?: string }) {
    return this.request<any>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();
