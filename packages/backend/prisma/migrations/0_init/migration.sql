warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., `prisma.config.ts`).
For more information, see: https://pris.ly/prisma-config

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MotorModel" AS ENUM ('ATHENA', 'VICTORY', 'EDPOWER');

-- CreateEnum
CREATE TYPE "BatteryType" AS ENUM ('REGULAR', 'EXTENDED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'OVERDUE', 'CANCELLED', 'REPOSSESSED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'VOID');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('DP', 'DP_INSTALLMENT', 'DAILY_BILLING', 'MANUAL_PAYMENT');

-- CreateEnum
CREATE TYPE "DPScheme" AS ENUM ('FULL', 'INSTALLMENT');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'PAYMENT', 'EXPORT');

-- CreateEnum
CREATE TYPE "HolidayScheme" AS ENUM ('OLD_CONTRACT', 'NEW_CONTRACT');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'VIEWER');

-- CreateEnum
CREATE TYPE "PaymentDayStatus" AS ENUM ('UNPAID', 'PENDING', 'PAID', 'HOLIDAY', 'VOIDED');

-- CreateEnum
CREATE TYPE "SavingTransactionType" AS ENUM ('CREDIT', 'DEBIT_SERVICE', 'DEBIT_TRANSFER', 'DEBIT_CLAIM', 'REVERSAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "birth_date" TEXT,
    "gender" "Gender",
    "ride_hailing_apps" TEXT[],
    "ktp_number" TEXT NOT NULL,
    "ktp_photo" TEXT,
    "sim_photo" TEXT,
    "kk_photo" TEXT,
    "guarantor_name" TEXT NOT NULL DEFAULT '',
    "guarantor_phone" TEXT NOT NULL DEFAULT '',
    "guarantor_ktp_photo" TEXT,
    "spouse_name" TEXT NOT NULL DEFAULT '',
    "spouse_ktp_photo" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "contract_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "motor_model" "MotorModel" NOT NULL,
    "battery_type" "BatteryType" NOT NULL,
    "daily_rate" DOUBLE PRECISION NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '',
    "year" INTEGER,
    "vin_number" TEXT NOT NULL DEFAULT '',
    "engine_number" TEXT NOT NULL DEFAULT '',
    "dp_amount" DOUBLE PRECISION NOT NULL,
    "dp_scheme" "DPScheme" NOT NULL,
    "dp_paid_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dp_fully_paid" BOOLEAN NOT NULL DEFAULT false,
    "unit_received_date" TIMESTAMP(3),
    "billing_start_date" TIMESTAMP(3),
    "bast_photo" TEXT,
    "bast_notes" TEXT NOT NULL DEFAULT '',
    "holiday_scheme" "HolidayScheme" NOT NULL DEFAULT 'NEW_CONTRACT',
    "ownership_target_days" INTEGER NOT NULL DEFAULT 1278,
    "total_days_paid" INTEGER NOT NULL DEFAULT 0,
    "working_days_paid" INTEGER NOT NULL DEFAULT 0,
    "holiday_days_paid" INTEGER NOT NULL DEFAULT 0,
    "ownership_progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grace_period_days" INTEGER NOT NULL DEFAULT 7,
    "saving_balance" INTEGER NOT NULL DEFAULT 0,
    "repossessed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "late_fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "type" "InvoiceType" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "qr_code_data" TEXT NOT NULL DEFAULT '',
    "due_date" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "extension_days" INTEGER,
    "doku_payment_url" TEXT,
    "doku_reference_id" TEXT,
    "daily_rate" DOUBLE PRECISION,
    "days_count" INTEGER,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "expired_at" TIMESTAMP(3),
    "previous_payment_id" TEXT,
    "is_holiday" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "module" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_address" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_days" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "PaymentDayStatus" NOT NULL DEFAULT 'UNPAID',
    "payment_id" TEXT,
    "daily_rate" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saving_transactions" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "type" "SavingTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_before" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "payment_id" TEXT,
    "days_count" INTEGER,
    "description" TEXT,
    "photo" TEXT,
    "created_by" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saving_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "customers_ktp_number_key" ON "customers"("ktp_number");

-- CreateIndex
CREATE INDEX "customers_is_deleted_idx" ON "customers"("is_deleted");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_contract_number_key" ON "contracts"("contract_number");

-- CreateIndex
CREATE INDEX "contracts_customer_id_idx" ON "contracts"("customer_id");

-- CreateIndex
CREATE INDEX "contracts_status_idx" ON "contracts"("status");

-- CreateIndex
CREATE INDEX "contracts_is_deleted_idx" ON "contracts"("is_deleted");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_contract_id_idx" ON "invoices"("contract_id");

-- CreateIndex
CREATE INDEX "invoices_customer_id_idx" ON "invoices"("customer_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_previous_payment_id_idx" ON "invoices"("previous_payment_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_module_idx" ON "audit_logs"("module");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE INDEX "payment_days_contract_id_status_idx" ON "payment_days"("contract_id", "status");

-- CreateIndex
CREATE INDEX "payment_days_payment_id_idx" ON "payment_days"("payment_id");

-- CreateIndex
CREATE INDEX "payment_days_contract_id_date_idx" ON "payment_days"("contract_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "payment_days_contract_id_date_key" ON "payment_days"("contract_id", "date");

-- CreateIndex
CREATE INDEX "saving_transactions_contract_id_idx" ON "saving_transactions"("contract_id");

-- CreateIndex
CREATE INDEX "saving_transactions_payment_id_idx" ON "saving_transactions"("payment_id");

-- CreateIndex
CREATE INDEX "saving_transactions_type_idx" ON "saving_transactions"("type");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_previous_payment_id_fkey" FOREIGN KEY ("previous_payment_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_days" ADD CONSTRAINT "payment_days_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_days" ADD CONSTRAINT "payment_days_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saving_transactions" ADD CONSTRAINT "saving_transactions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saving_transactions" ADD CONSTRAINT "saving_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
┌─────────────────────────────────────────────────────────┐
│  Update available 6.19.2 -> 7.5.0                       │
│                                                         │
│  This is a major update - please follow the guide at    │
│  https://pris.ly/d/major-version-upgrade                │
│                                                         │
│  Run the following to update                            │
│    npm i --save-dev prisma@latest                       │
│    npm i @prisma/client@latest                          │
└─────────────────────────────────────────────────────────┘

