"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { api } from "@/lib/api";
import { Customer } from "@/types";
import { formatDate } from "@/lib/utils";
import { Plus, Search, Pencil, Trash2, Users, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { toastSuccess, toastError } from "@/stores/toastStore";

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    address: "",
    ktpNumber: "",
    notes: "",
  });
  const [formError, setFormError] = useState("");

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async (q?: string) => {
    try {
      const data = await api.getCustomers(q);
      setCustomers(data);
    } catch (error) {
      console.error("Failed to load customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setLoading(true);
    loadCustomers(search || undefined);
  };

  const openCreate = () => {
    setEditingCustomer(null);
    setForm({ fullName: "", phone: "", email: "", address: "", ktpNumber: "", notes: "" });
    setFormError("");
    setDialogOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setForm({
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

  const handleSave = async () => {
    if (!form.fullName || !form.phone || !form.address || !form.ktpNumber) {
      setFormError("Nama, telepon, alamat, dan KTP wajib diisi.");
      return;
    }
    if (form.ktpNumber.length !== 16) {
      setFormError("Nomor KTP harus 16 digit.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      if (editingCustomer) {
        await api.updateCustomer(editingCustomer.id, form);
        toastSuccess("Customer diupdate", `Data ${form.fullName} berhasil diperbarui.`);
      } else {
        await api.createCustomer(form);
        toastSuccess("Customer ditambahkan", `${form.fullName} berhasil ditambahkan.`);
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button variant="secondary" onClick={handleSearch}>
          Cari
        </Button>
      </div>

      {/* Customer List */}
      {customers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Belum ada customer.</p>
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Customer Pertama
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 text-sm font-medium">Nama</th>
                    <th className="text-left p-4 text-sm font-medium">Telepon</th>
                    <th className="text-left p-4 text-sm font-medium">KTP</th>
                    <th className="text-left p-4 text-sm font-medium">Alamat</th>
                    <th className="text-left p-4 text-sm font-medium">Tanggal</th>
                    <th className="text-right p-4 text-sm font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
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
                  ))}
                </tbody>
              </table>
            </div>
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

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Lengkap *</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Nama lengkap"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telepon *</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="08xx..."
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>No. KTP *</Label>
              <Input
                value={form.ktpNumber}
                onChange={(e) => setForm({ ...form, ktpNumber: e.target.value.replace(/\D/g, '').slice(0, 16) })}
                placeholder="16 digit nomor KTP"
                maxLength={16}
              />
            </div>
            <div className="space-y-2">
              <Label>Alamat *</Label>
              <Textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Alamat lengkap"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Catatan tambahan (opsional)"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Menyimpan..." : editingCustomer ? "Update" : "Simpan"}
            </Button>
          </DialogFooter>
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
