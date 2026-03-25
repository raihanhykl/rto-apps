'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Pagination } from '@/components/ui/pagination';
import { SortableHeader } from '@/components/SortableHeader';
import { usePagination } from '@/hooks/usePagination';
import { useCustomersPaginated, useInvalidate } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { Customer } from '@/types';
import { formatDate } from '@/lib/utils';
import { customerSchema, CustomerFormData } from '@/lib/schemas';
import { Plus, Search, Pencil, Trash2, Users, Eye, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toastSuccess, toastError } from '@/stores/toastStore';

const RIDE_HAILING_OPTIONS = ['Grab', 'Gojek', 'Maxim', 'Indrive', 'Shopee', 'Lalamove'];

export default function CustomersPage() {
  const router = useRouter();
  const invalidate = useInvalidate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [genderFilter, setGenderFilter] = useState('ALL');

  const pagination = usePagination({ initialSortBy: 'createdAt', initialSortOrder: 'desc' });

  const handleGenderFilterChange = (value: string) => {
    setGenderFilter(value);
    pagination.setPage(1);
  };

  const { data: customersData, isLoading: loading } = useCustomersPaginated({
    page: pagination.page,
    limit: pagination.limit,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
    search: pagination.debouncedSearch || undefined,
    gender: genderFilter !== 'ALL' ? genderFilter : undefined,
  });
  const customers = (customersData?.data as Customer[]) || [];

  useEffect(() => {
    if (customersData) pagination.updateFromResult(customersData);
  }, [customersData]);

  const {
    register,
    handleSubmit: rhfSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      address: '',
      birthDate: '',
      gender: '',
      rideHailingApps: [],
      ktpNumber: '',
      guarantorName: '',
      guarantorPhone: '',
      spouseName: '',
      notes: '',
    },
  });
  const [formError, setFormError] = useState('');
  const [otherAppInput, setOtherAppInput] = useState('');
  const [showOtherInput, setShowOtherInput] = useState(false);
  const watchApps = watch('rideHailingApps');
  const customApps = (watchApps || []).filter((a) => !RIDE_HAILING_OPTIONS.includes(a));

  const openCreate = () => {
    setEditingCustomer(null);
    reset({
      fullName: '',
      phone: '',
      email: '',
      address: '',
      birthDate: '',
      gender: '',
      rideHailingApps: [],
      ktpNumber: '',
      guarantorName: '',
      guarantorPhone: '',
      spouseName: '',
      notes: '',
    });
    setFormError('');
    setOtherAppInput('');
    setShowOtherInput(false);
    setDialogOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    const apps = customer.rideHailingApps || [];
    reset({
      fullName: customer.fullName,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      birthDate: customer.birthDate || '',
      gender: customer.gender || '',
      rideHailingApps: apps,
      ktpNumber: customer.ktpNumber,
      guarantorName: customer.guarantorName || '',
      guarantorPhone: customer.guarantorPhone || '',
      spouseName: customer.spouseName || '',
      notes: customer.notes,
    });
    setFormError('');
    setOtherAppInput('');
    setShowOtherInput(apps.some((a) => !RIDE_HAILING_OPTIONS.includes(a)));
    setDialogOpen(true);
  };

  const toggleApp = (app: string) => {
    const current = watchApps || [];
    if (current.includes(app)) {
      setValue(
        'rideHailingApps',
        current.filter((a) => a !== app),
      );
    } else {
      setValue('rideHailingApps', [...current, app]);
    }
  };

  const addOtherApp = () => {
    const name = otherAppInput.trim();
    if (!name) return;
    const current = watchApps || [];
    if (!current.includes(name)) {
      setValue('rideHailingApps', [...current, name]);
    }
    setOtherAppInput('');
  };

  const removeOtherApp = (app: string) => {
    const current = watchApps || [];
    setValue(
      'rideHailingApps',
      current.filter((a) => a !== app),
    );
  };

  const handleSave = async (data: CustomerFormData) => {
    setSaving(true);
    setFormError('');
    try {
      const payload: any = {
        ...data,
        birthDate: data.birthDate || null,
        gender: data.gender || null,
      };
      if (editingCustomer) {
        await api.updateCustomer(editingCustomer.id, payload);
        toastSuccess('Customer diupdate', `Data ${data.fullName} berhasil diperbarui.`);
      } else {
        await api.createCustomer(payload);
        toastSuccess('Customer ditambahkan', `${data.fullName} berhasil ditambahkan.`);
      }
      setDialogOpen(false);
      invalidate('/customers', '/dashboard');
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
      invalidate('/customers', '/dashboard');
      toastSuccess('Customer dihapus', `${name} berhasil dihapus.`);
    } catch (error: any) {
      toastError('Gagal menghapus', error.message);
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

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama, telepon, KTP..."
            value={pagination.search}
            onChange={(e) => pagination.setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={genderFilter} onValueChange={handleGenderFilterChange}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Gender</SelectItem>
            <SelectItem value="MALE">Laki-laki</SelectItem>
            <SelectItem value="FEMALE">Perempuan</SelectItem>
          </SelectContent>
        </Select>
        {pagination.total > 0 && (
          <span className="text-sm text-muted-foreground self-center">
            {pagination.total} customer
          </span>
        )}
      </div>

      {/* Customer List */}
      {!loading && customers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {pagination.debouncedSearch || genderFilter !== 'ALL'
                ? 'Tidak ada customer yang cocok dengan filter.'
                : 'Belum ada customer.'}
            </p>
            {!pagination.debouncedSearch && genderFilter === 'ALL' && (
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
                    <SortableHeader
                      label="Nama"
                      field="fullName"
                      currentSortBy={pagination.sortBy}
                      currentSortOrder={pagination.sortOrder}
                      onSort={pagination.handleSort}
                    />
                    <SortableHeader
                      label="Telepon"
                      field="phone"
                      currentSortBy={pagination.sortBy}
                      currentSortOrder={pagination.sortOrder}
                      onSort={pagination.handleSort}
                    />
                    <th className="text-left p-4 text-sm font-medium">KTP</th>
                    <th className="text-left p-4 text-sm font-medium">Aplikasi</th>
                    <th className="text-left p-4 text-sm font-medium">Penjamin</th>
                    <SortableHeader
                      label="Tanggal"
                      field="createdAt"
                      currentSortBy={pagination.sortBy}
                      currentSortOrder={pagination.sortOrder}
                      onSort={pagination.handleSort}
                    />
                    <th className="text-right p-4 text-sm font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b">
                          {Array.from({ length: 7 }).map((_, j) => (
                            <td key={j} className="p-4">
                              <div className="h-4 bg-muted animate-pulse rounded" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : customers.map((customer) => (
                        <tr key={customer.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="p-4">
                            <p className="font-medium">{customer.fullName}</p>
                            {customer.email && (
                              <p className="text-xs text-muted-foreground">{customer.email}</p>
                            )}
                          </td>
                          <td className="p-4 text-sm">{customer.phone}</td>
                          <td className="p-4 text-sm font-mono">{customer.ktpNumber}</td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1">
                              {(customer.rideHailingApps || []).map((app) => (
                                <Badge key={app} variant="outline" className="text-xs">
                                  {app}
                                </Badge>
                              ))}
                              {(!customer.rideHailingApps ||
                                customer.rideHailingApps.length === 0) && (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-sm">{customer.guarantorName || '-'}</td>
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
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={pagination.setPage}
            />
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Tambah Customer Baru'}</DialogTitle>
            <DialogDescription>
              {editingCustomer ? 'Perbarui data customer.' : 'Masukkan data customer baru.'}
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {formError}
            </div>
          )}

          <form onSubmit={rhfSubmit(handleSave)} className="space-y-4">
            {/* Data Pribadi */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Data Pribadi
              </h3>
              <div className="space-y-2">
                <Label>Nama Lengkap *</Label>
                <Input {...register('fullName')} placeholder="Nama lengkap" />
                {errors.fullName && (
                  <p className="text-destructive text-xs">{errors.fullName.message}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telepon *</Label>
                  <Input {...register('phone')} placeholder="08xx..." />
                  {errors.phone && (
                    <p className="text-destructive text-xs">{errors.phone.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" {...register('email')} placeholder="email@example.com" />
                  {errors.email && (
                    <p className="text-destructive text-xs">{errors.email.message}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tanggal Lahir</Label>
                  <Input type="date" {...register('birthDate')} />
                </div>
                <div className="space-y-2">
                  <Label>Jenis Kelamin</Label>
                  <select
                    {...register('gender')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Pilih...</option>
                    <option value="MALE">Laki-laki</option>
                    <option value="FEMALE">Perempuan</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>No. KTP *</Label>
                <Input {...register('ktpNumber')} placeholder="16 digit nomor KTP" maxLength={16} />
                {errors.ktpNumber && (
                  <p className="text-destructive text-xs">{errors.ktpNumber.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Alamat *</Label>
                <Textarea {...register('address')} placeholder="Alamat lengkap" rows={2} />
                {errors.address && (
                  <p className="text-destructive text-xs">{errors.address.message}</p>
                )}
              </div>
            </div>

            {/* Aplikasi */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Aplikasi Ojol
              </h3>
              <div className="flex flex-wrap gap-2">
                {RIDE_HAILING_OPTIONS.map((app) => (
                  <button
                    key={app}
                    type="button"
                    onClick={() => toggleApp(app)}
                    className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                      (watchApps || []).includes(app)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-input hover:bg-muted'
                    }`}
                  >
                    {app}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowOtherInput(!showOtherInput)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    showOtherInput || customApps.length > 0
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-input hover:bg-muted'
                  }`}
                >
                  Lainnya
                </button>
              </div>
              {(showOtherInput || customApps.length > 0) && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nama aplikasi lain..."
                      value={otherAppInput}
                      onChange={(e) => setOtherAppInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addOtherApp();
                        }
                      }}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addOtherApp}
                      disabled={!otherAppInput.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {customApps.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {customApps.map((app) => (
                        <span
                          key={app}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-secondary text-secondary-foreground"
                        >
                          {app}
                          <button
                            type="button"
                            onClick={() => removeOtherApp(app)}
                            className="hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Penjamin */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Penjamin (Guarantor)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nama Penjamin</Label>
                  <Input {...register('guarantorName')} placeholder="Nama penjamin" />
                </div>
                <div className="space-y-2">
                  <Label>Telepon Penjamin</Label>
                  <Input {...register('guarantorPhone')} placeholder="08xx..." />
                </div>
              </div>
            </div>

            {/* Spouse */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Pasangan (Opsional)
              </h3>
              <div className="space-y-2">
                <Label>Nama Pasangan</Label>
                <Input {...register('spouseName')} placeholder="Nama istri/suami (opsional)" />
              </div>
            </div>

            {/* Catatan */}
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Input {...register('notes')} placeholder="Catatan tambahan (opsional)" />
            </div>

            <p className="text-xs text-muted-foreground">
              * Upload foto dokumen (KTP, SIM, KK, dll) akan tersedia setelah fitur upload
              diimplementasi.
            </p>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Menyimpan...' : editingCustomer ? 'Update' : 'Simpan'}
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
              Yakin ingin menghapus <strong>{deletingCustomer?.fullName}</strong>? Tindakan ini
              tidak dapat dibatalkan.
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
