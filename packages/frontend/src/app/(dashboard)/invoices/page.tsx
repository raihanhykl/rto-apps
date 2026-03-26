'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { SortableHeader } from '@/components/SortableHeader';
import { usePagination } from '@/hooks/usePagination';
import { usePaymentsPaginated, useContractsList, useInvalidate } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { Invoice, Contract, InvoiceType } from '@/types';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { toastSuccess, toastError } from '@/stores/toastStore';
import {
  Receipt,
  QrCode,
  Search,
  CheckCircle2,
  FileDown,
  XCircle,
  FileX,
  Undo2,
  X,
  Eye,
  CalendarDays,
  Clock,
} from 'lucide-react';

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case 'PENDING':
      return 'warning' as const;
    case 'PAID':
      return 'success' as const;
    case 'FAILED':
      return 'destructive' as const;
    case 'EXPIRED':
      return 'secondary' as const;
    case 'VOID':
      return 'secondary' as const;
    default:
      return 'outline' as const;
  }
};

const getInvoiceTypeLabel = (type: string): string => {
  switch (type) {
    case 'DP':
      return 'DP';
    case 'DP_INSTALLMENT':
      return 'DP Cicilan';
    case 'DAILY_BILLING':
      return 'Harian';
    case 'MANUAL_PAYMENT':
      return 'Manual';
    default:
      return type;
  }
};

const getInvoiceTypeBadgeVariant = (type: string) => {
  switch (type) {
    case 'DP':
    case 'DP_INSTALLMENT':
      return 'default' as const;
    case 'DAILY_BILLING':
      return 'outline' as const;
    case 'MANUAL_PAYMENT':
      return 'secondary' as const;
    default:
      return 'outline' as const;
  }
};

const formatPeriod = (invoice: Invoice): string => {
  if (!invoice.periodStart) return '-';
  const start = formatDate(invoice.periodStart);
  if (!invoice.periodEnd || invoice.periodStart === invoice.periodEnd) return start;
  return `${start} - ${formatDate(invoice.periodEnd)}`;
};

export default function InvoicesPage() {
  const invalidate = useInvalidate();
  const [processing, setProcessing] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidInvoiceTarget, setVoidInvoiceTarget] = useState<Invoice | null>(null);
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false);
  const [markPaidTarget, setMarkPaidTarget] = useState<Invoice | null>(null);
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [revertTarget, setRevertTarget] = useState<Invoice | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Invoice | null>(null);

  const pagination = usePagination({ initialSortBy: 'createdAt', initialSortOrder: 'desc' });

  const { data: invoicesData, isLoading: loading } = usePaymentsPaginated({
    page: pagination.page,
    limit: pagination.limit,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
    search: pagination.debouncedSearch || undefined,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    invoiceType: invoiceTypeFilter !== 'ALL' ? invoiceTypeFilter : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });
  const invoices = (invoicesData?.data as Invoice[]) || [];

  useEffect(() => {
    if (invoicesData) pagination.updateFromResult(invoicesData);
  }, [invoicesData]);

  const { data: contracts = [] as Contract[] } = useContractsList();

  const handleFilterChange = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    pagination.setPage(1);
  };

  const hasActiveFilters =
    statusFilter !== 'ALL' || invoiceTypeFilter !== 'ALL' || !!startDate || !!endDate;

  const clearAllFilters = () => {
    setStatusFilter('ALL');
    setInvoiceTypeFilter('ALL');
    setStartDate('');
    setEndDate('');
    pagination.setPage(1);
  };

  const getContractNumber = (contractId: string) => {
    return contracts.find((c) => c.id === contractId)?.contractNumber || '-';
  };

  const showQR = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    try {
      const data = await api.getPaymentQR(invoice.id);
      setQrCode(data.qrCode);
      setQrDialogOpen(true);
    } catch (error: any) {
      toastError('Gagal', error?.message || 'Gagal membuat QR code.');
    }
  };

  const simulatePayment = async (invoiceId: string, status: 'PAID' | 'FAILED') => {
    setProcessing(true);
    try {
      await api.simulatePayment(invoiceId, status);
      toastSuccess(
        'Pembayaran',
        `Tagihan berhasil di-${status === 'PAID' ? 'bayar' : 'gagalkan'}.`,
      );
      invalidate('/contracts', '/payments', '/dashboard');
    } catch (error: any) {
      toastError('Gagal', error?.message || 'Gagal memproses pembayaran.');
    } finally {
      setProcessing(false);
    }
  };

  const handleVoidInvoice = async () => {
    if (!voidInvoiceTarget) return;
    setProcessing(true);
    try {
      await api.voidPayment(voidInvoiceTarget.id);
      toastSuccess('Berhasil', `Tagihan ${voidInvoiceTarget.invoiceNumber} berhasil di-void.`);
      setVoidDialogOpen(false);
      setVoidInvoiceTarget(null);
      invalidate('/contracts', '/payments', '/dashboard');
    } catch (error: any) {
      toastError('Gagal', error?.message || 'Gagal void tagihan.');
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!markPaidTarget) return;
    setProcessing(true);
    try {
      await api.markPaymentPaid(markPaidTarget.id);
      toastSuccess('Berhasil', `Tagihan ${markPaidTarget.invoiceNumber} ditandai lunas.`);
      setMarkPaidDialogOpen(false);
      setMarkPaidTarget(null);
      invalidate('/contracts', '/payments', '/dashboard');
    } catch (error: any) {
      toastError('Gagal', error?.message || 'Gagal menandai tagihan lunas.');
    } finally {
      setProcessing(false);
    }
  };

  const handleRevertInvoice = async () => {
    if (!revertTarget) return;
    setProcessing(true);
    try {
      await api.revertPaymentStatus(revertTarget.id);
      toastSuccess('Berhasil', `Tagihan ${revertTarget.invoiceNumber} dikembalikan ke PENDING.`);
      setRevertDialogOpen(false);
      setRevertTarget(null);
      invalidate('/contracts', '/payments', '/dashboard');
    } catch (error: any) {
      toastError('Gagal', error?.message || 'Gagal me-revert tagihan.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tagihan</h1>
        <p className="text-muted-foreground">Daftar tagihan & QR pembayaran</p>
      </div>

      {/* Search & Filters */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari no. tagihan atau no. kontrak..."
              value={pagination.search}
              onChange={(e) => pagination.setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
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
          <Select
            value={invoiceTypeFilter}
            onValueChange={handleFilterChange(setInvoiceTypeFilter)}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Tipe</SelectItem>
              <SelectItem value="DP">DP</SelectItem>
              <SelectItem value="DP_INSTALLMENT">DP Cicilan</SelectItem>
              <SelectItem value="DAILY_BILLING">Tagihan Harian</SelectItem>
              <SelectItem value="MANUAL_PAYMENT">Pembayaran Manual</SelectItem>
            </SelectContent>
          </Select>
          {pagination.total > 0 && (
            <span className="text-sm text-muted-foreground self-center">
              {pagination.total} tagihan
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <Label className="text-xs">Dari Tanggal</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                pagination.setPage(1);
              }}
              className="w-40"
            />
          </div>
          <div>
            <Label className="text-xs">Sampai Tanggal</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                pagination.setPage(1);
              }}
              className="w-40"
            />
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-muted-foreground"
            >
              <X className="h-4 w-4 mr-1" /> Reset Filter
            </Button>
          )}
        </div>
      </div>

      {!loading && invoices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {pagination.debouncedSearch || hasActiveFilters
                ? 'Tidak ada tagihan yang cocok dengan filter.'
                : 'Belum ada tagihan.'}
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
                    <SortableHeader
                      label="No. Tagihan"
                      field="invoiceNumber"
                      currentSortBy={pagination.sortBy}
                      currentSortOrder={pagination.sortOrder}
                      onSort={pagination.handleSort}
                    />
                    <th className="text-left p-4 text-sm font-medium">No. Kontrak</th>
                    <th className="text-left p-4 text-sm font-medium">Tipe</th>
                    <SortableHeader
                      label="Amount"
                      field="amount"
                      currentSortBy={pagination.sortBy}
                      currentSortOrder={pagination.sortOrder}
                      onSort={pagination.handleSort}
                    />
                    <th className="text-left p-4 text-sm font-medium">Periode</th>
                    <SortableHeader
                      label="Status"
                      field="status"
                      currentSortBy={pagination.sortBy}
                      currentSortOrder={pagination.sortOrder}
                      onSort={pagination.handleSort}
                    />
                    <SortableHeader
                      label="Dibayar"
                      field="paidAt"
                      currentSortBy={pagination.sortBy}
                      currentSortOrder={pagination.sortOrder}
                      onSort={pagination.handleSort}
                    />
                    <th className="text-right p-4 text-sm font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b">
                          {Array.from({ length: 8 }).map((_, j) => (
                            <td key={j} className="p-4">
                              <div className="h-4 bg-muted animate-pulse rounded" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : invoices.map((invoice) => {
                        const totalAmount = invoice.amount + (invoice.lateFee || 0);
                        const hasLateFee = (invoice.lateFee || 0) > 0;
                        return (
                          <tr
                            key={invoice.id}
                            className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                            onClick={() => {
                              setDetailTarget(invoice);
                              setDetailDialogOpen(true);
                            }}
                          >
                            <td className="p-4 font-mono text-sm">{invoice.invoiceNumber}</td>
                            <td className="p-4 font-mono text-sm text-muted-foreground">
                              {getContractNumber(invoice.contractId)}
                            </td>
                            <td className="p-4">
                              <Badge variant={getInvoiceTypeBadgeVariant(invoice.type)}>
                                {getInvoiceTypeLabel(invoice.type)}
                              </Badge>
                              {invoice.isHoliday && (
                                <Badge
                                  variant="outline"
                                  className="ml-1 text-blue-600 border-blue-300"
                                >
                                  Libur
                                </Badge>
                              )}
                            </td>
                            <td className="p-4 text-sm">
                              <div className="font-medium">{formatCurrency(totalAmount)}</div>
                              {hasLateFee && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {formatCurrency(invoice.amount)} +{' '}
                                  <span className="text-orange-600">
                                    {formatCurrency(invoice.lateFee)}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="p-4 text-sm text-muted-foreground">
                              {formatPeriod(invoice)}
                              {invoice.daysCount && invoice.daysCount > 1 && (
                                <span className="ml-1 text-xs">({invoice.daysCount} hari)</span>
                              )}
                            </td>
                            <td className="p-4">
                              <Badge variant={statusBadgeVariant(invoice.status)}>
                                {invoice.status}
                              </Badge>
                            </td>
                            <td className="p-4 text-sm text-muted-foreground">
                              {invoice.paidAt ? formatDateTime(invoice.paidAt) : '-'}
                            </td>
                            <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-1 justify-end flex-wrap">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setDetailTarget(invoice);
                                    setDetailDialogOpen(true);
                                  }}
                                  title="Detail"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => showQR(invoice)}>
                                  {invoice.status === 'PAID' ? (
                                    <>
                                      <CheckCircle2 className="h-4 w-4 mr-1" /> Bukti
                                    </>
                                  ) : (
                                    <>
                                      <QrCode className="h-4 w-4 mr-1" /> QR
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      const blob = await api.downloadPaymentPdf(invoice.id);
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = `invoice-${invoice.invoiceNumber}.pdf`;
                                      a.click();
                                      URL.revokeObjectURL(url);
                                    } catch (err: any) {
                                      toastError('Gagal', err?.message || 'Gagal mengunduh PDF.');
                                    }
                                  }}
                                  title="Download PDF"
                                >
                                  <FileDown className="h-4 w-4" />
                                </Button>
                                {invoice.status === 'PENDING' && (
                                  <>
                                    <Button
                                      variant="success"
                                      size="sm"
                                      disabled={processing}
                                      onClick={() => simulatePayment(invoice.id, 'PAID')}
                                    >
                                      <CheckCircle2 className="h-4 w-4 mr-1" /> Bayar
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      disabled={processing}
                                      onClick={() => simulatePayment(invoice.id, 'FAILED')}
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
                                {invoice.status === 'FAILED' && (
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
                                {(invoice.status === 'PAID' || invoice.status === 'VOID') && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={processing}
                                    onClick={() => {
                                      setRevertTarget(invoice);
                                      setRevertDialogOpen(true);
                                    }}
                                  >
                                    <Undo2 className="h-4 w-4 mr-1" /> Revert
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={pagination.setPage}
            />
          </CardContent>
        </Card>
      )}

      {/* QR / Receipt Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {selectedInvoice?.status === 'PAID' ? 'Bukti Pembayaran' : 'QR Pembayaran'}
            </DialogTitle>
            <DialogDescription>Tagihan: {selectedInvoice?.invoiceNumber}</DialogDescription>
          </DialogHeader>
          {selectedInvoice?.status === 'PAID' ? (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-bold text-green-700 dark:text-green-400">
                    Pembayaran Berhasil
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-500">
                    {selectedInvoice.paidAt ? formatDateTime(selectedInvoice.paidAt) : '-'}
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">No. Tagihan</span>
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
                    <span className="text-muted-foreground">Tagihan Harian</span>
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
                  {selectedInvoice &&
                    formatCurrency(selectedInvoice.amount + (selectedInvoice.lateFee || 0))}
                </p>
                {selectedInvoice && (selectedInvoice.lateFee || 0) > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Pokok {formatCurrency(selectedInvoice.amount)} + Denda{' '}
                    {formatCurrency(selectedInvoice.lateFee || 0)}
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
              <FileX className="h-5 w-5" /> Void Tagihan
            </DialogTitle>
            <DialogDescription>
              Void tagihan {voidInvoiceTarget?.invoiceNumber}? Tagihan yang di-void tidak dapat
              dibayar.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1">
            <p>
              <strong>Tagihan:</strong> {voidInvoiceTarget?.invoiceNumber}
            </p>
            <p>
              <strong>Jumlah:</strong>{' '}
              {voidInvoiceTarget &&
                formatCurrency(voidInvoiceTarget.amount + (voidInvoiceTarget.lateFee || 0))}
            </p>
            {voidInvoiceTarget?.extensionDays && (
              <p>
                <strong>Tagihan Harian:</strong> {voidInvoiceTarget.extensionDays} hari
              </p>
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
              {processing ? 'Memproses...' : 'Ya, Void Tagihan'}
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
              Tandai tagihan {markPaidTarget?.invoiceNumber} sebagai lunas secara manual?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-4 text-sm space-y-1">
            <p>
              <strong>Tagihan:</strong> {markPaidTarget?.invoiceNumber}
            </p>
            <p>
              <strong>Jumlah:</strong>{' '}
              {markPaidTarget &&
                formatCurrency(markPaidTarget.amount + (markPaidTarget.lateFee || 0))}
            </p>
            {markPaidTarget?.extensionDays && (
              <p>
                <strong>Tagihan Harian:</strong> {markPaidTarget.extensionDays} hari (akan
                diterapkan ke kontrak)
              </p>
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
              {processing ? 'Memproses...' : 'Ya, Tandai Lunas'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revert Invoice Confirmation Dialog */}
      <Dialog
        open={revertDialogOpen}
        onOpenChange={(open) => {
          setRevertDialogOpen(open);
          if (!open) setRevertTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="h-5 w-5 text-orange-600" /> Revert Status
            </DialogTitle>
            <DialogDescription>
              Kembalikan tagihan {revertTarget?.invoiceNumber} ke status PENDING?
              {revertTarget?.status === 'PAID' && ' Perubahan pada kontrak akan di-revert.'}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 rounded-lg p-4 text-sm space-y-1">
            <p>
              <strong>Tagihan:</strong> {revertTarget?.invoiceNumber}
            </p>
            <p>
              <strong>Status saat ini:</strong> {revertTarget?.status}
            </p>
            <p>
              <strong>Jumlah:</strong>{' '}
              {revertTarget && formatCurrency(revertTarget.amount + (revertTarget.lateFee || 0))}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRevertDialogOpen(false);
                setRevertTarget(null);
              }}
            >
              Batal
            </Button>
            <Button variant="destructive" onClick={handleRevertInvoice} disabled={processing}>
              {processing ? 'Memproses...' : 'Ya, Revert'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Payment Dialog */}
      <Dialog
        open={detailDialogOpen}
        onOpenChange={(open) => {
          setDetailDialogOpen(open);
          if (!open) setDetailTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Detail Tagihan
            </DialogTitle>
            <DialogDescription>{detailTarget?.invoiceNumber}</DialogDescription>
          </DialogHeader>
          {detailTarget &&
            (() => {
              const totalAmount = detailTarget.amount + (detailTarget.lateFee || 0);
              const hasLateFee = (detailTarget.lateFee || 0) > 0;
              const isDailyOrManual =
                detailTarget.type === 'DAILY_BILLING' || detailTarget.type === 'MANUAL_PAYMENT';
              return (
                <div className="space-y-4">
                  {/* Status & Tipe */}
                  <div className="flex items-center gap-2">
                    <Badge variant={statusBadgeVariant(detailTarget.status)}>
                      {detailTarget.status}
                    </Badge>
                    <Badge variant={getInvoiceTypeBadgeVariant(detailTarget.type)}>
                      {getInvoiceTypeLabel(detailTarget.type)}
                    </Badge>
                    {detailTarget.isHoliday && (
                      <Badge variant="outline" className="text-blue-600 border-blue-300">
                        Libur Bayar
                      </Badge>
                    )}
                  </div>

                  {/* Breakdown Tagihan */}
                  <div className="rounded-lg border p-4 space-y-2">
                    <p className="text-sm font-medium mb-2">Breakdown Tagihan</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pokok</span>
                      <span>{formatCurrency(detailTarget.amount)}</span>
                    </div>
                    {hasLateFee && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Denda keterlambatan</span>
                        <span className="text-orange-600">
                          {formatCurrency(detailTarget.lateFee)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold border-t pt-2">
                      <span>Total</span>
                      <span className="text-primary">{formatCurrency(totalAmount)}</span>
                    </div>
                  </div>

                  {/* Periode Tagihan (hanya untuk harian/manual) */}
                  {isDailyOrManual && detailTarget.periodStart && (
                    <div className="rounded-lg border p-4 space-y-2">
                      <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4" /> Periode Tagihan
                      </p>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tanggal</span>
                        <span>{formatPeriod(detailTarget)}</span>
                      </div>
                      {detailTarget.daysCount && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Jumlah hari</span>
                          <span>{detailTarget.daysCount} hari</span>
                        </div>
                      )}
                      {detailTarget.dailyRate && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tarif harian</span>
                          <span>{formatCurrency(detailTarget.dailyRate)}/hari</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Waktu Pembayaran */}
                  <div className="rounded-lg border p-4 space-y-2">
                    <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                      <Clock className="h-4 w-4" /> Waktu
                    </p>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Dibuat</span>
                      <span>{formatDateTime(detailTarget.createdAt)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Jatuh tempo</span>
                      <span>{formatDate(detailTarget.dueDate)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Dibayar</span>
                      <span>{detailTarget.paidAt ? formatDateTime(detailTarget.paidAt) : '-'}</span>
                    </div>
                    {detailTarget.expiredAt && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Expired</span>
                        <span className="text-red-600">
                          {formatDateTime(detailTarget.expiredAt)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Informasi Kontrak */}
                  <div className="rounded-lg border p-4 space-y-2">
                    <p className="text-sm font-medium mb-2">Informasi Kontrak</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">No. Kontrak</span>
                      <span className="font-mono">
                        {getContractNumber(detailTarget.contractId)}
                      </span>
                    </div>
                    {detailTarget.previousPaymentId && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tagihan sebelumnya</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {detailTarget.previousPaymentId.slice(0, 8)}...
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
