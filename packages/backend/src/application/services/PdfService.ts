import PDFDocument from 'pdfkit';
import { Invoice, Contract, Customer } from '../../domain/entities';

export class PdfService {
  async generateInvoicePdf(
    invoice: Invoice,
    contract: Contract,
    customer: Customer,
    qrCodeDataUrl?: string,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
      const formatDate = (d: Date | string) => {
        const date = d instanceof Date ? d : new Date(d);
        return date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
      };

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('WEDISON', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text('Motor Listrik - Rent To Own', { align: 'center' });
      doc.moveDown(0.5);

      // Line
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);

      // Invoice title
      doc.fontSize(16).font('Helvetica-Bold').text('INVOICE', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(12).font('Helvetica').text(invoice.invoiceNumber, { align: 'center' });
      doc.moveDown(1);

      // Two columns
      const leftX = 50;
      const rightX = 300;
      let y = doc.y;

      // Left: Customer info
      doc.fontSize(10).font('Helvetica-Bold').text('Tagihan Kepada:', leftX, y);
      y += 15;
      doc.font('Helvetica').text(customer.fullName, leftX, y);
      y += 13;
      doc.text(customer.phone, leftX, y);
      y += 13;
      doc.text(customer.address, leftX, y, { width: 200 });

      // Right: Invoice info
      let ry = doc.y - 41;
      doc.fontSize(10).font('Helvetica-Bold').text('Detail Invoice:', rightX, ry);
      ry += 15;
      doc.font('Helvetica').text(`Tanggal: ${formatDate(invoice.createdAt)}`, rightX, ry);
      ry += 13;
      doc.text(`Jatuh Tempo: ${formatDate(invoice.dueDate)}`, rightX, ry);
      ry += 13;
      doc.text(`No. Kontrak: ${contract.contractNumber}`, rightX, ry);
      ry += 13;
      const statusText =
        invoice.status === 'PAID' ? 'LUNAS' : invoice.status === 'VOID' ? 'VOID' : 'BELUM BAYAR';
      doc.font('Helvetica-Bold').text(`Status: ${statusText}`, rightX, ry);

      doc.y = Math.max(doc.y, ry + 25);
      doc.moveDown(1);

      // Line
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);

      // Invoice items table
      y = doc.y;
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Deskripsi', leftX, y, { width: 280 });
      doc.text('Jumlah', 430, y, { align: 'right', width: 115 });
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);

      doc.font('Helvetica');

      // Motor rental item
      const description = invoice.extensionDays
        ? `Perpanjangan sewa motor ${contract.motorModel} (${invoice.extensionDays} hari)`
        : `Sewa motor ${contract.motorModel} (${contract.durationDays} hari)`;
      doc.text(description, leftX, doc.y, { width: 350 });
      doc.text(formatRp(invoice.amount), 430, doc.y - 12, { align: 'right', width: 115 });
      doc.moveDown(0.3);

      // Late fee if any
      if (invoice.lateFee > 0) {
        doc.text('Denda keterlambatan', leftX, doc.y, { width: 350 });
        doc.text(formatRp(invoice.lateFee), 430, doc.y - 12, { align: 'right', width: 115 });
        doc.moveDown(0.3);
      }

      // Total
      doc.moveDown(0.3);
      doc.moveTo(350, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold');
      doc.text('Total:', 350, doc.y);
      doc.text(formatRp(invoice.amount + invoice.lateFee), 430, doc.y - 12, {
        align: 'right',
        width: 115,
      });
      doc.moveDown(1.5);

      // Payment info
      if (invoice.status === 'PAID' && invoice.paidAt) {
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica-Bold').text('LUNAS', { align: 'center' });
        doc
          .fontSize(9)
          .font('Helvetica')
          .text(`Dibayar pada: ${formatDate(invoice.paidAt)}`, { align: 'center' });
        doc.moveDown(1);
      }

      // Contract progress
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica-Bold').text('Progress Kepemilikan');
      doc.moveDown(0.2);
      doc.font('Helvetica');
      doc.text(`Motor: ${contract.motorModel} | Rate: ${formatRp(contract.dailyRate)}/hari`);
      doc.text(
        `Total hari dibayar: ${contract.totalDaysPaid} / ${contract.ownershipTargetDays} hari (${contract.ownershipProgress}%)`,
      );

      // QR code if provided
      if (qrCodeDataUrl) {
        doc.moveDown(1);
        try {
          const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
          const qrBuffer = Buffer.from(base64Data, 'base64');
          doc.image(qrBuffer, (545 - 100) / 2, doc.y, { width: 100, height: 100 });
          doc.y += 105;
          doc.fontSize(8).text('Scan QR untuk pembayaran', { align: 'center' });
        } catch {
          // Skip QR if parsing fails
        }
      }

      // Footer
      doc.moveDown(2);
      doc.fontSize(8).font('Helvetica').fillColor('gray');
      doc.text('WEDISON Motor Listrik - Rent To Own System', { align: 'center' });
      doc.text(`Invoice generated: ${new Date().toISOString()}`, { align: 'center' });

      doc.end();
    });
  }
}
