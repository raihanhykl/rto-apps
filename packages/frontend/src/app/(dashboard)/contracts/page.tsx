"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { Contract, Customer, MotorModel, MOTOR_DAILY_RATES } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, FileText, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { toastSuccess } from "@/stores/toastStore";

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case "ACTIVE": return "default" as const;
    case "COMPLETED": return "success" as const;
    case "OVERDUE": return "destructive" as const;
    case "CANCELLED": return "secondary" as const;
    default: return "outline" as const;
  }
};

export default function ContractsPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [form, setForm] = useState({
    customerId: "",
    motorModel: "" as MotorModel | "",
    durationDays: 1,
    startDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [contractsData, customersData] = await Promise.all([
        api.getContracts(),
        api.getCustomers(),
      ]);
      setContracts(contractsData);
      setCustomers(customersData);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setForm({
      customerId: "",
      motorModel: "",
      durationDays: 1,
      startDate: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setFormError("");
    setDialogOpen(true);
  };

  const calculateTotal = () => {
    if (!form.motorModel) return 0;
    return MOTOR_DAILY_RATES[form.motorModel as MotorModel] * form.durationDays;
  };

  const handleSave = async () => {
    if (!form.customerId || !form.motorModel || !form.startDate) {
      setFormError("Customer, model motor, dan tanggal mulai wajib diisi.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      await api.createContract({
        customerId: form.customerId,
        motorModel: form.motorModel,
        durationDays: form.durationDays,
        startDate: form.startDate,
        notes: form.notes,
      });
      setDialogOpen(false);
      toastSuccess("Kontrak dibuat", `Kontrak ${form.motorModel} (${form.durationDays} hari) berhasil dibuat.`);
      loadData();
    } catch (error: any) {
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const getCustomerName = (customerId: string) => {
    return customers.find((c) => c.id === customerId)?.fullName || "Unknown";
  };

  const filteredContracts = contracts.filter((c) => {
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    if (!searchQuery) return matchesStatus;
    const q = searchQuery.toLowerCase();
    const customerName = getCustomerName(c.customerId).toLowerCase();
    return matchesStatus && (
      c.contractNumber.toLowerCase().includes(q) ||
      customerName.includes(q) ||
      c.motorModel.toLowerCase().includes(q)
    );
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contracts</h1>
          <p className="text-muted-foreground">Kelola kontrak RTO</p>
        </div>
        <Button onClick={openCreate} disabled={customers.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Buat Kontrak
        </Button>
      </div>

      {/* Search & Filter */}
      {contracts.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari no. kontrak, customer, motor..."
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
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="OVERDUE">Overdue</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {filteredContracts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {contracts.length === 0 ? "Belum ada kontrak." : "Tidak ada kontrak yang cocok dengan filter."}
            </p>
            {contracts.length === 0 && customers.length > 0 && (
              <Button className="mt-4" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Buat Kontrak Pertama
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 text-sm font-medium">No. Kontrak</th>
                    <th className="text-left p-4 text-sm font-medium">Customer</th>
                    <th className="text-left p-4 text-sm font-medium">Motor</th>
                    <th className="text-left p-4 text-sm font-medium">Durasi</th>
                    <th className="text-left p-4 text-sm font-medium">Total</th>
                    <th className="text-left p-4 text-sm font-medium">Periode</th>
                    <th className="text-left p-4 text-sm font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContracts.map((contract) => (
                    <tr key={contract.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => router.push(`/contracts/${contract.id}`)}>
                      <td className="p-4 font-mono text-sm text-primary">{contract.contractNumber}</td>
                      <td className="p-4 text-sm">{getCustomerName(contract.customerId)}</td>
                      <td className="p-4 text-sm">{contract.motorModel}</td>
                      <td className="p-4 text-sm">{contract.durationDays} hari</td>
                      <td className="p-4 text-sm font-medium">{formatCurrency(contract.totalAmount)}</td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {formatDate(contract.startDate)} - {formatDate(contract.endDate)}
                      </td>
                      <td className="p-4">
                        <Badge variant={statusBadgeVariant(contract.status)}>
                          {contract.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Contract Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Buat Kontrak Baru</DialogTitle>
            <DialogDescription>Buat kontrak RTO untuk customer.</DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {formError}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Customer *</Label>
              <Select
                value={form.customerId}
                onValueChange={(val) => setForm({ ...form, customerId: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.fullName} - {c.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Model Motor *</Label>
              <Select
                value={form.motorModel}
                onValueChange={(val) => setForm({ ...form, motorModel: val as MotorModel })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih model motor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MotorModel.ATHENA}>
                    Athena - {formatCurrency(55000)}/hari
                  </SelectItem>
                  <SelectItem value={MotorModel.VICTORY}>
                    Victory - {formatCurrency(55000)}/hari
                  </SelectItem>
                  <SelectItem value={MotorModel.EDPOWER}>
                    EdPower - {formatCurrency(75000)}/hari
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Durasi (hari) *</Label>
                <Select
                  value={form.durationDays.toString()}
                  onValueChange={(val) => setForm({ ...form, durationDays: parseInt(val) })}
                >
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
              <div className="space-y-2">
                <Label>Tanggal Mulai *</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Catatan</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Catatan tambahan (opsional)"
              />
            </div>

            {form.motorModel && (
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex justify-between text-sm">
                  <span>Rate per hari</span>
                  <span>{formatCurrency(MOTOR_DAILY_RATES[form.motorModel as MotorModel])}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>Durasi</span>
                  <span>{form.durationDays} hari</span>
                </div>
                <div className="border-t mt-2 pt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(calculateTotal())}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Menyimpan..." : "Buat Kontrak"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
