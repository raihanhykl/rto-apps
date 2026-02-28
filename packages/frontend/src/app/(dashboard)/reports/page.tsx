"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { BarChart3, Download, FileJson, FileSpreadsheet } from "lucide-react";

interface ReportSummary {
  totalContracts: number;
  totalInvoices: number;
  totalRevenue: number;
  pendingAmount: number;
}

export default function ReportsPage() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      const data = await api.getReport();
      setSummary(data.summary);
    } catch (error) {
      console.error("Failed to load report:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportJSON = async () => {
    setExporting(true);
    try {
      const data = await api.exportReportJSON();
      const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      downloadBlob(blob, "wedison-report.json");
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const data = await api.exportReportCSV();
      const blob = new Blob([data as string], { type: "text/csv" });
      downloadBlob(blob, "wedison-report.csv");
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setExporting(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Laporan dan export data</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportJSON} disabled={exporting}>
            <FileJson className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
          <Button variant="outline" onClick={handleExportCSV} disabled={exporting}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {summary ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Kontrak
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{summary.totalContracts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Invoice
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{summary.totalInvoices}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.totalRevenue)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Amount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-yellow-600">
                {formatCurrency(summary.pendingAmount)}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Belum ada data untuk ditampilkan.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
