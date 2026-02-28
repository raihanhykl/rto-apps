"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Invoice } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CreditCard, CheckCircle2, XCircle } from "lucide-react";
import { toastSuccess, toastError } from "@/stores/toastStore";

export default function PaymentsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const data = await api.getInvoices();
      setInvoices(data);
    } catch (error) {
      console.error("Failed to load invoices:", error);
    } finally {
      setLoading(false);
    }
  };

  const simulatePayment = async (invoiceId: string, status: "PAID" | "FAILED") => {
    setProcessing(invoiceId);
    try {
      await api.simulatePayment(invoiceId, status);
      if (status === "PAID") {
        toastSuccess("Pembayaran berhasil", "Invoice telah ditandai sebagai PAID.");
      } else {
        toastError("Pembayaran gagal", "Invoice telah ditandai sebagai FAILED.");
      }
      await loadInvoices();
    } catch (error: any) {
      toastError("Simulasi gagal", error.message);
    } finally {
      setProcessing(null);
    }
  };

  const pendingInvoices = invoices.filter((i) => i.status === "PENDING");
  const processedInvoices = invoices.filter((i) => i.status !== "PENDING");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payment Simulation</h1>
        <p className="text-muted-foreground">Simulasi pembayaran invoice</p>
      </div>

      {/* Pending Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Menunggu Pembayaran ({pendingInvoices.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingInvoices.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              Tidak ada pembayaran yang pending.
            </p>
          ) : (
            <div className="space-y-3">
              {pendingInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-mono text-sm font-medium">{invoice.invoiceNumber}</p>
                    <p className="text-lg font-bold text-primary mt-1">
                      {formatCurrency(invoice.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Due: {formatDate(invoice.dueDate)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="success"
                      size="sm"
                      disabled={processing === invoice.id}
                      onClick={() => simulatePayment(invoice.id, "PAID")}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      {processing === invoice.id ? "..." : "Bayar"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={processing === invoice.id}
                      onClick={() => simulatePayment(invoice.id, "FAILED")}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Gagal
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processed Payments */}
      {processedInvoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Riwayat Pembayaran</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {processedInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-mono text-sm">{invoice.invoiceNumber}</p>
                    <p className="text-sm font-medium mt-1">
                      {formatCurrency(invoice.amount)}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={invoice.status === "PAID" ? "success" : "destructive"}
                    >
                      {invoice.status}
                    </Badge>
                    {invoice.paidAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(invoice.paidAt)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
