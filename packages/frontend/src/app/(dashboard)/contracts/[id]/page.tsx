"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Contract, Customer, Invoice } from "@/types";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
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
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case "ACTIVE": return "default" as const;
    case "COMPLETED": return "success" as const;
    case "OVERDUE": return "destructive" as const;
    case "CANCELLED": return "secondary" as const;
    default: return "outline" as const;
  }
};

const paymentBadgeVariant = (status: string) => {
  switch (status) {
    case "PENDING": return "warning" as const;
    case "PAID": return "success" as const;
    case "FAILED": return "destructive" as const;
    default: return "outline" as const;
  }
};

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [contract, setContract] = useState<Contract | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCode, setQrCode] = useState("");

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const data = await api.getContractDetail(id);
      setContract(data.contract);
      setCustomer(data.customer);
      setInvoice(data.invoice);
    } catch (error) {
      console.error("Failed to load contract detail:", error);
    } finally {
      setLoading(false);
    }
  };

  const showQR = async () => {
    if (!invoice) return;
    try {
      const data = await api.getInvoiceQR(invoice.id);
      setQrCode(data.qrCode);
      setQrDialogOpen(true);
    } catch (error) {
      console.error("Failed to generate QR:", error);
    }
  };

  const simulatePayment = async (status: "PAID" | "FAILED") => {
    if (!invoice) return;
    setProcessing(true);
    try {
      await api.simulatePayment(invoice.id, status);
      await loadData();
    } catch (error: any) {
      alert(error.message);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/contracts")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono">{contract.contractNumber}</h1>
              <Badge variant={statusBadgeVariant(contract.status)} className="text-sm">
                {contract.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">Detail kontrak RTO</p>
          </div>
        </div>
      </div>

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
                <p className="text-xs text-muted-foreground">Durasi</p>
                <p className="font-medium mt-1">{contract.durationDays} hari</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tanggal Mulai</p>
                <p className="font-medium mt-1 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> {formatDate(contract.startDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tanggal Selesai</p>
                <p className="font-medium mt-1 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> {formatDate(contract.endDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-bold text-primary mt-1">{formatCurrency(contract.totalAmount)}</p>
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

      {/* Invoice Section */}
      {invoice && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5" /> Invoice
              </CardTitle>
              <Badge variant={paymentBadgeVariant(invoice.status)} className="text-sm">
                {invoice.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <p className="text-xs text-muted-foreground">No. Invoice</p>
                <p className="font-mono font-medium mt-1">{invoice.invoiceNumber}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="font-bold text-lg mt-1">{formatCurrency(invoice.amount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Due Date</p>
                <p className="font-medium mt-1 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {formatDate(invoice.dueDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Paid At</p>
                <p className="font-medium mt-1">{invoice.paidAt ? formatDate(invoice.paidAt) : "-"}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={showQR}>
                <QrCode className="h-4 w-4 mr-2" /> QR Pembayaran
              </Button>
              {invoice.status === "PENDING" && (
                <>
                  <Button
                    variant="success"
                    disabled={processing}
                    onClick={() => simulatePayment("PAID")}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {processing ? "Memproses..." : "Simulasi Bayar"}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={processing}
                    onClick={() => simulatePayment("FAILED")}
                  >
                    <XCircle className="h-4 w-4 mr-2" /> Simulasi Gagal
                  </Button>
                </>
              )}
              {invoice.status === "FAILED" && (
                <Button
                  variant="success"
                  disabled={processing}
                  onClick={() => simulatePayment("PAID")}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {processing ? "Memproses..." : "Retry Pembayaran"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* QR Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Pembayaran</DialogTitle>
            <DialogDescription>
              Invoice: {invoice?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {qrCode && <img src={qrCode} alt="QR Code" className="w-64 h-64" />}
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">
                {invoice && formatCurrency(invoice.amount)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">WEDISON Motor Listrik</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
