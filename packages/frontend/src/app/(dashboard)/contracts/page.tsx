"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Pagination } from "@/components/ui/pagination";
import { SortableHeader } from "@/components/SortableHeader";
import { usePagination } from "@/hooks/usePagination";
import { api } from "@/lib/api";
import { Contract, Customer, MotorModel } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { contractSchema, ContractFormData } from "@/lib/schemas";
import { Plus, FileText, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { toastSuccess } from "@/stores/toastStore";

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

export default function ContractsPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const pagination = usePagination({ initialSortBy: "createdAt", initialSortOrder: "desc" });

  const [motorRates, setMotorRates] = useState<Record<string, number>>({});

  const { register, handleSubmit: rhfSubmit, reset, control, watch, formState: { errors } } = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      customerId: "",
      motorModel: undefined,
      durationDays: 1,
      startDate: new Date().toISOString().split("T")[0],
      notes: "",
    },
  });
  const watchMotorModel = watch("motorModel");
  const watchDurationDays = watch("durationDays");

  const loadContracts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getContractsPaginated({
        page: pagination.page,
        limit: pagination.limit,
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder,
        search: pagination.debouncedSearch || undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
      });
      setContracts(result.data);
      pagination.updateFromResult(result);
    } catch (error) {
      console.error("Failed to load contracts:", error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, pagination.sortBy, pagination.sortOrder, pagination.debouncedSearch, statusFilter]);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  useEffect(() => {
    // Load customers and rates once for the create dialog
    Promise.all([api.getCustomers(), api.getMotorRates()]).then(([c, r]) => {
      setCustomers(c);
      setMotorRates(r);
    });
  }, []);

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    pagination.setPage(1);
  };

  const openCreate = () => {
    reset({
      customerId: "",
      motorModel: undefined,
      durationDays: 1,
      startDate: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setFormError("");
    setDialogOpen(true);
  };

  const calculateTotal = () => {
    if (!watchMotorModel) return 0;
    return (motorRates[watchMotorModel] || 0) * watchDurationDays;
  };

  const handleSave = async (data: ContractFormData) => {
    setSaving(true);
    setFormError("");
    try {
      await api.createContract(data);
      setDialogOpen(false);
      toastSuccess("Kontrak dibuat", `Kontrak ${data.motorModel} (${data.durationDays} hari) berhasil dibuat.`);
      loadContracts();
    } catch (error: any) {
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const getCustomerName = (customerId: string) => {
    return customers.find((c) => c.id === customerId)?.fullName || "Unknown";
  };

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
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari no. kontrak, customer, motor..."
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
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="OVERDUE">Overdue</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
            <SelectItem value="REPOSSESSED">Repossessed</SelectItem>
          </SelectContent>
        </Select>
        {pagination.total > 0 && (
          <span className="text-sm text-muted-foreground self-center">{pagination.total} kontrak</span>
        )}
      </div>

      {!loading && contracts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {pagination.debouncedSearch || statusFilter !== "ALL"
                ? "Tidak ada kontrak yang cocok dengan filter."
                : "Belum ada kontrak."}
            </p>
            {!pagination.debouncedSearch && statusFilter === "ALL" && customers.length > 0 && (
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
                    <SortableHeader label="No. Kontrak" field="contractNumber" currentSortBy={pagination.sortBy} currentSortOrder={pagination.sortOrder} onSort={pagination.handleSort} />
                    <th className="text-left p-4 text-sm font-medium">Customer</th>
                    <SortableHeader label="Motor" field="motorModel" currentSortBy={pagination.sortBy} currentSortOrder={pagination.sortOrder} onSort={pagination.handleSort} />
                    <th className="text-left p-4 text-sm font-medium">Progress</th>
                    <SortableHeader label="Total" field="totalAmount" currentSortBy={pagination.sortBy} currentSortOrder={pagination.sortOrder} onSort={pagination.handleSort} />
                    <th className="text-left p-4 text-sm font-medium">Periode Aktif</th>
                    <th className="text-left p-4 text-sm font-medium">Sisa Hari</th>
                    <SortableHeader label="Status" field="status" currentSortBy={pagination.sortBy} currentSortOrder={pagination.sortOrder} onSort={pagination.handleSort} />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="p-4">
                            <div className="h-4 bg-muted animate-pulse rounded" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    contracts.map((contract) => (
                      <tr key={contract.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => router.push(`/contracts/${contract.id}`)}>
                        <td className="p-4 font-mono text-sm text-primary">{contract.contractNumber}</td>
                        <td className="p-4 text-sm">{getCustomerName(contract.customerId)}</td>
                        <td className="p-4 text-sm">{contract.motorModel}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-muted rounded-full h-2 overflow-hidden">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(contract.ownershipProgress, 100)}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{contract.ownershipProgress}%</span>
                          </div>
                        </td>
                        <td className="p-4 text-sm font-medium">{formatCurrency(contract.totalAmount)}</td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {formatDate(contract.startDate)} - {formatDate(contract.endDate)}
                        </td>
                        <td className="p-4 text-sm">
                          {(() => {
                            if (contract.status === "COMPLETED" || contract.status === "CANCELLED" || contract.status === "REPOSSESSED") {
                              return <span className="text-muted-foreground">-</span>;
                            }
                            const end = new Date(contract.endDate);
                            const now = new Date();
                            const diffMs = end.getTime() - now.getTime();
                            const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                            if (diffDays <= 0) {
                              return <span className="text-destructive font-medium">Lewat {Math.abs(diffDays)} hari</span>;
                            }
                            return <span className={diffDays <= 2 ? "text-yellow-600 font-medium" : "font-medium"}>{diffDays} Hari</span>;
                          })()}
                        </td>
                        <td className="p-4">
                          <Badge variant={statusBadgeVariant(contract.status)}>
                            {contract.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={pagination.setPage} />
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

          <form onSubmit={rhfSubmit(handleSave)} className="space-y-4">
            <div className="space-y-2">
              <Label>Customer *</Label>
              <Controller
                name="customerId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
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
                )}
              />
              {errors.customerId && <p className="text-destructive text-xs">{errors.customerId.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Model Motor *</Label>
              <Controller
                name="motorModel"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih model motor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={MotorModel.ATHENA}>
                        Athena - {formatCurrency(motorRates[MotorModel.ATHENA] || 0)}/hari
                      </SelectItem>
                      <SelectItem value={MotorModel.VICTORY}>
                        Victory - {formatCurrency(motorRates[MotorModel.VICTORY] || 0)}/hari
                      </SelectItem>
                      <SelectItem value={MotorModel.EDPOWER}>
                        EdPower - {formatCurrency(motorRates[MotorModel.EDPOWER] || 0)}/hari
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.motorModel && <p className="text-destructive text-xs">{errors.motorModel.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Durasi (hari) *</Label>
                <Controller
                  name="durationDays"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value.toString()} onValueChange={(val) => field.onChange(parseInt(val))}>
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
                  )}
                />
                {errors.durationDays && <p className="text-destructive text-xs">{errors.durationDays.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Tanggal Mulai *</Label>
                <Input type="date" {...register("startDate")} />
                {errors.startDate && <p className="text-destructive text-xs">{errors.startDate.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Catatan</Label>
              <Input {...register("notes")} placeholder="Catatan tambahan (opsional)" />
            </div>

            {watchMotorModel && (
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex justify-between text-sm">
                  <span>Rate per hari</span>
                  <span>{formatCurrency(motorRates[watchMotorModel] || 0)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>Durasi</span>
                  <span>{watchDurationDays} hari</span>
                </div>
                <div className="border-t mt-2 pt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(calculateTotal())}</span>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : "Buat Kontrak"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
