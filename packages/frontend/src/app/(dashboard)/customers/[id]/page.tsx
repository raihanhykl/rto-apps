"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Customer, Contract, Invoice } from "@/types";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  FileText,
  Receipt,
} from "lucide-react";

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

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [customerData, contractsData, invoicesData] = await Promise.all([
        api.getCustomer(id),
        api.getContractsByCustomer(id),
        api.getInvoicesByCustomer(id),
      ]);
      setCustomer(customerData);
      setContracts(contractsData);
      setInvoices(invoicesData);
    } catch (error) {
      console.error("Failed to load customer detail:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Customer tidak ditemukan.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/customers")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
        </Button>
      </div>
    );
  }

  const totalSpent = invoices.filter(i => i.status === "PAID").reduce((s, i) => s + i.amount, 0);
  const pendingAmount = invoices.filter(i => i.status === "PENDING").reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/customers")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{customer.fullName}</h1>
          <p className="text-muted-foreground">Detail customer</p>
        </div>
      </div>

      {/* Customer Info + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Info Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" /> Informasi Customer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Telepon</p>
                  <p className="font-medium">{customer.phone}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium">{customer.email || "-"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CreditCard className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">No. KTP</p>
                  <p className="font-medium font-mono">{customer.ktpNumber}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Alamat</p>
                  <p className="font-medium">{customer.address}</p>
                </div>
              </div>
            </div>
            {customer.notes && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground">Catatan</p>
                <p className="text-sm mt-1">{customer.notes}</p>
              </div>
            )}
            <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
              Terdaftar: {formatDateTime(customer.createdAt)}
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Kontrak</p>
              <p className="text-2xl font-bold mt-1">{contracts.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Dibayar</p>
              <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(totalSpent)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-xl font-bold text-yellow-600 mt-1">{formatCurrency(pendingAmount)}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Contracts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" /> Riwayat Kontrak ({contracts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contracts.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">
              Belum ada kontrak untuk customer ini.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 text-sm font-medium">No. Kontrak</th>
                    <th className="text-left p-3 text-sm font-medium">Motor</th>
                    <th className="text-left p-3 text-sm font-medium">Durasi</th>
                    <th className="text-left p-3 text-sm font-medium">Total</th>
                    <th className="text-left p-3 text-sm font-medium">Periode</th>
                    <th className="text-left p-3 text-sm font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => router.push(`/contracts/${c.id}`)}>
                      <td className="p-3 font-mono text-sm text-primary">{c.contractNumber}</td>
                      <td className="p-3 text-sm">{c.motorModel}</td>
                      <td className="p-3 text-sm">{c.durationDays} hari</td>
                      <td className="p-3 text-sm font-medium">{formatCurrency(c.totalAmount)}</td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {formatDate(c.startDate)} - {formatDate(c.endDate)}
                      </td>
                      <td className="p-3">
                        <Badge variant={statusBadgeVariant(c.status)}>{c.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5" /> Riwayat Invoice ({invoices.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">
              Belum ada invoice.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 text-sm font-medium">No. Invoice</th>
                    <th className="text-left p-3 text-sm font-medium">Amount</th>
                    <th className="text-left p-3 text-sm font-medium">Status</th>
                    <th className="text-left p-3 text-sm font-medium">Due Date</th>
                    <th className="text-left p-3 text-sm font-medium">Paid At</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-mono text-sm">{inv.invoiceNumber}</td>
                      <td className="p-3 text-sm font-medium">{formatCurrency(inv.amount)}</td>
                      <td className="p-3">
                        <Badge variant={paymentBadgeVariant(inv.status)}>{inv.status}</Badge>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">{formatDate(inv.dueDate)}</td>
                      <td className="p-3 text-sm text-muted-foreground">{inv.paidAt ? formatDate(inv.paidAt) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
