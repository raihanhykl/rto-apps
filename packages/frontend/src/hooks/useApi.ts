"use client";

import useSWR, { useSWRConfig } from "swr";
import { useCallback } from "react";
import { api } from "@/lib/api";

// --- TTL Constants (dedupingInterval in ms) ---
const TTL = {
  LONG: 10 * 60 * 1000,   // 10 min - settings, motor rates
  MEDIUM: 5 * 60 * 1000,  // 5 min  - dashboard
  DEFAULT: 60 * 1000,     // 1 min  - paginated lists, detail pages
  SHORT: 15 * 1000,       // 15 sec - billing, calendar
};

// --- Helper: build cache key from path + params ---
function buildKey(path: string, params?: Record<string, unknown>): string {
  if (!params) return path;
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") query.set(k, String(v));
  });
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}

// ===================== HOOKS =====================

// --- Dashboard ---
export function useDashboardStats() {
  return useSWR("/dashboard/stats", () => api.getDashboardStats(), {
    dedupingInterval: TTL.MEDIUM,
  });
}

// --- Customers ---
export function useCustomersPaginated(params: {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
}) {
  const key = buildKey("/customers", params);
  return useSWR(key, () => api.getCustomersPaginated(params), {
    dedupingInterval: TTL.DEFAULT,
  });
}

export function useCustomer(id: string | undefined) {
  return useSWR(id ? `/customers/${id}` : null, () => api.getCustomer(id!), {
    dedupingInterval: TTL.DEFAULT,
  });
}

export function useCustomersList(search?: string) {
  const key = search ? `/customers?search=${encodeURIComponent(search)}` : "/customers";
  return useSWR(key, () => api.getCustomers(search), {
    dedupingInterval: TTL.DEFAULT,
  });
}

// --- Contracts ---
export function useContractsPaginated(params: {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  status?: string;
}) {
  const key = buildKey("/contracts", params);
  return useSWR(key, () => api.getContractsPaginated(params), {
    dedupingInterval: TTL.DEFAULT,
  });
}

export function useContractDetail(id: string | undefined) {
  return useSWR(id ? `/contracts/${id}/detail` : null, () => api.getContractDetail(id!), {
    dedupingInterval: TTL.DEFAULT,
  });
}

export function useContractsByCustomer(customerId: string | undefined) {
  return useSWR(
    customerId ? `/contracts/customer/${customerId}` : null,
    () => api.getContractsByCustomer(customerId!),
    { dedupingInterval: TTL.DEFAULT }
  );
}

export function useContractsList() {
  return useSWR("/contracts", () => api.getContracts(), {
    dedupingInterval: TTL.DEFAULT,
  });
}

// --- Invoices ---
export function useInvoicesPaginated(params: {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  status?: string;
  customerId?: string;
}) {
  const key = buildKey("/invoices", params);
  return useSWR(key, () => api.getInvoicesPaginated(params), {
    dedupingInterval: TTL.DEFAULT,
  });
}

export function useInvoicesByCustomer(customerId: string | undefined) {
  return useSWR(
    customerId ? `/invoices?customerId=${customerId}` : null,
    () => api.getInvoicesByCustomer(customerId!),
    { dedupingInterval: TTL.DEFAULT }
  );
}

// --- Billings ---
export function useBillingsByContract(contractId: string | undefined) {
  return useSWR(
    contractId ? `/billings/contract/${contractId}` : null,
    () => api.getBillingsByContract(contractId!),
    { dedupingInterval: TTL.SHORT }
  );
}

export function useActiveBilling(contractId: string | undefined) {
  return useSWR(
    contractId ? `/billings/contract/${contractId}/active` : null,
    () => api.getActiveBillingByContract(contractId!),
    { dedupingInterval: TTL.SHORT }
  );
}

export function useCalendarData(contractId: string | undefined, year: number, month: number) {
  return useSWR(
    contractId ? `/billings/contract/${contractId}/calendar?year=${year}&month=${month}` : null,
    () => api.getCalendarData(contractId!, year, month),
    { dedupingInterval: TTL.SHORT }
  );
}

// --- Reports ---
export function useReport(filters?: {
  startDate?: string;
  endDate?: string;
  status?: string;
  motorModel?: string;
}) {
  const key = buildKey("/reports", filters);
  return useSWR(key, () => api.getReport(filters), {
    dedupingInterval: TTL.DEFAULT,
  });
}

// --- Audit Logs ---
export function useAuditLogsPaginated(params: {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  module?: string;
}) {
  const key = buildKey("/audit-logs", params);
  return useSWR(key, () => api.getAuditLogsPaginated(params), {
    dedupingInterval: TTL.DEFAULT,
  });
}

// --- Settings ---
export function useSettings() {
  return useSWR("/settings", () => api.getSettings(), {
    dedupingInterval: TTL.LONG,
  });
}

export function useMotorRates() {
  return useSWR("/settings/rates", () => api.getMotorRates(), {
    dedupingInterval: TTL.LONG,
  });
}

// ===================== INVALIDATION =====================

export function useInvalidate() {
  const { mutate } = useSWRConfig();

  const invalidate = useCallback(
    (...prefixes: string[]) => {
      mutate(
        (key: unknown) =>
          typeof key === "string" && prefixes.some((p) => key.startsWith(p)),
        undefined,
        { revalidate: true }
      );
    },
    [mutate]
  );

  return invalidate;
}
