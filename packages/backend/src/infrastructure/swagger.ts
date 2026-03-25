import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WEDISON RTO API',
      version: '1.0.0',
      description:
        'Internal API untuk sistem manajemen Rent To Own (RTO) motor listrik WEDISON. Digunakan oleh admin internal untuk mengelola customer, kontrak, pembayaran, dan laporan.',
      contact: {
        name: 'WEDISON IT Team',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'API Base Path',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Token dari login endpoint',
        },
      },
      schemas: {
        // Auth
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', example: 'admin' },
            password: { type: 'string', example: 'admin123' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                username: { type: 'string' },
                fullName: { type: 'string' },
                role: { type: 'string', enum: ['SUPER_ADMIN', 'ADMIN', 'VIEWER'] },
              },
            },
          },
        },

        // Customer
        Customer: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            fullName: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
            address: { type: 'string' },
            birthDate: { type: 'string' },
            gender: { type: 'string', enum: ['MALE', 'FEMALE'] },
            ktpNumber: { type: 'string' },
            notes: { type: 'string' },
            isDeleted: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateCustomerRequest: {
          type: 'object',
          required: ['fullName', 'phone', 'email', 'address', 'ktpNumber'],
          properties: {
            fullName: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
            address: { type: 'string' },
            birthDate: { type: 'string' },
            gender: { type: 'string', enum: ['MALE', 'FEMALE'] },
            ktpNumber: { type: 'string' },
            guarantorName: { type: 'string' },
            guarantorPhone: { type: 'string' },
            spouseName: { type: 'string' },
            notes: { type: 'string' },
          },
        },

        // Contract
        Contract: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            contractNumber: { type: 'string', example: 'RTO-260305-0001' },
            customerId: { type: 'string', format: 'uuid' },
            motorModel: {
              type: 'string',
              enum: ['ATHENA', 'VICTORY', 'EDPOWER'],
            },
            batteryType: { type: 'string', enum: ['REGULAR', 'EXTENDED'] },
            dailyRate: { type: 'number' },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'COMPLETED', 'OVERDUE', 'CANCELLED', 'REPOSSESSED'],
            },
            holidayScheme: { type: 'string', enum: ['OLD_CONTRACT', 'NEW_CONTRACT'] },
            totalDaysPaid: { type: 'integer' },
            ownershipProgress: { type: 'number' },
            dpAmount: { type: 'number' },
            dpFullyPaid: { type: 'boolean' },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
          },
        },
        CreateContractRequest: {
          type: 'object',
          required: ['customerId', 'motorModel', 'batteryType', 'dpScheme', 'holidayScheme'],
          properties: {
            customerId: { type: 'string', format: 'uuid' },
            motorModel: { type: 'string', enum: ['ATHENA', 'VICTORY', 'EDPOWER'] },
            batteryType: { type: 'string', enum: ['REGULAR', 'EXTENDED'] },
            dpScheme: { type: 'string', enum: ['FULL', 'INSTALLMENT'] },
            holidayScheme: { type: 'string', enum: ['OLD_CONTRACT', 'NEW_CONTRACT'] },
            color: { type: 'string' },
            year: { type: 'integer' },
            vinNumber: { type: 'string' },
            engineNumber: { type: 'string' },
            notes: { type: 'string' },
          },
        },

        // Invoice / Payment
        Invoice: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            invoiceNumber: { type: 'string', example: 'PMT-260305-0001' },
            contractId: { type: 'string', format: 'uuid' },
            amount: { type: 'number' },
            lateFee: { type: 'number' },
            type: {
              type: 'string',
              enum: ['DP', 'DP_INSTALLMENT', 'DAILY_BILLING', 'MANUAL_PAYMENT'],
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'VOID'],
            },
            dueDate: { type: 'string', format: 'date-time' },
            paidAt: { type: 'string', format: 'date-time', nullable: true },
            dailyRate: { type: 'number', nullable: true },
            daysCount: { type: 'integer', nullable: true },
            periodStart: { type: 'string', format: 'date-time', nullable: true },
            periodEnd: { type: 'string', format: 'date-time', nullable: true },
            isHoliday: { type: 'boolean' },
          },
        },

        // Settings
        Setting: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            key: { type: 'string' },
            value: { type: 'string' },
            description: { type: 'string' },
          },
        },

        // Error
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },

        // Paginated response
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: { type: 'array', items: {} },
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Autentikasi (login/logout)' },
      { name: 'Dashboard', description: 'Statistik dashboard' },
      { name: 'Customers', description: 'Manajemen data customer' },
      { name: 'Contracts', description: 'Manajemen kontrak RTO' },
      { name: 'Payments', description: 'Tagihan & pembayaran (DP, harian, manual)' },
      { name: 'Reports', description: 'Laporan & export data' },
      { name: 'Audit Logs', description: 'Log aktivitas sistem' },
      { name: 'Settings', description: 'Konfigurasi sistem' },
      { name: 'Savings', description: 'Tabungan kontrak' },
    ],
    paths: {
      // ========== AUTH ==========
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login admin',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } },
            },
          },
          responses: {
            200: {
              description: 'Login berhasil',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } },
              },
            },
            401: { description: 'Username/password salah' },
          },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Logout',
          responses: { 200: { description: 'Logout berhasil' } },
        },
      },
      '/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Get current user info',
          responses: { 200: { description: 'User info' } },
        },
      },

      // ========== DASHBOARD ==========
      '/dashboard/stats': {
        get: {
          tags: ['Dashboard'],
          summary: 'Get statistik dashboard',
          responses: { 200: { description: 'Dashboard stats' } },
        },
      },

      // ========== CUSTOMERS ==========
      '/customers': {
        get: {
          tags: ['Customers'],
          summary: 'List semua customer',
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Daftar customer (paginated)' } },
        },
        post: {
          tags: ['Customers'],
          summary: 'Tambah customer baru',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateCustomerRequest' },
              },
            },
          },
          responses: {
            201: { description: 'Customer berhasil dibuat' },
            400: { description: 'Validation error' },
          },
        },
      },
      '/customers/{id}': {
        get: {
          tags: ['Customers'],
          summary: 'Get customer by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Detail customer' },
            404: { description: 'Customer tidak ditemukan' },
          },
        },
        put: {
          tags: ['Customers'],
          summary: 'Update customer',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Customer berhasil diupdate' } },
        },
        delete: {
          tags: ['Customers'],
          summary: 'Soft delete customer',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Customer berhasil dihapus (soft delete)' } },
        },
      },

      // ========== CONTRACTS ==========
      '/contracts': {
        get: {
          tags: ['Contracts'],
          summary: 'List semua kontrak',
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['ACTIVE', 'COMPLETED', 'OVERDUE', 'CANCELLED', 'REPOSSESSED'],
              },
            },
          ],
          responses: { 200: { description: 'Daftar kontrak (paginated)' } },
        },
        post: {
          tags: ['Contracts'],
          summary: 'Buat kontrak baru',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateContractRequest' },
              },
            },
          },
          responses: {
            201: { description: 'Kontrak berhasil dibuat + DP invoice generated' },
            400: { description: 'Validation error' },
          },
        },
      },
      '/contracts/overdue-warnings': {
        get: {
          tags: ['Contracts'],
          summary: 'Get kontrak yang mendekati/sudah overdue',
          responses: { 200: { description: 'Daftar kontrak overdue warnings' } },
        },
      },
      '/contracts/customer/{customerId}': {
        get: {
          tags: ['Contracts'],
          summary: 'Get kontrak berdasarkan customer ID',
          parameters: [
            { name: 'customerId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Daftar kontrak customer' } },
        },
      },
      '/contracts/{id}': {
        get: {
          tags: ['Contracts'],
          summary: 'Get kontrak by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Detail kontrak' } },
        },
        put: {
          tags: ['Contracts'],
          summary: 'Edit kontrak',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Kontrak berhasil diupdate' } },
        },
        delete: {
          tags: ['Contracts'],
          summary: 'Soft delete kontrak',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Kontrak berhasil dihapus (soft delete)' } },
        },
      },
      '/contracts/{id}/detail': {
        get: {
          tags: ['Contracts'],
          summary: 'Get detail lengkap kontrak (termasuk customer, payments)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Detail kontrak lengkap' } },
        },
      },
      '/contracts/{id}/extend': {
        post: {
          tags: ['Contracts'],
          summary: 'Perpanjang kontrak (tambah hari)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { days: { type: 'integer', minimum: 1 } },
                },
              },
            },
          },
          responses: { 200: { description: 'Kontrak berhasil diperpanjang' } },
        },
      },
      '/contracts/{id}/receive-unit': {
        patch: {
          tags: ['Contracts'],
          summary: 'Terima unit motor (BAST)',
          description: 'DP harus lunas sebelum bisa terima unit. bastPhoto wajib.',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['bastPhoto'],
                  properties: {
                    bastPhoto: { type: 'string' },
                    bastNotes: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Unit berhasil diterima, billing dimulai H+1' },
            400: { description: 'DP belum lunas' },
          },
        },
      },
      '/contracts/{id}/repossess': {
        patch: {
          tags: ['Contracts'],
          summary: 'Tarik motor (repossess)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Motor berhasil ditarik' } },
        },
      },
      '/contracts/{id}/cancel': {
        patch: {
          tags: ['Contracts'],
          summary: 'Batalkan kontrak',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { reason: { type: 'string' } },
                },
              },
            },
          },
          responses: { 200: { description: 'Kontrak berhasil dibatalkan' } },
        },
      },
      '/contracts/{id}/status': {
        patch: {
          tags: ['Contracts'],
          summary: 'Update status kontrak secara manual',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Status kontrak berhasil diupdate' } },
        },
      },

      // ========== PAYMENTS ==========
      '/payments': {
        get: {
          tags: ['Payments'],
          summary: 'List semua pembayaran',
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          ],
          responses: { 200: { description: 'Daftar pembayaran (paginated)' } },
        },
      },
      '/payments/search': {
        get: {
          tags: ['Payments'],
          summary: 'Cari pembayaran',
          parameters: [
            { name: 'q', in: 'query', schema: { type: 'string' } },
            {
              name: 'status',
              in: 'query',
              schema: { type: 'string', enum: ['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'VOID'] },
            },
            {
              name: 'type',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['DP', 'DP_INSTALLMENT', 'DAILY_BILLING', 'MANUAL_PAYMENT'],
              },
            },
          ],
          responses: { 200: { description: 'Hasil pencarian' } },
        },
      },
      '/payments/contract/{contractId}': {
        get: {
          tags: ['Payments'],
          summary: 'Get pembayaran berdasarkan kontrak',
          parameters: [
            { name: 'contractId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Daftar pembayaran kontrak' } },
        },
      },
      '/payments/contract/{contractId}/active': {
        get: {
          tags: ['Payments'],
          summary: 'Get tagihan aktif (PENDING) untuk kontrak',
          parameters: [
            { name: 'contractId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Tagihan aktif' } },
        },
      },
      '/payments/contract/{contractId}/calendar': {
        get: {
          tags: ['Payments'],
          summary: 'Get data kalender pembayaran',
          parameters: [
            { name: 'contractId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'month', in: 'query', schema: { type: 'integer' } },
            { name: 'year', in: 'query', schema: { type: 'integer' } },
          ],
          responses: {
            200: { description: 'Calendar data (paid/pending/overdue/holiday/not_issued)' },
          },
        },
      },
      '/payments/contract/{contractId}/manual-preview': {
        get: {
          tags: ['Payments'],
          summary: 'Preview tagihan manual (1-7 hari)',
          parameters: [
            { name: 'contractId', in: 'path', required: true, schema: { type: 'string' } },
            {
              name: 'days',
              in: 'query',
              required: true,
              schema: { type: 'integer', minimum: 1, maximum: 7 },
            },
          ],
          responses: { 200: { description: 'Preview amount & detail' } },
        },
      },
      '/payments/contract/{contractId}/manual': {
        post: {
          tags: ['Payments'],
          summary: 'Buat tagihan manual (1-7 hari ke depan)',
          parameters: [
            { name: 'contractId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['days'],
                  properties: { days: { type: 'integer', minimum: 1, maximum: 7 } },
                },
              },
            },
          },
          responses: {
            201: { description: 'Tagihan manual berhasil dibuat' },
            400: { description: 'Validation error' },
          },
        },
      },
      '/payments/contract/{contractId}/day/{date}': {
        patch: {
          tags: ['Payments'],
          summary: 'Update status PaymentDay',
          parameters: [
            { name: 'contractId', in: 'path', required: true, schema: { type: 'string' } },
            {
              name: 'date',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'date' },
            },
          ],
          responses: { 200: { description: 'PaymentDay status berhasil diupdate' } },
        },
      },
      '/payments/bulk-pay': {
        post: {
          tags: ['Payments'],
          summary: 'Bayar banyak tagihan sekaligus',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    paymentIds: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Bulk payment berhasil' } },
        },
      },
      '/payments/{id}': {
        get: {
          tags: ['Payments'],
          summary: 'Get detail pembayaran by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Detail pembayaran' } },
        },
      },
      '/payments/{id}/qr': {
        get: {
          tags: ['Payments'],
          summary: 'Get QR code pembayaran',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'QR code image' } },
        },
      },
      '/payments/{id}/pdf': {
        get: {
          tags: ['Payments'],
          summary: 'Download invoice PDF',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: {
              description: 'PDF file',
              content: { 'application/pdf': {} },
            },
          },
        },
      },
      '/payments/{id}/pay': {
        post: {
          tags: ['Payments'],
          summary: 'Bayar tagihan (proses pembayaran)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Pembayaran berhasil diproses' } },
        },
      },
      '/payments/{id}/simulate': {
        post: {
          tags: ['Payments'],
          summary: 'Simulasi pembayaran (tanpa efek)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Hasil simulasi' } },
        },
      },
      '/payments/{id}/mark-paid': {
        patch: {
          tags: ['Payments'],
          summary: 'Tandai tagihan sebagai PAID (admin)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Tagihan ditandai PAID' } },
        },
      },
      '/payments/{id}/void': {
        patch: {
          tags: ['Payments'],
          summary: 'Void tagihan',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Tagihan di-void' } },
        },
      },
      '/payments/{id}/revert': {
        patch: {
          tags: ['Payments'],
          summary: 'Revert status tagihan (PAID/VOID → PENDING)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Status tagihan di-revert' } },
        },
      },
      '/payments/{id}/cancel': {
        patch: {
          tags: ['Payments'],
          summary: 'Cancel tagihan',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Tagihan di-cancel' } },
        },
      },
      '/payments/{id}/reduce': {
        post: {
          tags: ['Payments'],
          summary: 'Kurangi jumlah hari tagihan',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Tagihan berhasil dikurangi' } },
        },
      },

      // ========== REPORTS ==========
      '/reports': {
        get: {
          tags: ['Reports'],
          summary: 'Get laporan',
          parameters: [
            { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
            { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          ],
          responses: { 200: { description: 'Data laporan' } },
        },
      },
      '/reports/export/json': {
        get: {
          tags: ['Reports'],
          summary: 'Export laporan (JSON)',
          responses: { 200: { description: 'JSON file' } },
        },
      },
      '/reports/export/csv': {
        get: {
          tags: ['Reports'],
          summary: 'Export laporan (CSV)',
          responses: { 200: { description: 'CSV file' } },
        },
      },
      '/reports/export/xlsv': {
        get: {
          tags: ['Reports'],
          summary: 'Export laporan (XLSV)',
          responses: { 200: { description: 'XLSV file' } },
        },
      },

      // ========== AUDIT LOGS ==========
      '/audit-logs': {
        get: {
          tags: ['Audit Logs'],
          summary: 'List semua audit log',
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          ],
          responses: { 200: { description: 'Daftar audit log' } },
        },
      },
      '/audit-logs/recent': {
        get: {
          tags: ['Audit Logs'],
          summary: 'Get audit log terbaru',
          responses: { 200: { description: 'Audit log terbaru' } },
        },
      },

      // ========== SETTINGS ==========
      '/settings': {
        get: {
          tags: ['Settings'],
          summary: 'Get semua settings',
          responses: { 200: { description: 'Daftar settings' } },
        },
        put: {
          tags: ['Settings'],
          summary: 'Update settings',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    key: { type: 'string' },
                    value: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Setting berhasil diupdate' } },
        },
      },
      '/settings/rates': {
        get: {
          tags: ['Settings'],
          summary: 'Get tarif harian per model motor',
          responses: { 200: { description: 'Motor daily rates' } },
        },
      },

      // ========== SAVINGS ==========
      '/savings/contract/{contractId}': {
        get: {
          tags: ['Savings'],
          summary: 'Get transaksi tabungan per kontrak',
          parameters: [
            { name: 'contractId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Daftar transaksi tabungan' } },
        },
      },
      '/savings/contract/{contractId}/balance': {
        get: {
          tags: ['Savings'],
          summary: 'Get saldo tabungan kontrak',
          parameters: [
            { name: 'contractId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Saldo tabungan' } },
        },
      },
      '/savings/contract/{contractId}/debit/service': {
        post: {
          tags: ['Savings'],
          summary: 'Debit tabungan untuk servis motor',
          parameters: [
            { name: 'contractId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Debit berhasil' } },
        },
      },
      '/savings/contract/{contractId}/debit/transfer': {
        post: {
          tags: ['Savings'],
          summary: 'Debit tabungan untuk transfer',
          parameters: [
            { name: 'contractId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Debit berhasil' } },
        },
      },
      '/savings/contract/{contractId}/claim': {
        post: {
          tags: ['Savings'],
          summary: 'Klaim tabungan (pencairan)',
          parameters: [
            { name: 'contractId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Klaim berhasil' } },
        },
      },
      '/savings/contract/{contractId}/recalculate': {
        post: {
          tags: ['Savings'],
          summary: 'Recalculate saldo tabungan',
          parameters: [
            { name: 'contractId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Saldo berhasil dihitung ulang' } },
        },
      },
    },
  },
  apis: [], // We define paths inline above, no need for JSDoc scanning
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'WEDISON RTO API Docs',
    }),
  );

  // Expose raw OpenAPI spec
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}
