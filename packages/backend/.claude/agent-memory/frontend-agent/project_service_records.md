---
name: Service Records Feature
description: ServiceRecord types, api methods, SWR hook useServiceRecords, dan section Riwayat Servis di contract detail page
type: project
---

Feature service records (kompensasi servis motor) diimplementasikan di:

- `packages/frontend/src/types/index.ts` — ServiceType, ServiceRecordStatus, DaySnapshot, ServiceRecord enums/interfaces. PaymentDayStatus tambah COMPENSATED. Contract.compensatedDaysPaid (optional).
- `packages/frontend/src/lib/api.ts` — api.getServiceRecordsByContract(), api.getServiceRecordById(), api.createServiceRecord(), api.revokeServiceRecord() methods di ApiClient class.
- `packages/frontend/src/hooks/useApi.ts` — useServiceRecords(contractId: string | null) hook dengan TTL.DEFAULT.
- `packages/frontend/src/components/PaymentCalendar.tsx` — Tambah 'compensated' ke CalendarDay status type dan STATUS_COLORS (violet/purple).
- `packages/frontend/src/app/(dashboard)/contracts/[id]/page.tsx` — Section "Riwayat Servis" collapsible dengan tabel, badge status, tombol Revoke, tombol "Tambah Record Servis", form dialog create, dialog konfirmasi revoke.

**Why:** Backend sudah punya endpoints service-records (POST, GET by contract, GET by id, PATCH revoke). Frontend perlu mengexpose fitur ini ke admin.

**How to apply:** Gunakan `useServiceRecords(contractId)` untuk fetch data. Untuk mutasi gunakan `api.createServiceRecord()` / `api.revokeServiceRecord()` langsung lalu call `mutateServiceRecords()` + `refreshAll()`.
