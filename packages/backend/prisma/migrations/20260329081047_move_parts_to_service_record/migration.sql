/*
  Warnings:

  - You are about to drop the column `parts_repaired` on the `saving_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `parts_replaced` on the `saving_transactions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "saving_transactions" DROP COLUMN "parts_repaired",
DROP COLUMN "parts_replaced";

-- AlterTable
ALTER TABLE "service_records" ADD COLUMN     "parts_repaired" TEXT,
ADD COLUMN     "parts_replaced" TEXT,
ADD COLUMN     "service_cost" INTEGER NOT NULL DEFAULT 0;
