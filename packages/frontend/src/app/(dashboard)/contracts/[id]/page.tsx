"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { Contract, Customer, Invoice } from "@/types";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  User,
  Bike,
  Calendar,
  Clock,
  CreditCard,
  QrCode,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Trophy,
  Target,
  Pencil,
  Ban,
  FileX,
  FileDown,
  History,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toastSuccess, toastError } from "@/stores/toastStore";

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case "ACTIVE": return "default" as const;
    case "COMPLETED": return "success" as const;
    case "OVERDUE": return "destructive" as const;
    case "CANCELLED": return "secondary" as const;
    case "REPOSSESSED": return "destructive" as const;
    default: return "outline" as const;
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case "ACTIVE": return "Aktif";
    case "COMPLETED": return "Lunas (Milik Customer)";
    case "OVERDUE": return "Terlambat";
    case "CANCELLED": return "Dibatalkan";
    case "REPOSSESSED": return "Motor Ditarik";
    default: return status;
  }
};

const paymentBadgeVariant = (status: string) => {
  switch (status) {
    case "PENDING": return "warning" as const;
    case "PAID": return "success" as const;
    case "FAILED": return "destructive" as const;
    case "VOID": return "secondary" as const;
    default: return "outline" as const;
  }
};

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [contract, setContract] = useState<Contract | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [qrInvoice, setQrInvoice] = useState<Invoice | null>(null);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [extendDays, setExtendDays] = useState("7");
  const [repossessDialogOpen, setRepossessDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editGracePeriod, setEditGracePeriod] = useState("");
  const [editOwnershipTarget, setEditOwnershipTarget] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidInvoiceTarget, setVoidInvoiceTarget] = useState<Invoice | null>(null);
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false);
  const [markPaidTarget, setMarkPaidTarget] = useState<Invoice | null>(null);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const data = await api.getContractDetail(id);
      setContract(data.contract);
      setCustomer(data.customer);
      setInvoices(data.invoices || []);
    } catch (error) {
      console.error("Failed to load contract detail:", error);
    } finally {
      setLoading(false);
    }
  };

  const showQR = async (invoice: Invoice) => {
    try {
      const data = await api.getInvoiceQR(invoice.id);
      setQrCode(data.qrCode);
      setQrInvoice(invoice);
      setQrDialogOpen(true);
    } catch (error: any) {
      toastError("Gagal", error?.message || "Gagal membuat QR code.");
    }
  };

  const simulatePayment = async (invoiceId: string, status: "PAID" | "FAILED") => {
    setProcessing(true);
    try {
      await api.simulatePayment(invoiceId, status);
      toastSuccess("Pembayaran", `Invoice berhasil di-${status === "PAID" ? "bayar" : "gagalkan"}.`);
      await loadData();
    } catch (error: any) {
      toastError("Gagal", error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleExtend = async () => {
    setProcessing(true);
    try {
      await api.extendContract(id, parseInt(extendDays));
      toastSuccess("Perpanjangan", `Kontrak berhasil diperpanjang ${extendDays} hari.`);
      setExtendDialogOpen(false);
      await loadData();
    } catch (error: any) {
      toastError("Gagal", error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleRepossess = async () => {
    setProcessing(true);
    try {
      await api.repossessContract(id);
      toastSuccess("Penarikan", "Motor berhasil ditarik (repossessed).");
      setRepossessDialogOpen(false);
      await loadData();
    } catch (error: any) {
      toastError("Gagal", error.message);
    } finally {
      setProcessing(false);
    }
  };

  const openEditDialog = () => {
    if (!contract) return;
    setEditNotes(contract.notes || "");
    setEditGracePeriod(contract.gracePeriodDays.toString());
    setEditOwnershipTarget(contract.ownershipTargetDays.toString());
    setEditDialogOpen(true);
  };

  const handleEdit = async () => {
    setProcessing(true);
    try {
      await api.editContract(id, {
        notes: editNotes,
        gracePeriodDays: parseInt(editGracePeriod),
        ownershipTargetDays: parseInt(editOwnershipTarget),
      });
      toastSuccess("Berhasil", "Kontrak berhasil diperbarui.");
      setEditDialogOpen(false);
      await loadData();
    } catch (error: any) {
      toastError("Gagal", error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toastError("Gagal", "Alasan pembatalan wajib diisi.");
      return;
    }
    setProcessing(true);
    try {
      await api.cancelContract(id, cancelReason);
      toastSuccess("Dibatalkan", "Kontrak berhasil dibatalkan.");
      setCancelDialogOpen(false);
      setCancelReason("");
      await loadData();
    } catch (error: any) {
      toastError("Gagal", error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleVoidInvoice = async () => {
    if (!voidInvoiceTarget) return;
    setProcessing(true);
    try {
      await api.voidInvoice(voidInvoiceTarget.id);
      toastSuccess("Berhasil", `Invoice ${voidInvoiceTarget.invoiceNumber} berhasil di-void.`);
      setVoidDialogOpen(false);
      setVoidInvoiceTarget(null);
      await loadData();
    } catch (error: any) {
      toastError("Gagal", error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!markPaidTarget) return;
    setProcessing(true);
    try {
      await api.markInvoicePaid(markPaidTarget.id);
      toastSuccess("Berhasil", `Invoice ${markPaidTarget.invoiceNumber} ditandai lunas.`);
      setMarkPaidDialogOpen(false);
      setMarkPaidTarget(null);
      await loadData();
    } catch (error: any) {
      toastError("Gagal", error.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!contract || !customer) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Kontrak tidak ditemukan.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/contracts")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
        </Button>
      </div>
    );
  }

  const canExtend = contract.status === "ACTIVE" || contract.status === "OVERDUE";
  const canRepossess = contract.status === "ACTIVE" || contract.status === "OVERDUE";
  const canCancel = contract.status === "ACTIVE" || contract.status === "OVERDUE";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/contracts")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono">{contract.contractNumber}</h1>
              <Badge variant={statusBadgeVariant(contract.status)} className="text-sm">
                {statusLabel(contract.status)}
              </Badge>
            </div>
            <p className="text-muted-foreground">Detail kontrak RTO</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={openEditDialog}>
            <Pencil className="h-4 w-4 mr-2" /> Edit
          </Button>
          {canExtend && (
            <Button onClick={() => setExtendDialogOpen(true)}>
              <RefreshCw className="h-4 w-4 mr-2" /> Perpanjang Sewa
            </Button>
          )}
          {canCancel && (
            <Button variant="outline" className="text-orange-600 border-orange-300 hover:bg-orange-50" onClick={() => setCancelDialogOpen(true)}>
              <Ban className="h-4 w-4 mr-2" /> Batalkan
            </Button>
          )}
          {canRepossess && (
            <Button variant="destructive" onClick={() => setRepossessDialogOpen(true)}>
              <AlertTriangle className="h-4 w-4 mr-2" /> Tarik Motor
            </Button>
          )}
        </div>
      </div>

      {/* Ownership Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5" /> Progress Kepemilikan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {contract.totalDaysPaid} / {contract.ownershipTargetDays} hari
              </span>
              <span className="font-bold text-primary">{contract.ownershipProgress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 bg-primary"
                style={{ width: `${Math.min(contract.ownershipProgress, 100)}%` }}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total Hari Dibayar</p>
                <p className="font-bold text-lg">{contract.totalDaysPaid}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Target Kepemilikan</p>
                <p className="font-bold text-lg">{contract.ownershipTargetDays} hari</p>
              </div>
              <div>
                <p className="text-muted-foreground">Sisa Hari</p>
                <p className="font-bold text-lg">{Math.max(0, contract.ownershipTargetDays - contract.totalDaysPaid)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Dibayar</p>
                <p className="font-bold text-lg text-primary">{formatCurrency(contract.totalAmount)}</p>
              </div>
            </div>
            {contract.status === "COMPLETED" && contract.completedAt && (
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-4 flex items-center gap-3">
                <Trophy className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-bold text-green-700 dark:text-green-400">Motor Resmi Milik Customer!</p>
                  <p className="text-sm text-green-600 dark:text-green-500">
                    Tanggal kepemilikan: {formatDate(contract.completedAt)}
                  </p>
                </div>
              </div>
            )}
            {contract.status === "REPOSSESSED" && contract.repossessedAt && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-4 flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-red-600" />
                <div>
                  <p className="font-bold text-red-700 dark:text-red-400">Motor Telah Ditarik</p>
                  <p className="text-sm text-red-600 dark:text-red-500">
                    Tanggal penarikan: {formatDate(contract.repossessedAt)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contract Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bike className="h-5 w-5" /> Detail Kontrak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-muted-foreground">Model Motor</p>
                <p className="text-lg font-bold mt-1">{contract.motorModel}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rate / Hari</p>
                <p className="font-medium mt-1">{formatCurrency(contract.dailyRate)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Periode Aktif</p>
                <p className="font-medium mt-1">{contract.durationDays} hari</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Periode Mulai</p>
                <p className="font-medium mt-1 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> {formatDate(contract.startDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Periode Berakhir</p>
                <p className="font-medium mt-1 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> {formatDate(contract.endDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Grace Period</p>
                <p className="font-medium mt-1">{contract.gracePeriodDays} hari</p>
              </div>
            </div>
            {contract.notes && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground">Catatan</p>
                <p className="text-sm mt-1">{contract.notes}</p>
              </div>
            )}
            <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
              Dibuat: {formatDateTime(contract.createdAt)}
            </div>
          </CardContent>
        </Card>

        {/* Customer Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" /> Customer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-bold text-lg">{customer.fullName}</p>
            </div>
            <div className="text-sm space-y-2">
              <p className="text-muted-foreground">{customer.phone}</p>
              {customer.email && <p className="text-muted-foreground">{customer.email}</p>}
              <p className="text-muted-foreground">{customer.address}</p>
              <p className="font-mono text-xs">{customer.ktpNumber}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={() => router.push(`/customers/${customer.id}`)}
            >
              Lihat Detail Customer
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Payment Timeline */}
      {invoices.filter(inv => inv.status === "PAID").length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5" /> Timeline Pembayaran
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative pl-6 space-y-6">
              <div className="absolute left-2 top-1 bottom-1 w-0.5 bg-muted" />
              {invoices
                .filter(inv => inv.status === "PAID")
                .sort((a, b) => new Date(a.paidAt || a.createdAt).getTime() - new Date(b.paidAt || b.createdAt).getTime())
                .map((inv, idx) => (
                  <div key={inv.id} className="relative">
                    <div className="absolute -left-[17px] top-1 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">
                          {idx === 0 && inv.extensionDays
                            ? `Kontrak awal (${inv.extensionDays} hari)`
                            : inv.extensionDays
                            ? `Perpanjangan ${inv.extensionDays} hari`
                            : `Pembayaran ${inv.invoiceNumber}`
                          }
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {inv.paidAt ? formatDateTime(inv.paidAt) : formatDateTime(inv.createdAt)}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-green-600 whitespace-nowrap">
                        {formatCurrency(inv.amount + (inv.lateFee || 0))}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Riwayat Invoice ({invoices.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Belum ada invoice.</p>
          ) : (
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-medium">{invoice.invoiceNumber}</span>
                      <Badge variant={paymentBadgeVariant(invoice.status)}>
                        {invoice.status}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">
                        {formatCurrency(invoice.amount + (invoice.lateFee || 0))}
                      </p>
                      {(invoice.lateFee || 0) > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Pokok: {formatCurrency(invoice.amount)} + Denda: {formatCurrency(invoice.lateFee || 0)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground mb-3">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Due: {formatDate(invoice.dueDate)}
                    </div>
                    <div>
                      {invoice.paidAt ? `Dibayar: ${formatDate(invoice.paidAt)}` : "Belum dibayar"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => showQR(invoice)}>
                      {invoice.status === "PAID" ? (
                        <><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Bukti</>
                      ) : (
                        <><QrCode className="h-3.5 w-3.5 mr-1" /> QR</>
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
                      <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
                    </Button>
                    {invoice.status === "PENDING" && (
                      <>
                        <Button
                          variant="success"
                          size="sm"
                          disabled={processing}
                          onClick={() => simulatePayment(invoice.id, "PAID")}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Bayar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={processing}
                          onClick={() => simulatePayment(invoice.id, "FAILED")}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Gagal
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={processing}
                          onClick={() => { setVoidInvoiceTarget(invoice); setVoidDialogOpen(true); }}
                        >
                          <FileX className="h-3.5 w-3.5 mr-1" /> Void
                        </Button>
                      </>
                    )}
                    {invoice.status === "FAILED" && (
                      <>
                        <Button
                          variant="success"
                          size="sm"
                          disabled={processing}
                          onClick={() => { setMarkPaidTarget(invoice); setMarkPaidDialogOpen(true); }}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Tandai Lunas
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={processing}
                          onClick={() => { setVoidInvoiceTarget(invoice); setVoidDialogOpen(true); }}
                        >
                          <FileX className="h-3.5 w-3.5 mr-1" /> Void
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR / Receipt Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {qrInvoice?.status === "PAID" ? "Bukti Pembayaran" : "QR Pembayaran"}
            </DialogTitle>
            <DialogDescription>
              Invoice: {qrInvoice?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>
          {qrInvoice?.status === "PAID" ? (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-bold text-green-700 dark:text-green-400">Pembayaran Berhasil</p>
                  <p className="text-sm text-green-600 dark:text-green-500">
                    {qrInvoice.paidAt ? formatDateTime(qrInvoice.paidAt) : "-"}
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">No. Invoice</span>
                  <span className="font-mono">{qrInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jumlah</span>
                  <span className="font-bold text-primary">
                    {formatCurrency(qrInvoice.amount + (qrInvoice.lateFee || 0))}
                  </span>
                </div>
                {(qrInvoice.lateFee || 0) > 0 && (
                  <>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Pokok</span>
                      <span>{formatCurrency(qrInvoice.amount)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Denda keterlambatan</span>
                      <span>{formatCurrency(qrInvoice.lateFee || 0)}</span>
                    </div>
                  </>
                )}
                {qrInvoice.extensionDays && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Perpanjangan</span>
                    <span>{qrInvoice.extensionDays} hari</span>
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
                  {qrInvoice && formatCurrency(qrInvoice.amount)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">WEDISON Motor Listrik</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Extend Dialog */}
      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Perpanjang Sewa</DialogTitle>
            <DialogDescription>
              Perpanjang kontrak {contract.contractNumber} (maks 7 hari per perpanjangan).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Durasi Perpanjangan</Label>
              <Select value={extendDays} onValueChange={setExtendDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <SelectItem key={d} value={d.toString()}>
                      {d} hari
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Rate / hari</span>
                <span>{formatCurrency(contract.dailyRate)}</span>
              </div>
              <div className="flex justify-between">
                <span>Durasi</span>
                <span>{extendDays} hari</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-primary">
                  {formatCurrency(contract.dailyRate * parseInt(extendDays))}
                </span>
              </div>
              <div className="border-t pt-2 flex justify-between text-muted-foreground">
                <span>Progress setelah pembayaran</span>
                <span>
                  {contract.totalDaysPaid + parseInt(extendDays)} / {contract.ownershipTargetDays} hari
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleExtend} disabled={processing}>
              {processing ? "Memproses..." : "Perpanjang"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Repossess Confirmation Dialog */}
      <Dialog open={repossessDialogOpen} onOpenChange={setRepossessDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Tarik Motor
            </DialogTitle>
            <DialogDescription>
              Apakah anda yakin ingin menarik motor untuk kontrak {contract.contractNumber}?
              Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-destructive/10 rounded-lg p-4 text-sm space-y-1">
            <p><strong>Customer:</strong> {customer.fullName}</p>
            <p><strong>Motor:</strong> {contract.motorModel}</p>
            <p><strong>Progress:</strong> {contract.ownershipProgress}% ({contract.totalDaysPaid}/{contract.ownershipTargetDays} hari)</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepossessDialogOpen(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleRepossess} disabled={processing}>
              {processing ? "Memproses..." : "Ya, Tarik Motor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Contract Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Kontrak</DialogTitle>
            <DialogDescription>
              Edit kontrak {contract.contractNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Catatan kontrak..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Grace Period (hari)</Label>
              <Input
                type="number"
                min={0}
                value={editGracePeriod}
                onChange={(e) => setEditGracePeriod(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Target Kepemilikan (hari)</Label>
              <Input
                type="number"
                min={1}
                value={editOwnershipTarget}
                onChange={(e) => setEditOwnershipTarget(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Progress saat ini: {contract.totalDaysPaid} / {editOwnershipTarget || contract.ownershipTargetDays} hari
                ({editOwnershipTarget ? ((contract.totalDaysPaid / parseInt(editOwnershipTarget || "1")) * 100).toFixed(1) : contract.ownershipProgress}%)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleEdit} disabled={processing}>
              {processing ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Contract Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <Ban className="h-5 w-5" /> Batalkan Kontrak
            </DialogTitle>
            <DialogDescription>
              Batalkan kontrak {contract.contractNumber}. Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 rounded-lg p-4 text-sm space-y-1">
              <p><strong>Customer:</strong> {customer.fullName}</p>
              <p><strong>Motor:</strong> {contract.motorModel}</p>
              <p><strong>Progress:</strong> {contract.ownershipProgress}%</p>
            </div>
            <div className="space-y-2">
              <Label>Alasan Pembatalan <span className="text-destructive">*</span></Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Masukkan alasan pembatalan..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelDialogOpen(false); setCancelReason(""); }}>
              Kembali
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={handleCancel}
              disabled={processing || !cancelReason.trim()}
            >
              {processing ? "Memproses..." : "Ya, Batalkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Invoice Confirmation Dialog */}
      <Dialog open={voidDialogOpen} onOpenChange={(open) => { setVoidDialogOpen(open); if (!open) setVoidInvoiceTarget(null); }}>
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
            <p><strong>Jumlah:</strong> {voidInvoiceTarget && formatCurrency(voidInvoiceTarget.amount)}</p>
            {voidInvoiceTarget?.extensionDays && (
              <p><strong>Perpanjangan:</strong> {voidInvoiceTarget.extensionDays} hari</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setVoidDialogOpen(false); setVoidInvoiceTarget(null); }}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleVoidInvoice} disabled={processing}>
              {processing ? "Memproses..." : "Ya, Void Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Paid Confirmation Dialog */}
      <Dialog open={markPaidDialogOpen} onOpenChange={(open) => { setMarkPaidDialogOpen(open); if (!open) setMarkPaidTarget(null); }}>
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
            <p><strong>Jumlah:</strong> {markPaidTarget && formatCurrency(markPaidTarget.amount)}</p>
            {markPaidTarget?.extensionDays && (
              <p><strong>Perpanjangan:</strong> {markPaidTarget.extensionDays} hari (akan diterapkan ke kontrak)</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMarkPaidDialogOpen(false); setMarkPaidTarget(null); }}>
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
