"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Customer } from "@/types";
import { formatDate } from "@/lib/utils";
import { customerSchema, CustomerFormData } from "@/lib/schemas";
import { Plus, Search, Pencil, Trash2, Users, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { toastSuccess, toastError } from "@/stores/toastStore";

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);

  const pagination = usePagination({ initialSortBy: "createdAt", initialSortOrder: "desc" });

  const { register, handleSubmit: rhfSubmit, reset, formState: { errors } } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: { fullName: "", phone: "", email: "", address: "", ktpNumber: "", notes: "" },
  });
  const [formError, setFormError] = useState("");

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getCustomersPaginated({
        page: pagination.page,
        limit: pagination.limit,
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder,
        search: pagination.debouncedSearch || undefined,
      });
      setCustomers(result.data);
      pagination.updateFromResult(result);
    } catch (error) {
      console.error("Failed to load customers:", error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, pagination.sortBy, pagination.sortOrder, pagination.debouncedSearch]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const openCreate = () => {
    setEditingCustomer(null);
    reset({ fullName: "", phone: "", email: "", address: "", ktpNumber: "", notes: "" });
    setFormError("");
    setDialogOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    reset({
      fullName: customer.fullName,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      ktpNumber: customer.ktpNumber,
      notes: customer.notes,
    });
    setFormError("");
    setDialogOpen(true);
  };

  const handleSave = async (data: CustomerFormData) => {
    setSaving(true);
    setFormError("");
    try {
      if (editingCustomer) {
        await api.updateCustomer(editingCustomer.id, data);
        toastSuccess("Customer diupdate", `Data ${data.fullName} berhasil diperbarui.`);
      } else {
        await api.createCustomer(data);
        toastSuccess("Customer ditambahkan", `${data.fullName} berhasil ditambahkan.`);
      }
      setDialogOpen(false);
      loadCustomers();
    } catch (error: any) {
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCustomer) return;
    try {
      const name = deletingCustomer.fullName;
      await api.deleteCustomer(deletingCustomer.id);
      setDeleteDialogOpen(false);
      setDeletingCustomer(null);
      loadCustomers();
      toastSuccess("Customer dihapus", `${name} berhasil dihapus.`);
    } catch (error: any) {
      toastError("Gagal menghapus", error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground">Kelola data customer</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Customer
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama, telepon, KTP..."
            value={pagination.search}
            onChange={(e) => pagination.setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {pagination.total > 0 && (
          <span className="text-sm text-muted-foreground self-center">{pagination.total} customer</span>
        )}
      </div>

      {/* Customer List */}
      {!loading && customers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {pagination.debouncedSearch ? "Tidak ada customer yang cocok." : "Belum ada customer."}
            </p>
            {!pagination.debouncedSearch && (
              <Button className="mt-4" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Tambah Customer Pertama
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
                    <SortableHeader label="Nama" field="fullName" currentSortBy={pagination.sortBy} currentSortOrder={pagination.sortOrder} onSort={pagination.handleSort} />
                    <SortableHeader label="Telepon" field="phone" currentSortBy={pagination.sortBy} currentSortOrder={pagination.sortOrder} onSort={pagination.handleSort} />
                    <th className="text-left p-4 text-sm font-medium">KTP</th>
                    <th className="text-left p-4 text-sm font-medium">Alamat</th>
                    <SortableHeader label="Tanggal" field="createdAt" currentSortBy={pagination.sortBy} currentSortOrder={pagination.sortOrder} onSort={pagination.handleSort} />
                    <th className="text-right p-4 text-sm font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j} className="p-4">
                            <div className="h-4 bg-muted animate-pulse rounded" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    customers.map((customer) => (
                      <tr key={customer.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-4">
                          <p className="font-medium">{customer.fullName}</p>
                          {customer.email && (
                            <p className="text-xs text-muted-foreground">{customer.email}</p>
                          )}
                        </td>
                        <td className="p-4 text-sm">{customer.phone}</td>
                        <td className="p-4 text-sm font-mono">{customer.ktpNumber}</td>
                        <td className="p-4 text-sm max-w-[200px] truncate">{customer.address}</td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {formatDate(customer.createdAt)}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => router.push(`/customers/${customer.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(customer)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeletingCustomer(customer);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? "Edit Customer" : "Tambah Customer Baru"}
            </DialogTitle>
            <DialogDescription>
              {editingCustomer ? "Perbarui data customer." : "Masukkan data customer baru."}
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {formError}
            </div>
          )}

          <form onSubmit={rhfSubmit(handleSave)} className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Lengkap *</Label>
              <Input {...register("fullName")} placeholder="Nama lengkap" />
              {errors.fullName && <p className="text-destructive text-xs">{errors.fullName.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telepon *</Label>
                <Input {...register("phone")} placeholder="08xx..." />
                {errors.phone && <p className="text-destructive text-xs">{errors.phone.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" {...register("email")} placeholder="email@example.com" />
                {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>No. KTP *</Label>
              <Input {...register("ktpNumber")} placeholder="16 digit nomor KTP" maxLength={16} />
              {errors.ktpNumber && <p className="text-destructive text-xs">{errors.ktpNumber.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Alamat *</Label>
              <Textarea {...register("address")} placeholder="Alamat lengkap" rows={2} />
              {errors.address && <p className="text-destructive text-xs">{errors.address.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Input {...register("notes")} placeholder="Catatan tambahan (opsional)" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : editingCustomer ? "Update" : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Customer</DialogTitle>
            <DialogDescription>
              Yakin ingin menghapus <strong>{deletingCustomer?.fullName}</strong>? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
