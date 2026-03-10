"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReport } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { ReportData, ContractStatus, MotorModel, BatteryType } from "@/types";
import {
  BarChart3,
  FileJson,
  FileSpreadsheet,
  FileText,
  Filter,
  TrendingUp,
  Users,
  AlertTriangle,
  Trophy,
} from "lucide-react";

interface ReportFilters {
  startDate: string;
  endDate: string;
  status: string;
  motorModel: string;
  batteryType: string;
}

export default function ReportsPage() {
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: "",
    endDate: "",
    status: "",
    motorModel: "",
    batteryType: "",
  });
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>({
    startDate: "",
    endDate: "",
    status: "",
    motorModel: "",
    batteryType: "",
  });

  const buildFilterParams = (f: ReportFilters) => {
    const params: Record<string, string> = {};
    if (f.startDate) params.startDate = f.startDate;
    if (f.endDate) params.endDate = f.endDate;
    if (f.status) params.status = f.status;
    if (f.motorModel) params.motorModel = f.motorModel;
    if (f.batteryType) params.batteryType = f.batteryType;
    return Object.keys(params).length > 0 ? params : undefined;
  };

  const { data: report, isLoading: loading } = useReport(buildFilterParams(appliedFilters)) as { data: ReportData | undefined; isLoading: boolean };

  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters });
  };

  const handleClearFilters = () => {
    const empty = { startDate: "", endDate: "", status: "", motorModel: "", batteryType: "" };
    setFilters(empty);
    setAppliedFilters(empty);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async (type: "json" | "csv" | "xlsv") => {
    setExporting(true);
    try {
      const params = buildFilterParams(appliedFilters);
      if (type === "json") {
        const data = await api.exportReportJSON(params);
        const blob = new Blob(
          [typeof data === "string" ? data : JSON.stringify(data, null, 2)],
          { type: "application/json" }
        );
        downloadBlob(blob, "wedison-report.json");
      } else if (type === "csv") {
        const data = await api.exportReportCSV(params);
        const blob = new Blob([data as string], { type: "text/csv" });
        downloadBlob(blob, "wedison-report.csv");
      } else {
        const data = await api.exportReportXLSV(params);
        const blob = new Blob([data as string], {
          type: "text/tab-separated-values",
        });
        downloadBlob(blob, "wedison-report.xls");
      }
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setExporting(false);
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "ACTIVE": return "Aktif";
      case "COMPLETED": return "Selesai";
      case "OVERDUE": return "Terlambat";
      case "CANCELLED": return "Dibatalkan";
      case "REPOSSESSED": return "Ditarik";
      default: return status;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "text-green-600";
      case "COMPLETED": return "text-emerald-600";
      case "OVERDUE": return "text-red-600";
      case "CANCELLED": return "text-gray-500";
      case "REPOSSESSED": return "text-orange-600";
      default: return "";
    }
  };

  if (loading && !report) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const summary = report?.summary;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground">
            Laporan & analisis data{" "}
            {report?.period && report.period !== "All Time" && (
              <span className="text-xs">({report.period})</span>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("json")}
            disabled={exporting}
          >
            <FileJson className="h-4 w-4 mr-1" />
            JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("csv")}
            disabled={exporting}
          >
            <FileText className="h-4 w-4 mr-1" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("xlsv")}
            disabled={exporting}
          >
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filter Laporan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
            <div>
              <Label className="text-xs">Dari Tanggal</Label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, startDate: e.target.value }))
                }
              />
            </div>
            <div>
              <Label className="text-xs">Sampai Tanggal</Label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, endDate: e.target.value }))
                }
              />
            </div>
            <div>
              <Label className="text-xs">Status Kontrak</Label>
              <Select
                value={filters.status || "ALL"}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, status: v === "ALL" ? "" : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua</SelectItem>
                  <SelectItem value="ACTIVE">Aktif</SelectItem>
                  <SelectItem value="COMPLETED">Selesai</SelectItem>
                  <SelectItem value="OVERDUE">Terlambat</SelectItem>
                  <SelectItem value="CANCELLED">Dibatalkan</SelectItem>
                  <SelectItem value="REPOSSESSED">Ditarik</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Model Motor</Label>
              <Select
                value={filters.motorModel || "ALL"}
                onValueChange={(v) =>
                  setFilters((f) => ({
                    ...f,
                    motorModel: v === "ALL" ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua</SelectItem>
                  <SelectItem value="ATHENA">Athena</SelectItem>
                  <SelectItem value="VICTORY">Victory</SelectItem>
                  <SelectItem value="EDPOWER">EdPower</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipe Baterai</Label>
              <Select
                value={filters.batteryType || "ALL"}
                onValueChange={(v) =>
                  setFilters((f) => ({
                    ...f,
                    batteryType: v === "ALL" ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua</SelectItem>
                  <SelectItem value="REGULAR">Regular</SelectItem>
                  <SelectItem value="EXTENDED">Extended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleApplyFilters}>
                Terapkan
              </Button>
              <Button size="sm" variant="outline" onClick={handleClearFilters}>
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!summary ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Belum ada data untuk ditampilkan.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Kontrak
                    </p>
                    <p className="text-3xl font-bold">
                      {summary.totalContracts}
                    </p>
                  </div>
                  <div className="bg-blue-50 text-blue-600 p-3 rounded-lg">
                    <FileText className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Revenue
                    </p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(summary.totalRevenue)}
                    </p>
                  </div>
                  <div className="bg-green-50 text-green-600 p-3 rounded-lg">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Pending Amount
                    </p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {formatCurrency(summary.pendingAmount)}
                    </p>
                  </div>
                  <div className="bg-yellow-50 text-yellow-600 p-3 rounded-lg">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Rata-rata Progress
                    </p>
                    <p className="text-3xl font-bold">
                      {summary.averageOwnershipProgress}%
                    </p>
                  </div>
                  <div className="bg-purple-50 text-purple-600 p-3 rounded-lg">
                    <Trophy className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Contracts by Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  Kontrak per Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(summary.contractsByStatus).map(
                    ([status, count]) => {
                      const total = summary.totalContracts || 1;
                      const pct = Math.round(((count as number) / total) * 100);
                      return (
                        <div key={status} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className={statusColor(status)}>
                              {statusLabel(status)}
                            </span>
                            <span className="font-medium">
                              {count as number} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                status === "ACTIVE"
                                  ? "bg-green-500"
                                  : status === "COMPLETED"
                                  ? "bg-emerald-500"
                                  : status === "OVERDUE"
                                  ? "bg-red-500"
                                  : status === "CANCELLED"
                                  ? "bg-gray-400"
                                  : "bg-orange-500"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Revenue by Motor */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  Revenue per Model Motor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(summary.revenueByMotor).map(
                    ([model, revenue]) => {
                      const maxRevenue = Math.max(
                        ...Object.values(summary.revenueByMotor),
                        1
                      );
                      const pct = Math.round(
                        ((revenue as number) / maxRevenue) * 100
                      );
                      return (
                        <div key={model} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{model}</span>
                            <span className="text-green-600 font-medium">
                              {formatCurrency(revenue as number)}
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="h-2 rounded-full bg-primary"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue by Month */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Revenue per Bulan (6 Bulan Terakhir)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 h-40">
                {summary.revenueByMonth.map((item) => {
                  const maxRev = Math.max(
                    ...summary.revenueByMonth.map((m) => m.revenue),
                    1
                  );
                  const heightPct = Math.max(
                    (item.revenue / maxRev) * 100,
                    2
                  );
                  return (
                    <div
                      key={item.month}
                      className="flex-1 flex flex-col items-center gap-1"
                    >
                      <span className="text-xs text-muted-foreground">
                        {item.revenue > 0
                          ? formatCurrency(item.revenue)
                          : "-"}
                      </span>
                      <div
                        className="w-full bg-primary/80 rounded-t-sm min-h-[4px]"
                        style={{ height: `${heightPct}%` }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {item.month.split("-")[1]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Top Customers */}
          {summary.topCustomers.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" /> Top Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 text-xs font-medium">
                          #
                        </th>
                        <th className="text-left p-3 text-xs font-medium">
                          Nama
                        </th>
                        <th className="text-left p-3 text-xs font-medium">
                          Total Bayar
                        </th>
                        <th className="text-left p-3 text-xs font-medium">
                          Kontrak
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.topCustomers.map((cust, idx) => (
                        <tr
                          key={cust.name}
                          className="border-b last:border-0 hover:bg-muted/30"
                        >
                          <td className="p-3 text-sm text-muted-foreground">
                            {idx + 1}
                          </td>
                          <td className="p-3 text-sm font-medium">
                            {cust.name}
                          </td>
                          <td className="p-3 text-sm text-green-600 font-medium">
                            {formatCurrency(cust.totalPaid)}
                          </td>
                          <td className="p-3 text-sm">
                            {cust.contractCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Extra stats row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground">Total Invoice</p>
                <p className="text-3xl font-bold mt-1">
                  {summary.totalInvoices}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Kontrak Overdue
                </p>
                <p className="text-3xl font-bold mt-1 text-red-600">
                  {summary.overdueCount}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Rata-rata Ownership
                </p>
                <p className="text-3xl font-bold mt-1">
                  {summary.averageOwnershipProgress}%
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
