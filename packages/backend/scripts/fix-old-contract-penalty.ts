/**
 * One-time script: Hapus penalty (lateFee) dari semua invoice PENDING
 * milik kontrak OLD_CONTRACT.
 *
 * Jalankan:
 *   cd packages/backend && npx tsx scripts/fix-old-contract-penalty.ts
 *
 * Atau jika belum ada tsx:
 *   cd packages/backend && npx ts-node scripts/fix-old-contract-penalty.ts
 */

import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  try {
    // Cari semua invoice PENDING yang punya lateFee > 0, milik kontrak OLD_CONTRACT
    const result = await prisma.invoice.updateMany({
      where: {
        status: 'PENDING',
        lateFee: { gt: 0 },
        contract: {
          holidayScheme: 'OLD_CONTRACT',
        },
      },
      data: {
        lateFee: 0,
      },
    });

    console.log(`Done. ${result.count} invoice(s) updated (lateFee set to 0).`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
