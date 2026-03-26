-- AlterEnum: Add COMPENSATED to PaymentDayStatus
ALTER TYPE "PaymentDayStatus" ADD VALUE 'COMPENSATED';

-- CreateEnum: ServiceType
CREATE TYPE "ServiceType" AS ENUM ('MINOR', 'MAJOR');

-- CreateEnum: ServiceRecordStatus
CREATE TYPE "ServiceRecordStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- AlterTable: Add compensated_days_paid to contracts
ALTER TABLE "contracts" ADD COLUMN "compensated_days_paid" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: service_records
CREATE TABLE "service_records" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "service_type" "ServiceType" NOT NULL,
    "replacement_provided" BOOLEAN NOT NULL DEFAULT false,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "compensation_days" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "attachment" TEXT,
    "day_snapshots" JSONB,
    "status" "ServiceRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "revoked_at" TIMESTAMP(3),
    "revoked_by" TEXT,
    "revoke_reason" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_records_contract_id_idx" ON "service_records"("contract_id");
CREATE INDEX "service_records_status_idx" ON "service_records"("status");

-- AddForeignKey
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
