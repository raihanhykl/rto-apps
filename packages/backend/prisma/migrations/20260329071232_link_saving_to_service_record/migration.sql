-- DropIndex
DROP INDEX "payment_days_contract_id_date_idx";

-- AlterTable
ALTER TABLE "saving_transactions" ADD COLUMN     "service_record_id" TEXT;

-- CreateIndex
CREATE INDEX "contracts_status_is_deleted_idx" ON "contracts"("status", "is_deleted");

-- CreateIndex
CREATE INDEX "contracts_created_at_idx" ON "contracts"("created_at");

-- CreateIndex
CREATE INDEX "invoices_contract_id_status_type_idx" ON "invoices"("contract_id", "status", "type");

-- CreateIndex
CREATE INDEX "invoices_created_at_idx" ON "invoices"("created_at");

-- CreateIndex
CREATE INDEX "invoices_due_date_idx" ON "invoices"("due_date");

-- CreateIndex
CREATE INDEX "saving_transactions_service_record_id_idx" ON "saving_transactions"("service_record_id");

-- AddForeignKey
ALTER TABLE "saving_transactions" ADD CONSTRAINT "saving_transactions_service_record_id_fkey" FOREIGN KEY ("service_record_id") REFERENCES "service_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
