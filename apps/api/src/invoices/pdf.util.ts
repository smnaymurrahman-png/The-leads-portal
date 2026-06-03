import PDFDocument from 'pdfkit';

export interface InvoicePdfData {
  invoiceNumber: string;
  issuedAt: Date;
  business: { name: string; address?: string; email?: string };
  client: {
    fullName: string;
    businessName?: string | null;
    email: string;
    address?: string | null;
  };
  order: {
    publicOrderId: string;
    leadType: string;
    deliveryMode: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
  };
  payment: {
    method?: string | null;
    reference?: string | null;
    receivedAt: Date;
  };
}

/**
 * Renders an invoice PDF into a Buffer. Pure function — no filesystem.
 *
 * Layout: header + invoice number, bill-to block, one line-item table row,
 * totals, "PAID" stamp diagonally across the page, payment block at the
 * bottom. Designed to look clean on A4 / US Letter.
 */
export async function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err as Error));

    // Header
    doc.fillColor('#0b1020');
    doc.font('Helvetica-Bold').fontSize(20).text(data.business.name, 50, 50);
    doc.font('Helvetica').fontSize(10).fillColor('#5a607a');
    if (data.business.address) {
      doc.text(data.business.address, 50, 75);
    }
    if (data.business.email) {
      doc.text(data.business.email, 50, 88);
    }

    // Invoice meta (right side)
    doc.fillColor('#0b1020');
    doc.font('Helvetica-Bold').fontSize(28).text('INVOICE', 400, 50, { align: 'right', width: 145 });
    doc.font('Helvetica').fontSize(10).fillColor('#5a607a');
    doc.text(`# ${data.invoiceNumber}`, 400, 88, { align: 'right', width: 145 });
    doc.text(formatDate(data.issuedAt), 400, 102, { align: 'right', width: 145 });

    // Divider
    doc.moveTo(50, 130).lineTo(545, 130).stroke();

    // Bill-to
    doc.fillColor('#0b1020').font('Helvetica-Bold').fontSize(11).text('BILL TO', 50, 150);
    doc.font('Helvetica').fontSize(11).fillColor('#0b1020');
    let y = 168;
    doc.text(data.client.fullName, 50, y);
    y += 14;
    if (data.client.businessName) {
      doc.text(data.client.businessName, 50, y);
      y += 14;
    }
    doc.fillColor('#5a607a').text(data.client.email, 50, y);
    y += 14;
    if (data.client.address) {
      doc.text(data.client.address, 50, y, { width: 250 });
      y += 28;
    }

    // Order reference (right)
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0b1020').text('ORDER', 400, 150, { align: 'right', width: 145 });
    doc.font('Helvetica').fontSize(11).fillColor('#5a607a').text(data.order.publicOrderId, 400, 168, { align: 'right', width: 145 });

    // Line-item table
    const tableTop = Math.max(y + 30, 280);
    doc.fillColor('#5a607a').font('Helvetica-Bold').fontSize(10);
    doc.text('DESCRIPTION', 50, tableTop);
    doc.text('QTY', 330, tableTop, { width: 50, align: 'right' });
    doc.text('UNIT', 390, tableTop, { width: 70, align: 'right' });
    doc.text('TOTAL', 470, tableTop, { width: 75, align: 'right' });
    doc.moveTo(50, tableTop + 16).lineTo(545, tableTop + 16).stroke();

    doc.fillColor('#0b1020').font('Helvetica').fontSize(11);
    const description = `${data.order.leadType} leads (${data.order.deliveryMode})`;
    doc.text(description, 50, tableTop + 26, { width: 270 });
    doc.text(String(data.order.quantity), 330, tableTop + 26, { width: 50, align: 'right' });
    doc.text(money(data.order.unitPrice), 390, tableTop + 26, { width: 70, align: 'right' });
    doc.text(money(data.order.totalAmount), 470, tableTop + 26, { width: 75, align: 'right' });

    // Totals
    const totalsTop = tableTop + 70;
    doc.moveTo(330, totalsTop - 10).lineTo(545, totalsTop - 10).stroke();
    doc.fillColor('#5a607a').font('Helvetica').fontSize(10).text('Subtotal', 390, totalsTop, { width: 70, align: 'right' });
    doc.fillColor('#0b1020').text(money(data.order.totalAmount), 470, totalsTop, { width: 75, align: 'right' });
    doc.fillColor('#5a607a').text('Total', 390, totalsTop + 18, { width: 70, align: 'right' });
    doc.fillColor('#0b1020').font('Helvetica-Bold').fontSize(13).text(money(data.order.totalAmount), 470, totalsTop + 14, { width: 75, align: 'right' });
    doc.fillColor('#5a607a').font('Helvetica').fontSize(10).text('Paid', 390, totalsTop + 44, { width: 70, align: 'right' });
    doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(11).text(money(data.order.totalAmount), 470, totalsTop + 42, { width: 75, align: 'right' });

    // Payment block
    const payTop = totalsTop + 90;
    doc.fillColor('#0b1020').font('Helvetica-Bold').fontSize(11).text('PAYMENT', 50, payTop);
    doc.font('Helvetica').fontSize(10).fillColor('#5a607a');
    doc.text(`Method: ${data.payment.method ? prettyMethod(data.payment.method) : 'Off-platform'}`, 50, payTop + 18);
    if (data.payment.reference) {
      doc.text(`Reference: ${data.payment.reference}`, 50, payTop + 32);
    }
    doc.text(`Received: ${formatDate(data.payment.receivedAt)}`, 50, payTop + 46);

    // PAID stamp (diagonal)
    doc.save();
    doc.rotate(-18, { origin: [400, 420] });
    doc.fillColor('#16a34a').rect(310, 390, 180, 60).stroke();
    doc.font('Helvetica-Bold').fontSize(36).fillColor('#16a34a').text('PAID', 310, 400, { width: 180, align: 'center' });
    doc.restore();

    // Footer
    doc.font('Helvetica').fontSize(9).fillColor('#9aa3bd').text(
      'Generated by the Leads Portal — not a tax document. Off-platform payment received and verified by an administrator.',
      50,
      770,
      { width: 495, align: 'center' },
    );

    doc.end();
  });
}

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function prettyMethod(m: string): string {
  return m
    .toLowerCase()
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}
