"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { SortableHeader } from "@/components/SortableHeader";
import { usePagination } from "@/hooks/usePagination";
import { useAuditLogsPaginated } from "@/hooks/useApi";
import { AuditLog } from "@/types";
import { formatDateTime } from "@/lib/utils";
import { ClipboardList, Search } from "lucide-react";

const actionColor = (action: string) => {
  switch (action) {
    case "CREATE": return "default" as const;
    case "UPDATE": return "secondary" as const;
    case "DELETE": return "destructive" as const;
    case "LOGIN": return "success" as const;
    case "LOGOUT": return "outline" as const;
    case "PAYMENT": return "warning" as const;
    case "EXPORT": return "secondary" as const;
    default: return "outline" as const;
  }
};

export default function AuditPage() {
  const [moduleFilter, setModuleFilter] = useState("ALL");

  const pagination = usePagination({ initialSortBy: "createdAt", initialSortOrder: "desc" });

  const { data: logsData, isLoading: loading } = useAuditLogsPaginated({
    page: pagination.page,
    limit: pagination.limit,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
    search: pagination.debouncedSearch || undefined,
    module: moduleFilter !== "ALL" ? moduleFilter : undefined,
  });
  const logs = (logsData?.data as AuditLog[]) || [];

  useEffect(() => {
    if (logsData) pagination.updateFromResult(logsData);
  }, [logsData]);

  const handleModuleFilterChange = (value: string) => {
    setModuleFilter(value);
    pagination.setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground">Riwayat semua aktivitas sistem</p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari deskripsi..."
            value={pagination.search}
            onChange={(e) => pagination.setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={moduleFilter} onValueChange={handleModuleFilterChange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Module</SelectItem>
            <SelectItem value="auth">Auth</SelectItem>
            <SelectItem value="customer">Customer</SelectItem>
            <SelectItem value="contract">Contract</SelectItem>
            <SelectItem value="invoice">Invoice</SelectItem>
            <SelectItem value="setting">Setting</SelectItem>
            <SelectItem value="report">Report</SelectItem>
          </SelectContent>
        </Select>
        {pagination.total > 0 && (
          <span className="text-sm text-muted-foreground self-center">{pagination.total} log</span>
        )}
      </div>

      {!loading && logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {pagination.debouncedSearch || moduleFilter !== "ALL"
                ? "Tidak ada log yang cocok dengan filter."
                : "Belum ada aktivitas tercatat."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <SortableHeader label="Waktu" field="createdAt" currentSortBy={pagination.sortBy} currentSortOrder={pagination.sortOrder} onSort={pagination.handleSort} />
                    <th className="text-left p-4 text-sm font-medium">Action</th>
                    <th className="text-left p-4 text-sm font-medium">Module</th>
                    <th className="text-left p-4 text-sm font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        {Array.from({ length: 4 }).map((_, j) => (
                          <td key={j} className="p-4">
                            <div className="h-4 bg-muted animate-pulse rounded" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="p-4">
                          <Badge variant={actionColor(log.action)}>{log.action}</Badge>
                        </td>
                        <td className="p-4 text-sm capitalize">{log.module}</td>
                        <td className="p-4 text-sm">{log.description}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={pagination.setPage} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
