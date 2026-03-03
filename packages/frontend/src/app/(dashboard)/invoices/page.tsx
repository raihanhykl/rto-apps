"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { api } from "@/lib/api";
import { Invoice, Contract } from "@/types";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { toastSuccess, toastError } from "@/stores/toastStore";
import {
  Receipt,
  QrCode,
  Search,
  CheckCircle2,
  FileDown,
  XCircle,
  FileX,
} from "lucide-react";

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case "PENDING": return "warning" as const;
    case "PAID": return "success" as const;
    case "FAILED": return "destructive" as const;
    case "EXPIRED": return "secondary" as const;
    case "VOID": return "secondary" as const;
    default: return "outline" as const;
  }
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidInvoiceTarget, setVoidInvoiceTarget] = useState<Invoice | null>(null);
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false);
  const [markPaidTarget, setMarkPaidTarget] = useState<Invoice | null>(null);

  const pagination = usePagination({ initialSortBy: "createdAt", initialSortOrder: "desc" });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [result, contractsData] = await Promise.all([
        api.getInvoicesPaginated({
          page: pagination.page,
          limit: pagination.limit,
          sortBy: pagination.sortBy,
          sortOrder: pagination.sortOrder,
          search: pagination.debouncedSearch || undefined,
          status: statusFilter !== "ALL" ? statusFilter : undefined,
        }),
        api.getContracts(),
      ]);
      setInvoices(result.data);
      pagination.updateFromResult(result);
      setContracts(contractsData);
    } catch (error) {
      console.error("Failed to load invoices:", error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, pagination.sortBy, pagination.sortOrder, pagination.debouncedSearch, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    pagination.setPage(1);
  };

  const getContractNumber = (contractId: string) => {
    return contracts.find((c) => c.id === contractId)?.contractNumber || "-";
  };

  const showQR = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    try {
      const data = await api.getInvoiceQR(invoice.id);
      setQrCode(data.qrCode);
      setQrDialogOpen(true);
    } catch (error: any) {
      toastError("Gagal", error?.message || "Gagal membuat QR code.");
    }
  };

  const simulatePayment = async (invoiceId: string, status: "PAID" | "FAILED") => {
    setProcessing(true);
    try {
      await api.simulatePayment(invoiceId, status);
      toastSuccess(
        "Pembayaran",
        `Invoice berhasil di-${status === "PAID" ? "bayar" : "gagalkan"}.`
      );
      await loadData();
    } catch (error: any) {
      toastError("Gagal", error?.message || "Gagal memproses pembayaran.");
    } finally {
      setProcessing(false);
    }
  };

  const handleVoidInvoice = async () => {
    if (!voidInvoiceTarget) return;
    setProcessing(true);
    try {
      await api.voidInvoice(voidInvoiceTarget.id);
      toastSuccess(
        "Berhasil",
        `Invoice ${voidInvoiceTarget.invoiceNumber} berhasil di-void.`
      );
      setVoidDialogOpen(false);
      setVoidInvoiceTarget(null);
      await loadData();
    } catch (error: any) {
      toastError("Gagal", error?.message || "Gagal void invoice.");
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!markPaidTarget) return;
    setProcessing(true);
    try {
      await api.markInvoicePaid(markPaidTarget.id);
      toastSuccess(
        "Berhasil",
        `Invoice ${markPaidTarget.invoiceNumber} ditandai lunas.`
      );
      setMarkPaidDialogOpen(false);
      setMarkPaidTarget(null);
      await loadData();
    } catch (error: any) {
      toastError("Gagal", error?.message || "Gagal menandai invoice lunas.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Invoices</h1>
        <p className="text-muted-foreground">Daftar invoice & QR pembayaran</p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari no. invoice atau no. kontrak..."
            value={pagination.search}
            onChange={(e) => pagination.setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="VOID">Void</SelectItem>
          </SelectContent>
        </Select>
        {pagination.total > 0 && (
          <span className="text-sm text-muted-foreground self-center">{pagination.total} invoice</span>
        )}
      </div>

      {!loading && invoices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {pagination.debouncedSearch || statusFilter !== "ALL"
                ? "Tidak ada invoice yang cocok dengan filter."
                : "Belum ada invoice. Invoice otomatis dibuat saat kontrak baru dibuat."}
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
                    <SortableHeader label="No. Invoice" field="invoiceNumber" currentSortBy={pagination.sortBy} currentSortOrder={pagination.sortOrder} onSort={pagination.handleSort} />
                    <th className="text-left p-4 text-sm font-medium">No. Kontrak</th>
                    <SortableHeader label="Amount" field="amount" currentSortBy={pagination.sortBy} currentSortOrder={pagination.sortOrder} onSort={pagination.handleSort} />
                    <SortableHeader label="Status" field="status" currentSortBy={pagination.sortBy} currentSortOrder={pagination.sortOrder} onSort={pagination.handleSort} />
                    <SortableHeader label="Due Date" field="dueDate" currentSortBy={pagination.sortBy} currentSortOrder={pagination.sortOrder} onSort={pagination.handleSort} />
                    <th className="text-left p-4 text-sm font-medium">Paid At</th>
                    <th className="text-right p-4 text-sm font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="p-4">
                            <div className="h-4 bg-muted animate-pulse rounded" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    invoices.map((invoice) => {
                      const totalAmount = invoice.amount + (invoice.lateFee || 0);
                      const hasLateFee = (invoice.lateFee || 0) > 0;
                      return (
                        <tr key={invoice.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="p-4 font-mono text-sm">{invoice.invoiceNumber}</td>
                          <td className="p-4 font-mono text-sm text-muted-foreground">
                            {getContractNumber(invoice.contractId)}
                          </td>
                          <td className="p-4 text-sm font-medium">
                            <div>
                              {formatCurrency(totalAmount)}
                              {hasLateFee && (
                                <span className="ml-1 text-xs text-orange-600 font-normal">(+denda)</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant={statusBadgeVariant(invoice.status)}>
                              {invoice.status}
                            </Badge>
                          </td>
                          <td className="p-4 text-sm text-muted-foreground">
                            {formatDate(invoice.dueDate)}
                          </td>
                          <td className="p-4 text-sm text-muted-foreground">
                            {invoice.paidAt ? formatDate(invoice.paidAt) : "-"}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex gap-1 justify-end flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => showQR(invoice)}
                              >
                                {invoice.status === "PAID" ? (
                                  <><CheckCircle2 className="h-4 w-4 mr-1" /> Bukti</>
                                ) : (
                                  <><QrCode className="h-4 w-4 mr-1" /> QR</>
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const blob = await api.downloadInvoicePdf(invoice.id);
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.href = url;
                                    a.download = `invoice-${invoice.invoiceNumber}.pdf`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                  } catch (err: any) {
                                    toastError("Gagal", err?.message || "Gagal mengunduh PDF.");
                                  }
                                }}
                                title="Download PDF"
                              >
                                <FileDown className="h-4 w-4" />
                              </Button>
                              {invoice.status === "PENDING" && (
                                <>
                                  <Button
                                    variant="success"
                                    size="sm"
                                    disabled={processing}
                                    onClick={() => simulatePayment(invoice.id, "PAID")}
                                  >
                                    <CheckCircle2 className="h-4 w-4 mr-1" /> Bayar
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={processing}
                                    onClick={() => simulatePayment(invoice.id, "FAILED")}
                                  >
                                    <XCircle className="h-4 w-4 mr-1" /> Gagalkan
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={processing}
                                    onClick={() => {
                                      setVoidInvoiceTarget(invoice);
                                      setVoidDialogOpen(true);
                                    }}
                                  >
                                    <FileX className="h-4 w-4 mr-1" /> Void
                                  </Button>
                                </>
                              )}
                              {invoice.status === "FAILED" && (
                                <>
                                  <Button
                                    variant="success"
                                    size="sm"
                                    disabled={processing}
                                    onClick={() => {
                                      setMarkPaidTarget(invoice);
                                      setMarkPaidDialogOpen(true);
                                    }}
                                  >
                                    <CheckCircle2 className="h-4 w-4 mr-1" /> Tandai Lunas
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={processing}
                                    onClick={() => {
                                      setVoidInvoiceTarget(invoice);
                                      setVoidDialogOpen(true);
                                    }}
                                  >
                                    <FileX className="h-4 w-4 mr-1" /> Void
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={pagination.setPage} />
          </CardContent>
        </Card>
      )}

      {/* QR / Receipt Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {selectedInvoice?.status === "PAID" ? "Bukti Pembayaran" : "QR Pembayaran"}
            </DialogTitle>
            <DialogDescription>
              Invoice: {selectedInvoice?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice?.status === "PAID" ? (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-bold text-green-700 dark:text-green-400">Pembayaran Berhasil</p>
                  <p className="text-sm text-green-600 dark:text-green-500">
                    {selectedInvoice.paidAt ? formatDateTime(selectedInvoice.paidAt) : "-"}
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">No. Invoice</span>
                  <span className="font-mono">{selectedInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jumlah</span>
                  <span className="font-bold text-primary">
                    {formatCurrency(selectedInvoice.amount + (selectedInvoice.lateFee || 0))}
                  </span>
                </div>
                {(selectedInvoice.lateFee || 0) > 0 && (
                  <>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Pokok</span>
                      <span>{formatCurrency(selectedInvoice.amount)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Denda keterlambatan</span>
                      <span>{formatCurrency(selectedInvoice.lateFee || 0)}</span>
                    </div>
                  </>
                )}
                {selectedInvoice.extensionDays && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Perpanjangan</span>
                    <span>{selectedInvoice.extensionDays} hari</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Penerima</span>
                  <span>WEDISON Motor Listrik</span>
                </div>
              </div>
              {qrCode && (
                <div className="flex flex-col items-center pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Referensi QR</p>
                  <img src={qrCode} alt="QR Code" className="w-32 h-32 opacity-60" />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              {qrCode && <img src={qrCode} alt="QR Code" className="w-64 h-64" />}
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {selectedInvoice && formatCurrency(selectedInvoice.amount + (selectedInvoice.lateFee || 0))}
                </p>
                {selectedInvoice && (selectedInvoice.lateFee || 0) > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Pokok {formatCurrency(selectedInvoice.amount)} + Denda {formatCurrency(selectedInvoice.lateFee || 0)}
                  </p>
                )}
                <p className="text-sm text-muted-foreground mt-1">WEDISON Motor Listrik</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Void Invoice Confirmation Dialog */}
      <Dialog
        open={voidDialogOpen}
        onOpenChange={(open) => {
          setVoidDialogOpen(open);
          if (!open) setVoidInvoiceTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileX className="h-5 w-5" /> Void Invoice
            </DialogTitle>
            <DialogDescription>
              Void invoice {voidInvoiceTarget?.invoiceNumber}? Invoice yang di-void tidak dapat dibayar.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1">
            <p><strong>Invoice:</strong> {voidInvoiceTarget?.invoiceNumber}</p>
            <p>
              <strong>Jumlah:</strong>{" "}
              {voidInvoiceTarget && formatCurrency(voidInvoiceTarget.amount + (voidInvoiceTarget.lateFee || 0))}
            </p>
            {voidInvoiceTarget?.extensionDays && (
              <p><strong>Perpanjangan:</strong> {voidInvoiceTarget.extensionDays} hari</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setVoidDialogOpen(false);
                setVoidInvoiceTarget(null);
              }}
            >
              Batal
            </Button>
            <Button variant="destructive" onClick={handleVoidInvoice} disabled={processing}>
              {processing ? "Memproses..." : "Ya, Void Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Paid Confirmation Dialog */}
      <Dialog
        open={markPaidDialogOpen}
        onOpenChange={(open) => {
          setMarkPaidDialogOpen(open);
          if (!open) setMarkPaidTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" /> Tandai Lunas
            </DialogTitle>
            <DialogDescription>
              Tandai invoice {markPaidTarget?.invoiceNumber} sebagai lunas secara manual?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-4 text-sm space-y-1">
            <p><strong>Invoice:</strong> {markPaidTarget?.invoiceNumber}</p>
            <p>
              <strong>Jumlah:</strong>{" "}
              {markPaidTarget && formatCurrency(markPaidTarget.amount + (markPaidTarget.lateFee || 0))}
            </p>
            {markPaidTarget?.extensionDays && (
              <p><strong>Perpanjangan:</strong> {markPaidTarget.extensionDays} hari (akan diterapkan ke kontrak)</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMarkPaidDialogOpen(false);
                setMarkPaidTarget(null);
              }}
            >
              Batal
            </Button>
            <Button variant="success" onClick={handleMarkPaid} disabled={processing}>
              {processing ? "Memproses..." : "Ya, Tandai Lunas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
