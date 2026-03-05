"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCustomer, useContractsByCustomer, useInvoicesByCustomer, useInvalidate } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { Customer, Contract, Invoice } from "@/types";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { toastSuccess, toastError } from "@/stores/toastStore";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  FileText,
  Receipt,
  Calendar,
  Users,
  Heart,
  Car,
  Pencil,
} from "lucide-react";

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

const paymentBadgeVariant = (status: string) => {
  switch (status) {
    case "PENDING": return "warning" as const;
    case "PAID": return "success" as const;
    case "FAILED": return "destructive" as const;
    case "VOID": return "secondary" as const;
    default: return "outline" as const;
  }
};

const genderLabel = (g: string | null) => {
  if (g === "MALE") return "Laki-laki";
  if (g === "FEMALE") return "Perempuan";
  return "-";
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const invalidate = useInvalidate();
  const { data: customer, isLoading: customerLoading } = useCustomer(id);
  const { data: contracts = [] as Contract[], isLoading: contractsLoading } = useContractsByCustomer(id);
  const { data: invoices = [] as Invoice[], isLoading: invoicesLoading } = useInvoicesByCustomer(id);
  const loading = customerLoading || contractsLoading || invoicesLoading;
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    address: "",
    birthDate: "",
    gender: "" as string,
    ktpNumber: "",
    guarantorName: "",
    guarantorPhone: "",
    spouseName: "",
    notes: "",
    rideHailingApps: [] as string[],
  });

  const RIDE_APPS = ["Grab", "Gojek", "Maxim", "InDriver"];

  const openEditDialog = () => {
    if (!customer) return;
    setEditForm({
      fullName: customer.fullName,
      phone: customer.phone,
      email: customer.email || "",
      address: customer.address,
      birthDate: customer.birthDate || "",
      gender: customer.gender || "",
      ktpNumber: customer.ktpNumber,
      guarantorName: customer.guarantorName || "",
      guarantorPhone: customer.guarantorPhone || "",
      spouseName: customer.spouseName || "",
      notes: customer.notes || "",
      rideHailingApps: customer.rideHailingApps || [],
    });
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    setProcessing(true);
    try {
      await api.updateCustomer(id, {
        ...editForm,
        gender: editForm.gender || null,
        birthDate: editForm.birthDate || null,
      });
      toastSuccess("Berhasil", "Data customer berhasil diperbarui.");
      setEditDialogOpen(false);
      invalidate("/customers");
    } catch (error: any) {
      toastError("Gagal", error.message);
    } finally {
      setProcessing(false);
    }
  };

  const toggleRideApp = (app: string) => {
    setEditForm(prev => ({
      ...prev,
      rideHailingApps: prev.rideHailingApps.includes(app)
        ? prev.rideHailingApps.filter(a => a !== app)
        : [...prev.rideHailingApps, app],
    }));
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

  const totalSpent = invoices.filter(i => i.status === "PAID").reduce((s, i) => s + i.amount + (i.lateFee || 0), 0);
  const pendingAmount = invoices.filter(i => i.status === "PENDING").reduce((s, i) => s + i.amount + (i.lateFee || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/customers")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{customer.fullName}</h1>
            <p className="text-muted-foreground">Detail customer</p>
          </div>
        </div>
        <Button variant="outline" onClick={openEditDialog}>
          <Pencil className="h-4 w-4 mr-2" /> Edit Customer
        </Button>
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
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Tanggal Lahir</p>
                  <p className="font-medium">{customer.birthDate || "-"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Jenis Kelamin</p>
                  <p className="font-medium">{genderLabel(customer.gender)}</p>
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
                <Car className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Aplikasi Ojol</p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {(customer.rideHailingApps || []).length > 0 ? (
                      customer.rideHailingApps.map((app: string) => (
                        <Badge key={app} variant="outline" className="text-xs">{app}</Badge>
                      ))
                    ) : (
                      <span className="text-sm">-</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 md:col-span-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Alamat</p>
                  <p className="font-medium">{customer.address}</p>
                </div>
              </div>
            </div>

            {/* Guarantor */}
            {(customer.guarantorName || customer.guarantorPhone) && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground font-semibold uppercase">Penjamin (Guarantor)</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                  <div>
                    <p className="text-xs text-muted-foreground">Nama</p>
                    <p className="font-medium">{customer.guarantorName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Telepon</p>
                    <p className="font-medium">{customer.guarantorPhone || "-"}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Spouse */}
            {customer.spouseName && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground font-semibold uppercase">Pasangan (Spouse)</p>
                </div>
                <div className="pl-6">
                  <p className="text-xs text-muted-foreground">Nama</p>
                  <p className="font-medium">{customer.spouseName}</p>
                </div>
              </div>
            )}

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
            <Receipt className="h-5 w-5" /> Riwayat Tagihan ({invoices.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">
              Belum ada tagihan.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 text-sm font-medium">No. Tagihan</th>
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
                      <td className="p-3 text-sm font-medium">{formatCurrency(inv.amount + (inv.lateFee || 0))}</td>
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

      {/* Edit Customer Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" /> Edit Customer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Data Pribadi */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase">Data Pribadi</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nama Lengkap *</Label>
                  <Input value={editForm.fullName} onChange={(e) => setEditForm(p => ({ ...p, fullName: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>No. KTP *</Label>
                  <Input value={editForm.ktpNumber} onChange={(e) => setEditForm(p => ({ ...p, ktpNumber: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Telepon *</Label>
                  <Input value={editForm.phone} onChange={(e) => setEditForm(p => ({ ...p, phone: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={editForm.email} onChange={(e) => setEditForm(p => ({ ...p, email: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Tanggal Lahir</Label>
                  <Input type="date" value={editForm.birthDate} onChange={(e) => setEditForm(p => ({ ...p, birthDate: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Jenis Kelamin</Label>
                  <Select value={editForm.gender} onValueChange={(v) => setEditForm(p => ({ ...p, gender: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">Laki-laki</SelectItem>
                      <SelectItem value="FEMALE">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>Alamat *</Label>
                  <Textarea value={editForm.address} onChange={(e) => setEditForm(p => ({ ...p, address: e.target.value }))} className="mt-1" rows={2} />
                </div>
              </div>
            </div>

            {/* Aplikasi Ojol */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase">Aplikasi Ojol</h3>
              <div className="flex flex-wrap gap-2">
                {RIDE_APPS.map(app => (
                  <Button
                    key={app}
                    type="button"
                    size="sm"
                    variant={editForm.rideHailingApps.includes(app) ? "default" : "outline"}
                    onClick={() => toggleRideApp(app)}
                  >
                    {app}
                  </Button>
                ))}
              </div>
            </div>

            {/* Penjamin */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase">Penjamin (Guarantor)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nama Penjamin</Label>
                  <Input value={editForm.guarantorName} onChange={(e) => setEditForm(p => ({ ...p, guarantorName: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Telepon Penjamin</Label>
                  <Input value={editForm.guarantorPhone} onChange={(e) => setEditForm(p => ({ ...p, guarantorPhone: e.target.value }))} className="mt-1" />
                </div>
              </div>
            </div>

            {/* Pasangan */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase">Pasangan (Spouse)</h3>
              <div>
                <Label>Nama Pasangan</Label>
                <Input value={editForm.spouseName} onChange={(e) => setEditForm(p => ({ ...p, spouseName: e.target.value }))} className="mt-1" />
              </div>
            </div>

            {/* Catatan */}
            <div>
              <Label>Catatan</Label>
              <Textarea value={editForm.notes} onChange={(e) => setEditForm(p => ({ ...p, notes: e.target.value }))} className="mt-1" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Batal</Button>
            <Button onClick={handleEditSubmit} disabled={processing || !editForm.fullName || !editForm.phone || !editForm.ktpNumber || !editForm.address}>
              {processing ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
