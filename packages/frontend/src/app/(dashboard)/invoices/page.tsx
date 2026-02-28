"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { Invoice } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Receipt, QrCode, Search } from "lucide-react";

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case "PENDING": return "warning" as const;
    case "PAID": return "success" as const;
    case "FAILED": return "destructive" as const;
    case "EXPIRED": return "secondary" as const;
    default: return "outline" as const;
  }
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

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

  const showQR = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    try {
      const data = await api.getInvoiceQR(invoice.id);
      setQrCode(data.qrCode);
      setQrDialogOpen(true);
    } catch (error) {
      console.error("Failed to generate QR:", error);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesStatus = statusFilter === "ALL" || inv.status === statusFilter;
    if (!searchQuery) return matchesStatus;
    const q = searchQuery.toLowerCase();
    return matchesStatus && inv.invoiceNumber.toLowerCase().includes(q);
  });

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
        <h1 className="text-2xl font-bold">Invoices</h1>
        <p className="text-muted-foreground">Daftar invoice & QR pembayaran</p>
      </div>

      {/* Search & Filter */}
      {invoices.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari no. invoice..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {filteredInvoices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {invoices.length === 0
                ? "Belum ada invoice. Invoice otomatis dibuat saat kontrak baru dibuat."
                : "Tidak ada invoice yang cocok dengan filter."}
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
                    <th className="text-left p-4 text-sm font-medium">No. Invoice</th>
                    <th className="text-left p-4 text-sm font-medium">Amount</th>
                    <th className="text-left p-4 text-sm font-medium">Status</th>
                    <th className="text-left p-4 text-sm font-medium">Due Date</th>
                    <th className="text-left p-4 text-sm font-medium">Paid At</th>
                    <th className="text-right p-4 text-sm font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-4 font-mono text-sm">{invoice.invoiceNumber}</td>
                      <td className="p-4 text-sm font-medium">{formatCurrency(invoice.amount)}</td>
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => showQR(invoice)}
                        >
                          <QrCode className="h-4 w-4 mr-1" />
                          QR
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              Invoice: {selectedInvoice?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {qrCode && (
              <img src={qrCode} alt="QR Code" className="w-64 h-64" />
            )}
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">
                {selectedInvoice && formatCurrency(selectedInvoice.amount)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                WEDISON Motor Listrik
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
