"use client";

import { useState } from "react";
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
import { useContractDetail, usePaymentsByContract, useActivePayment, useInvalidate } from "@/hooks/useApi";
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
  Package,
  Zap,
  CalendarOff,
  Undo2,
  ChevronDown,
  ChevronUp,
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
import PaymentCalendar from "@/components/PaymentCalendar";

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

const getInvoiceTypeLabel = (type: string): string => {
  switch (type) {
    case "DP": return "DP";
    case "DP_INSTALLMENT": return "DP Cicilan";
    case "DAILY_BILLING": return "Harian";
    case "MANUAL_PAYMENT": return "Manual";
    default: return type;
  }
};

const getInvoiceTypeBadgeVariant = (type: string) => {
  switch (type) {
    case "DP":
    case "DP_INSTALLMENT": return "default" as const;
    case "DAILY_BILLING": return "outline" as const;
    case "MANUAL_PAYMENT": return "secondary" as const;
    default: return "outline" as const;
  }
};

const formatPeriod = (invoice: Invoice): string => {
  if (!invoice.periodStart) return "-";
  const start = formatDate(invoice.periodStart);
  if (!invoice.periodEnd || invoice.periodStart === invoice.periodEnd) return start;
  return `${start} - ${formatDate(invoice.periodEnd)}`;
};

const TIMELINE_PAGE_SIZE = 5;
const TAGIHAN_PAGE_SIZE = 5;

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const invalidate = useInvalidate();

  // SWR hooks
  const { data: detailData, isLoading: detailLoading } = useContractDetail(id);
  const { data: paymentsData } = usePaymentsByContract(id);
  const { data: activePaymentData } = useActivePayment(id);

  const contract = (detailData as any)?.contract as Contract | undefined ?? null;
  const customer = (detailData as any)?.customer as Customer | undefined ?? null;
  const invoices = ((detailData as any)?.invoices as Invoice[] | undefined) || [];
  const payments = (paymentsData as Invoice[] | undefined) || [];
  const activePayment = (activePaymentData as Invoice | undefined) ?? null;
  const loading = detailLoading;

  const refreshAll = () => {
    invalidate("/contracts", "/payments", "/dashboard");
  };

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
  const [editColor, setEditColor] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editVinNumber, setEditVinNumber] = useState("");
  const [editEngineNumber, setEditEngineNumber] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidInvoiceTarget, setVoidInvoiceTarget] = useState<Invoice | null>(null);
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false);
  const [markPaidTarget, setMarkPaidTarget] = useState<Invoice | null>(null);
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [revertTarget, setRevertTarget] = useState<Invoice | null>(null);
  const [receiveUnitDialogOpen, setReceiveUnitDialogOpen] = useState(false);
  const [bastPhoto, setBastPhoto] = useState("");
  const [bastNotes, setBastNotes] = useState("");

  // Collapsible sections
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [tagihanOpen, setTagihanOpen] = useState(true);
  // Pagination
  const [timelinePage, setTimelinePage] = useState(1);
  const [tagihanPage, setTagihanPage] = useState(1);

  const showQR = async (invoice: Invoice) => {
    try {
      const data = await api.getPaymentQR(invoice.id);
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
      toastSuccess("Pembayaran", `Tagihan berhasil di-${status === "PAID" ? "bayar" : "gagalkan"}.`);
      refreshAll();
    } catch (error: any) {
      toastError("Gagal", error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleExtend = async () => {
    setProcessing(true);
    try {
      await api.createManualPayment(id, parseInt(extendDays));
      toastSuccess("Bayar Tagihan", `Tagihan manual ${extendDays} hari berhasil dibuat.`);
      setExtendDialogOpen(false);
      refreshAll();
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
      refreshAll();
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
    setEditColor(contract.color || "");
    setEditYear(contract.year ? contract.year.toString() : "");
    setEditVinNumber(contract.vinNumber || "");
    setEditEngineNumber(contract.engineNumber || "");
    setEditDialogOpen(true);
  };

  const handleEdit = async () => {
    setProcessing(true);
    try {
      await api.editContract(id, {
        notes: editNotes,
        gracePeriodDays: parseInt(editGracePeriod),
        ownershipTargetDays: parseInt(editOwnershipTarget),
        color: editColor,
        year: editYear ? parseInt(editYear, 10) : null,
        vinNumber: editVinNumber,
        engineNumber: editEngineNumber,
      });
      toastSuccess("Berhasil", "Kontrak berhasil diperbarui.");
      setEditDialogOpen(false);
      refreshAll();
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
      refreshAll();
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
      await api.voidPayment(voidInvoiceTarget.id);
      toastSuccess("Berhasil", `Tagihan ${voidInvoiceTarget.invoiceNumber} berhasil di-void.`);
      setVoidDialogOpen(false);
      setVoidInvoiceTarget(null);
      refreshAll();
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
      await api.markPaymentPaid(markPaidTarget.id);
      toastSuccess("Berhasil", `Tagihan ${markPaidTarget.invoiceNumber} ditandai lunas.`);
      setMarkPaidDialogOpen(false);
      setMarkPaidTarget(null);
      refreshAll();
    } catch (error: any) {
      toastError("Gagal", error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleRevertInvoice = async () => {
    if (!revertTarget) return;
    setProcessing(true);
    try {
      await api.revertPaymentStatus(revertTarget.id);
      toastSuccess("Berhasil", `Tagihan ${revertTarget.invoiceNumber} dikembalikan ke PENDING.`);
      setRevertDialogOpen(false);
      setRevertTarget(null);
      refreshAll();
    } catch (error: any) {
      toastError("Gagal", error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReceiveUnit = async () => {
    if (!bastPhoto.trim()) {
      toastError("Gagal", "Foto BAST wajib dilampirkan");
      return;
    }
    setProcessing(true);
    try {
      await api.receiveUnit(id, bastPhoto.trim(), bastNotes.trim());
      toastSuccess("Berhasil", "Unit berhasil diterima. Tagihan harian dimulai H+1.");
      setReceiveUnitDialogOpen(false);
      setBastPhoto("");
      setBastNotes("");
      refreshAll();
    } catch (error: any) {
      toastError("Gagal", error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handlePayPayment = async (paymentId: string) => {
    setProcessing(true);
    try {
      await api.payPayment(paymentId);
      toastSuccess("Berhasil", "Pembayaran berhasil.");
      refreshAll();
    } catch (error: any) {
      toastError("Gagal", error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelPayment = async (paymentId: string) => {
    setProcessing(true);
    try {
      await api.cancelPayment(paymentId);
      toastSuccess("Berhasil", "Pembayaran berhasil dibatalkan.");
      refreshAll();
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

  // Sorted data for timeline and tagihan
  const paidInvoices = invoices
    .filter((inv) => inv.status === "PAID")
    .sort((a, b) => new Date(a.paidAt || a.createdAt).getTime() - new Date(b.paidAt || b.createdAt).getTime());
  const timelineTotalPages = Math.ceil(paidInvoices.length / TIMELINE_PAGE_SIZE);
  const timelineSlice = paidInvoices.slice((timelinePage - 1) * TIMELINE_PAGE_SIZE, timelinePage * TIMELINE_PAGE_SIZE);

  const tagihanTotalPages = Math.ceil(invoices.length / TAGIHAN_PAGE_SIZE);
  const tagihanSlice = invoices.slice((tagihanPage - 1) * TAGIHAN_PAGE_SIZE, tagihanPage * TAGIHAN_PAGE_SIZE);

  const dpInvoices = invoices.filter((inv) => inv.type === "DP" || inv.type === "DP_INSTALLMENT");

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
              <RefreshCw className="h-4 w-4 mr-2" /> Bayar Tagihan
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

      {/* Payment Status Summary - Prominent at top */}
      <Card className={
        contract.status === "COMPLETED" ? "border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20" :
        contract.status === "REPOSSESSED" ? "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20" :
        !contract.dpFullyPaid ? "border-yellow-300 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20" :
        contract.status === "OVERDUE" ? "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20" :
        activePayment ? "border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20" :
        "border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20"
      }>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              {contract.status === "COMPLETED" ? (
                <>
                  <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                    <Trophy className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-bold text-green-700 dark:text-green-400 text-lg">Motor Resmi Milik Customer</p>
                    <p className="text-sm text-green-600 dark:text-green-500">Tanggal kepemilikan: {contract.completedAt && formatDate(contract.completedAt)}</p>
                  </div>
                </>
              ) : contract.status === "REPOSSESSED" ? (
                <>
                  <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <p className="font-bold text-red-700 dark:text-red-400 text-lg">Motor Ditarik</p>
                    <p className="text-sm text-red-600 dark:text-red-500">Tanggal penarikan: {contract.repossessedAt && formatDate(contract.repossessedAt)}</p>
                  </div>
                </>
              ) : contract.status === "CANCELLED" ? (
                <>
                  <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-900/50 flex items-center justify-center">
                    <Ban className="h-6 w-6 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-700 dark:text-gray-400 text-lg">Kontrak Dibatalkan</p>
                  </div>
                </>
              ) : !contract.dpFullyPaid ? (
                <>
                  <div className="h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900/50 flex items-center justify-center">
                    <CreditCard className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-bold text-yellow-700 dark:text-yellow-400 text-lg">Menunggu Pembayaran DP</p>
                    <p className="text-sm text-yellow-600 dark:text-yellow-500">
                      {contract.dpScheme === "FULL" ? "DP Lunas" : "DP Cicilan 2x"} — Terbayar {formatCurrency(contract.dpPaidAmount)} dari {formatCurrency(contract.dpAmount)}
                    </p>
                  </div>
                </>
              ) : !contract.unitReceivedDate ? (
                <>
                  <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                    <Package className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-bold text-blue-700 dark:text-blue-400 text-lg">Menunggu Serah Terima Unit</p>
                    <p className="text-sm text-blue-600 dark:text-blue-500">DP sudah lunas. Unit motor belum diserahkan ke customer.</p>
                  </div>
                </>
              ) : contract.status === "OVERDUE" ? (
                <>
                  <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <p className="font-bold text-red-700 dark:text-red-400 text-lg">Terlambat Bayar</p>
                    <p className="text-sm text-red-600 dark:text-red-500">
                      Customer melewati jatuh tempo. Grace period: {contract.gracePeriodDays} hari.
                    </p>
                  </div>
                </>
              ) : activePayment ? (
                <>
                  <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                    <CreditCard className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-bold text-blue-700 dark:text-blue-400 text-lg">Ada Tagihan Aktif</p>
                    <p className="text-sm text-blue-600 dark:text-blue-500">
                      {formatCurrency(activePayment.amount)} — {activePayment.daysCount} hari ({activePayment.periodStart ? formatDate(activePayment.periodStart) : "-"} s/d {activePayment.periodEnd ? formatDate(activePayment.periodEnd) : "-"})
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-bold text-green-700 dark:text-green-400 text-lg">Pembayaran Lancar</p>
                    <p className="text-sm text-green-600 dark:text-green-500">Tidak ada tunggakan. Tagihan harian berjalan otomatis.</p>
                  </div>
                </>
              )}
            </div>
            {/* Quick Stats */}
            <div className="flex gap-4 text-center">
              <div className="px-4 py-2 rounded-lg bg-white/60 dark:bg-gray-900/40">
                <p className="text-xs text-muted-foreground">Progress</p>
                <p className="font-bold text-lg">{contract.ownershipProgress}%</p>
              </div>
              <div className="px-4 py-2 rounded-lg bg-white/60 dark:bg-gray-900/40">
                <p className="text-xs text-muted-foreground">Hari Dibayar</p>
                <p className="font-bold text-lg">{contract.totalDaysPaid}</p>
              </div>
              <div className="px-4 py-2 rounded-lg bg-white/60 dark:bg-gray-900/40">
                <p className="text-xs text-muted-foreground">Total Bayar</p>
                <p className="font-bold text-lg">{formatCurrency(contract.totalAmount)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Calendar */}
      <PaymentCalendar contractId={id} billingStartDate={contract.billingStartDate} />

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

      {/* Active Payment */}
      {activePayment && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Tagihan Aktif</p>
                <span className="font-mono text-xs">{activePayment.invoiceNumber}</span>
                {activePayment.previousPaymentId && (
                  <span className="ml-2 text-xs text-orange-600 font-medium">(Gabungan)</span>
                )}
                <p className="text-xl font-bold mt-1">{formatCurrency(activePayment.amount)}</p>
                <p className="text-xs text-muted-foreground">
                  {activePayment.daysCount} hari tertunggak — {activePayment.periodStart ? formatDate(activePayment.periodStart) : "-"} s/d {activePayment.periodEnd ? formatDate(activePayment.periodEnd) : "-"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button disabled={processing} onClick={() => handlePayPayment(activePayment.id)}>
                  <Zap className="h-4 w-4 mr-2" /> Bayar Sekarang
                </Button>
                {activePayment.previousPaymentId && (
                  <Button variant="outline" disabled={processing} onClick={() => handleCancelPayment(activePayment.id)}>
                    Batalkan
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                <p className="text-xs text-muted-foreground">Tipe Baterai</p>
                <p className="font-medium mt-1">{contract.batteryType === "EXTENDED" ? "Extended" : "Regular"}</p>
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
            {/* Unit Details */}
            {(contract.color || contract.vinNumber || contract.engineNumber || contract.year) && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground font-semibold uppercase mb-3">Detail Unit</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {contract.color && (
                    <div>
                      <p className="text-xs text-muted-foreground">Warna</p>
                      <p className="font-medium mt-0.5">{contract.color}</p>
                    </div>
                  )}
                  {contract.year && (
                    <div>
                      <p className="text-xs text-muted-foreground">Tahun</p>
                      <p className="font-medium mt-0.5">{contract.year}</p>
                    </div>
                  )}
                  {contract.vinNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground">VIN</p>
                      <p className="font-medium font-mono mt-0.5">{contract.vinNumber}</p>
                    </div>
                  )}
                  {contract.engineNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground">No. Mesin</p>
                      <p className="font-medium font-mono mt-0.5">{contract.engineNumber}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Libur Bayar Info */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm">
                <CalendarOff className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Libur Bayar:</span>
                <span className="font-medium">Setiap Minggu + {contract.holidayDaysPerMonth} hari/bulan</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                Hari libur tetap dihitung sebagai progress kepemilikan tanpa biaya.
              </p>
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

      {/* Payment Timeline (Collapsible + Paginated) */}
      {paidInvoices.length > 0 && (
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => setTimelineOpen(!timelineOpen)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" /> Timeline Pembayaran ({paidInvoices.length})
              </CardTitle>
              {timelineOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
            </div>
          </CardHeader>
          {timelineOpen && (
            <CardContent>
              <div className="relative pl-6 space-y-6">
                <div className="absolute left-2 top-1 bottom-1 w-0.5 bg-muted" />
                {timelineSlice.map((inv, idx) => {
                  const globalIdx = (timelinePage - 1) * TIMELINE_PAGE_SIZE + idx;
                  return (
                    <div key={inv.id} className="relative">
                      <div className="absolute -left-[17px] top-1 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium">
                            {globalIdx === 0 && inv.extensionDays
                              ? `Kontrak awal (${inv.extensionDays} hari)`
                              : inv.type === "DP" || inv.type === "DP_INSTALLMENT"
                              ? `Down Payment${inv.type === "DP_INSTALLMENT" ? " (Cicilan)" : ""}`
                              : inv.extensionDays
                              ? `Bayar Tagihan ${inv.extensionDays} hari`
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
                  );
                })}
              </div>
              {/* Pagination */}
              {timelineTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
                  <Button variant="outline" size="sm" disabled={timelinePage <= 1} onClick={() => setTimelinePage(timelinePage - 1)}>
                    Sebelumnya
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {timelinePage} / {timelineTotalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={timelinePage >= timelineTotalPages} onClick={() => setTimelinePage(timelinePage + 1)}>
                    Selanjutnya
                  </Button>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Riwayat Tagihan (Collapsible + Paginated) */}
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setTagihanOpen(!tagihanOpen)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5" /> Riwayat Tagihan ({invoices.length})
            </CardTitle>
            {tagihanOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
          </div>
        </CardHeader>
        {tagihanOpen && (
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Belum ada tagihan.</p>
            ) : (
              <div className="space-y-4">
                {tagihanSlice.map((invoice) => (
                  <div key={invoice.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-medium">{invoice.invoiceNumber}</span>
                        <Badge variant={paymentBadgeVariant(invoice.status)}>
                          {invoice.status}
                        </Badge>
                        <Badge variant={getInvoiceTypeBadgeVariant(invoice.type)}>
                          {getInvoiceTypeLabel(invoice.type)}
                        </Badge>
                        {invoice.isHoliday && (
                          <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">Libur</Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">
                          {formatCurrency(invoice.amount + (invoice.lateFee || 0))}
                        </p>
                        {(invoice.lateFee || 0) > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(invoice.amount)} + <span className="text-orange-600">{formatCurrency(invoice.lateFee || 0)}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground mb-3">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> Due: {formatDate(invoice.dueDate)}
                      </div>
                      <div>
                        {invoice.paidAt ? `Dibayar: ${formatDateTime(invoice.paidAt)}` : "Belum dibayar"}
                      </div>
                      {invoice.periodStart && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" /> Periode: {formatPeriod(invoice)}
                          {invoice.daysCount && invoice.daysCount > 1 && ` (${invoice.daysCount} hari)`}
                        </div>
                      )}
                      {invoice.dailyRate && (
                        <div>Tarif: {formatCurrency(invoice.dailyRate)}/hari</div>
                      )}
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
                            const blob = await api.downloadPaymentPdf(invoice.id);
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
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Bayar
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
                      {(invoice.status === "PAID" || invoice.status === "VOID") && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={processing}
                          onClick={() => { setRevertTarget(invoice); setRevertDialogOpen(true); }}
                        >
                          <Undo2 className="h-3.5 w-3.5 mr-1" /> Revert
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {/* Pagination */}
                {tagihanTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <Button variant="outline" size="sm" disabled={tagihanPage <= 1} onClick={() => setTagihanPage(tagihanPage - 1)}>
                      Sebelumnya
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {tagihanPage} / {tagihanTotalPages}
                    </span>
                    <Button variant="outline" size="sm" disabled={tagihanPage >= tagihanTotalPages} onClick={() => setTagihanPage(tagihanPage + 1)}>
                      Selanjutnya
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Down Payment & Unit Delivery (merged, at bottom) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" /> Down Payment & Pengiriman Unit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* DP Info */}
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground font-medium uppercase">Down Payment</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Skema DP</p>
                  <p className="font-medium mt-0.5">{contract.dpScheme === "FULL" ? "Lunas" : "Cicilan 2x"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total DP</p>
                  <p className="font-medium mt-0.5">{formatCurrency(contract.dpAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Terbayar</p>
                  <p className="font-medium mt-0.5">{formatCurrency(contract.dpPaidAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={contract.dpFullyPaid ? "success" : "warning"} className="mt-0.5">
                    {contract.dpFullyPaid ? "Lunas" : "Belum Lunas"}
                  </Badge>
                </div>
              </div>
              {/* DP Invoices */}
              {dpInvoices.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  {dpInvoices.map((inv, idx) => (
                    <div key={inv.id} className="flex items-center justify-between text-sm bg-muted/30 rounded-lg p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{inv.invoiceNumber}</span>
                        {inv.type === "DP_INSTALLMENT" && (
                          <span className="text-xs text-muted-foreground">Cicilan {idx + 1}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{formatCurrency(inv.amount)}</span>
                        <Badge variant={paymentBadgeVariant(inv.status)} className="text-xs">
                          {inv.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Unit Delivery */}
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground font-medium uppercase">Pengiriman Unit</p>
              {contract.unitReceivedDate ? (
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">Unit Diterima</span>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                    {formatDate(contract.unitReceivedDate)}
                  </p>
                  {contract.billingStartDate && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Tagihan dimulai: {formatDate(contract.billingStartDate)}
                    </p>
                  )}
                  {contract.bastPhoto && (
                    <p className="text-xs text-muted-foreground mt-1">
                      BAST: Foto tersimpan
                    </p>
                  )}
                  {contract.bastNotes && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Catatan: {contract.bastNotes}
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Menunggu Pengiriman</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    DP harus dibayar sebelum unit bisa dikirim.
                  </p>
                  {contract.status === "ACTIVE" && (
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={() => setReceiveUnitDialogOpen(true)}
                    >
                      <Package className="h-3.5 w-3.5 mr-1" /> Terima Unit
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Payment History */}
          {payments.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground font-medium mb-2">Riwayat Pembayaran ({payments.length})</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {payments.slice(0, 20).map((b) => (
                  <div key={b.id} className="flex items-center justify-between text-xs bg-muted/20 rounded px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{b.invoiceNumber}</span>
                      <Badge
                        variant={
                          b.status === "PAID" ? "success" :
                          b.status === "PENDING" ? "default" :
                          b.status === "EXPIRED" ? "warning" :
                          "secondary"
                        }
                        className="text-[10px]"
                      >
                        {b.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      {b.daysCount === 0 ? (
                        <span className="text-muted-foreground">Libur</span>
                      ) : (
                        <span>{b.daysCount} hari</span>
                      )}
                      <span className="font-medium">{formatCurrency(b.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ======= DIALOGS ======= */}

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
                    <span className="text-muted-foreground">Tagihan Harian</span>
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
            <DialogTitle>Bayar Tagihan</DialogTitle>
            <DialogDescription>
              Bayar tagihan harian kontrak {contract.contractNumber} (maks 7 hari per pembayaran).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Jumlah Hari</Label>
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
              {processing ? "Memproses..." : "Bayar"}
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Kontrak</DialogTitle>
            <DialogDescription>
              Edit kontrak {contract.contractNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Detail Unit</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Warna</Label>
                <Input value={editColor} onChange={(e) => setEditColor(e.target.value)} placeholder="Warna motor" />
              </div>
              <div className="space-y-2">
                <Label>Tahun</Label>
                <Input type="number" value={editYear} onChange={(e) => setEditYear(e.target.value)} placeholder="2025" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>VIN Number</Label>
                <Input value={editVinNumber} onChange={(e) => setEditVinNumber(e.target.value)} placeholder="Nomor VIN" />
              </div>
              <div className="space-y-2">
                <Label>Nomor Mesin</Label>
                <Input value={editEngineNumber} onChange={(e) => setEditEngineNumber(e.target.value)} placeholder="Nomor mesin" />
              </div>
            </div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider pt-2">Pengaturan</h3>
            <div className="space-y-2">
              <Label>Grace Period (hari)</Label>
              <Input type="number" min={0} value={editGracePeriod} onChange={(e) => setEditGracePeriod(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Target Kepemilikan (hari)</Label>
              <Input type="number" min={1} value={editOwnershipTarget} onChange={(e) => setEditOwnershipTarget(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Progress saat ini: {contract.totalDaysPaid} / {editOwnershipTarget || contract.ownershipTargetDays} hari
                ({editOwnershipTarget ? ((contract.totalDaysPaid / parseInt(editOwnershipTarget || "1")) * 100).toFixed(1) : contract.ownershipProgress}%)
              </p>
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Catatan kontrak..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Batal</Button>
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
              <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Masukkan alasan pembatalan..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelDialogOpen(false); setCancelReason(""); }}>Kembali</Button>
            <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={handleCancel} disabled={processing || !cancelReason.trim()}>
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
              <FileX className="h-5 w-5" /> Void Tagihan
            </DialogTitle>
            <DialogDescription>
              Void tagihan {voidInvoiceTarget?.invoiceNumber}? Tagihan yang di-void tidak dapat dibayar.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1">
            <p><strong>Tagihan:</strong> {voidInvoiceTarget?.invoiceNumber}</p>
            <p><strong>Jumlah:</strong> {voidInvoiceTarget && formatCurrency(voidInvoiceTarget.amount)}</p>
            {voidInvoiceTarget?.extensionDays && (
              <p><strong>Tagihan Harian:</strong> {voidInvoiceTarget.extensionDays} hari</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setVoidDialogOpen(false); setVoidInvoiceTarget(null); }}>Batal</Button>
            <Button variant="destructive" onClick={handleVoidInvoice} disabled={processing}>
              {processing ? "Memproses..." : "Ya, Void Tagihan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Unit Confirmation Dialog */}
      <Dialog open={receiveUnitDialogOpen} onOpenChange={(open) => { setReceiveUnitDialogOpen(open); if (!open) { setBastPhoto(""); setBastNotes(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" /> Serah Terima Unit (BAST)
            </DialogTitle>
            <DialogDescription>
              Konfirmasi penerimaan unit motor untuk kontrak {contract.contractNumber}.
              Tagihan harian akan dimulai H+1.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1">
              <p><strong>Customer:</strong> {customer.fullName}</p>
              <p><strong>Motor:</strong> {contract.motorModel} ({contract.batteryType === "EXTENDED" ? "Extended" : "Regular"})</p>
              <p><strong>Skema DP:</strong> {contract.dpScheme === "FULL" ? "Lunas" : "Cicilan 2x"}</p>
              <p><strong>Status DP:</strong> {contract.dpFullyPaid ? "Lunas" : `Terbayar ${formatCurrency(contract.dpPaidAmount)} / ${formatCurrency(contract.dpAmount)}`}</p>
            </div>
            {!contract.dpFullyPaid && contract.dpScheme === "FULL" && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
                <strong>DP belum lunas!</strong> Customer harus membayar DP terlebih dahulu sebelum unit bisa diserahkan.
              </div>
            )}
            {!contract.dpFullyPaid && contract.dpScheme === "INSTALLMENT" && (
              <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900 rounded-lg p-3 text-sm text-yellow-700 dark:text-yellow-400">
                <strong>Perhatian:</strong> DP cicilan pertama harus sudah dibayar sebelum unit bisa diserahkan.
              </div>
            )}
            <div>
              <Label className="text-sm font-medium">Foto BAST <span className="text-red-500">*</span></Label>
              <Input value={bastPhoto} onChange={(e) => setBastPhoto(e.target.value)} placeholder="URL foto bukti serah terima..." className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Masukkan URL foto Berita Acara Serah Terima (BAST)</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Catatan BAST</Label>
              <Textarea value={bastNotes} onChange={(e) => setBastNotes(e.target.value)} placeholder="Catatan tambahan serah terima (opsional)..." className="mt-1" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveUnitDialogOpen(false)}>Batal</Button>
            <Button onClick={handleReceiveUnit} disabled={processing || !bastPhoto.trim()}>
              {processing ? "Memproses..." : "Ya, Terima Unit"}
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
              Tandai tagihan {markPaidTarget?.invoiceNumber} sebagai lunas secara manual?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-4 text-sm space-y-1">
            <p><strong>Tagihan:</strong> {markPaidTarget?.invoiceNumber}</p>
            <p><strong>Jumlah:</strong> {markPaidTarget && formatCurrency(markPaidTarget.amount)}</p>
            {markPaidTarget?.extensionDays && (
              <p><strong>Tagihan Harian:</strong> {markPaidTarget.extensionDays} hari (akan diterapkan ke kontrak)</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMarkPaidDialogOpen(false); setMarkPaidTarget(null); }}>Batal</Button>
            <Button variant="success" onClick={handleMarkPaid} disabled={processing}>
              {processing ? "Memproses..." : "Ya, Tandai Lunas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revert Invoice Confirmation Dialog */}
      <Dialog open={revertDialogOpen} onOpenChange={(open) => { setRevertDialogOpen(open); if (!open) setRevertTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="h-5 w-5 text-orange-600" /> Revert Status
            </DialogTitle>
            <DialogDescription>
              Kembalikan tagihan {revertTarget?.invoiceNumber} ke status PENDING?
              {revertTarget?.status === "PAID" && " Perubahan pada kontrak akan di-revert."}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 rounded-lg p-4 text-sm space-y-1">
            <p><strong>Tagihan:</strong> {revertTarget?.invoiceNumber}</p>
            <p><strong>Status saat ini:</strong> {revertTarget?.status}</p>
            <p><strong>Jumlah:</strong> {revertTarget && formatCurrency(revertTarget.amount + (revertTarget.lateFee || 0))}</p>
            {revertTarget?.status === "PAID" && revertTarget?.extensionDays && (
              <p className="text-orange-700 dark:text-orange-400"><strong>Perhatian:</strong> {revertTarget.extensionDays} hari yang sudah dikreditkan akan dikurangi dari kontrak.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRevertDialogOpen(false); setRevertTarget(null); }}>Batal</Button>
            <Button variant="destructive" onClick={handleRevertInvoice} disabled={processing}>
              {processing ? "Memproses..." : "Ya, Revert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
