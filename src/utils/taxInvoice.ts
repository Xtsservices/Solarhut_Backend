import PDFDocument from 'pdfkit';
import { BANK_DETAILS } from './bankDetails';
import { getTaxInvoiceById } from '../queries/invoiceQueries';

function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const amount = Math.floor(num);
  const paise = Math.round((num - amount) * 100);
  if (amount === 0 && paise === 0) return 'Zero Rupees only';
  
  function convertHundreds(n: number): string {
    let result = '';
    if (n >= 100) {
      result += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      result += tens[Math.floor(n / 10)];
      if (n % 10 !== 0) result += ' ' + ones[n % 10];
    } else if (n >= 10) {
      result += teens[n - 10];
    } else if (n > 0) {
      result += ones[n];
    }
    return result.trim();
  }
  
  let result = '';
  if (amount >= 100000) {
    const lakhs = Math.floor(amount / 100000);
    result += convertHundreds(lakhs) + ' Lakh ';
    let remainder = amount % 100000;
    if (remainder >= 1000) {
      const thousands = Math.floor(remainder / 1000);
      result += convertHundreds(thousands) + ' Thousand ';
      remainder %= 1000;
    }
    if (remainder > 0) result += convertHundreds(remainder);
  } else if (amount >= 1000) {
    const thousands = Math.floor(amount / 1000);
    result += convertHundreds(thousands) + ' Thousand ';
    const remainder = amount % 1000;
    if (remainder > 0) result += convertHundreds(remainder);
  } else {
    result = convertHundreds(amount);
  }
  
  result = result.trim();
  if (result) result += ' Rupees';
  if (paise > 0) {
    let paiseWords = '';
    if (paise >= 10 && paise < 20) {
      paiseWords = teens[paise - 10];
    } else {
      paiseWords = tens[Math.floor(paise / 10)];
      if (paise % 10 !== 0) paiseWords += (paiseWords ? ' ' : '') + ones[paise % 10];
    }
    result += (result ? ' and ' : '') + paiseWords + ' Paise';
  }
  result += ' only';
  return result;
}

export async function generateTaxInvoicePDF(invoiceData: any): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      // Handle both invoice object and invoiceId
      let invoice = invoiceData;
      if (typeof invoiceData === 'number') {
        invoice = await getTaxInvoiceById(invoiceData);
        if (!invoice) throw new Error('Invoice not found');
      }

      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 12;
      const contentWidth = pageWidth - 2 * margin;

      // === OUTER BORDER ===
      doc.rect(margin, margin, contentWidth, pageHeight - 2 * margin).lineWidth(2).stroke();

      let y = margin + 8;

      // === TITLE ===
      doc.font('Helvetica-Bold').fontSize(18.18).text('Tax Invoice', margin, y, { align: 'center', width: pageWidth - 2 * margin });
      y += 22;

      // === HORIZONTAL LINE BELOW TITLE ===
      doc.moveTo(margin, y).lineTo(margin + contentWidth, y).lineWidth(1).stroke();
      y += 8;

      // === TOP SECTION: Company Info (Left) | Invoice Details (Right) ===
      const leftColX = margin + 8;
      const rightColX = margin + contentWidth / 2 + 2;
      const middleLineX = margin + contentWidth / 2;
      const rowHeight = 18;
      const cellHeight = 14;

      // No vertical line dividing left and right - will use horizontal lines to separate sections
      const sectionStartY = y;

      // LEFT SECTION: Company Details
      doc.font('Helvetica-Bold').fontSize(11.11).text('SOLARHUT', leftColX, y);
      y += 11;
      doc.font('Helvetica').fontSize(8.585)
        .text('GSTIN: 37AAKFS9782N1Z7', leftColX, y)
        .text('Door No: 77-14-13, Ground Floor', leftColX, y + 10)
        .text('Shanthi Nagar, Pypula Road', leftColX, y + 20)
        .text('Ajith Singh Nagar, Vijayawada', leftColX, y + 30)
        .text('NTR District, Andhra Pradesh - 520015', leftColX, y + 40)
        .text('Mobile: 9848992333, 9966177225', leftColX, y + 50)
        .text('www.solarhutsolutions.in', leftColX, y + 60);

      let consigneeY = y + 75;

      // Horizontal line separating Company Info and Consignee
      doc.moveTo(margin, consigneeY - 5).lineTo(middleLineX - 2, consigneeY - 5).lineWidth(0.5).stroke();

      // LEFT SECTION: Consignee (Ship to)
      doc.font('Helvetica-Bold').fontSize(10.1).text('Consignee (Ship to)', leftColX, consigneeY);
      consigneeY += 10;
      doc.font('Helvetica').fontSize(8.08)
        .text(invoice.customer_name || '', leftColX, consigneeY)
        .text(invoice.area || '', leftColX, consigneeY + 9)
        .text((invoice.district || ''), leftColX, consigneeY + 18)
        .text((invoice.pincode || ''), leftColX, consigneeY + 27)
        .text('State Name: ' + (invoice.state || '') + ', Code: 37', leftColX, consigneeY + 36);

      let buyerY = consigneeY + 50;

      // Horizontal line separating Consignee and Buyer
      doc.moveTo(margin, buyerY - 5).lineTo(middleLineX - 2, buyerY - 5).lineWidth(0.5).stroke();

      // LEFT SECTION: Buyer (Bill to)
      doc.font('Helvetica-Bold').fontSize(10.1).text('Buyer (Bill to)', leftColX, buyerY);
      buyerY += 10;
      doc.font('Helvetica').fontSize(8.08)
        .text(invoice.customer_name || '', leftColX, buyerY)
        .text(invoice.area || '', leftColX, buyerY + 9)
        .text((invoice.district || ''), leftColX, buyerY + 18)
        .text((invoice.pincode || ''), leftColX, buyerY + 27)
        .text('State Name: ' + (invoice.state || '') + ', Code: 37', leftColX, buyerY + 36);

      // RIGHT SECTION: Invoice Details Table
      const tableStartY = sectionStartY;
      let rowY = tableStartY;
      const rightTableX = middleLineX + 2;
      const rightTableWidth = margin + contentWidth - rightTableX - 2;
      const rightMid = rightTableX + rightTableWidth / 2;
      const standardRowHeight = 30;
      const termsOfDeliveryHeight = 50;

      // Row 1: Tax-Invoice No. | Date
      doc.rect(rightTableX, rowY, rightTableWidth, standardRowHeight).lineWidth(0.5).stroke();
      doc.moveTo(rightMid, rowY).lineTo(rightMid, rowY + standardRowHeight).lineWidth(0.5).stroke();
      
      doc.font('Helvetica-Bold').fontSize(8.585).text('Tax-Invoice No.', rightTableX + 4, rowY + 3, { width: rightTableWidth / 2 - 8 });
      doc.font('Helvetica').fontSize(8.585).text(invoice.id ? String(invoice.id) : '', rightTableX + 4, rowY + 11, { width: rightTableWidth / 2 - 8 });
      
      doc.font('Helvetica-Bold').fontSize(8.585).text('Date', rightMid + 4, rowY + 3, { width: rightTableWidth / 2 - 8 });
      let invoiceDate = '';
      if (invoice.invoiceDate) {
        if (typeof invoice.invoiceDate === 'string') {
          invoiceDate = new Date(invoice.invoiceDate).toUTCString();
        } else if (invoice.invoiceDate instanceof Date) {
          invoiceDate = invoice.invoiceDate.toUTCString();
        }
      }
      doc.font('Helvetica').fontSize(7.07).text(invoiceDate, rightMid + 4, rowY + 11, { width: rightTableWidth / 2 - 8 });
      rowY += standardRowHeight;

      // Row 2: Delivery Note (full width)
      doc.rect(rightTableX, rowY, rightTableWidth, standardRowHeight).lineWidth(0.5).stroke();
      doc.font('Helvetica-Bold').fontSize(8.585).text('Delivery Note', rightTableX + 4, rowY + 3);
      doc.font('Helvetica').fontSize(8.585).text('', rightTableX + 4, rowY + 11);
      rowY += standardRowHeight;

      // Row 3: Reference No. & Date. | Other References
      doc.rect(rightTableX, rowY, rightTableWidth, standardRowHeight).lineWidth(0.5).stroke();
      doc.moveTo(rightMid, rowY).lineTo(rightMid, rowY + standardRowHeight).lineWidth(0.5).stroke();
      doc.font('Helvetica-Bold').fontSize(8.585).text('Reference No. & Date.', rightTableX + 4, rowY + 3, { width: rightTableWidth / 2 - 8 });
      doc.font('Helvetica').fontSize(8.585).text('', rightTableX + 4, rowY + 11, { width: rightTableWidth / 2 - 8 });
      doc.font('Helvetica-Bold').fontSize(8.585).text('Other References', rightMid + 4, rowY + 3, { width: rightTableWidth / 2 - 8 });
      doc.font('Helvetica').fontSize(8.585).text('', rightMid + 4, rowY + 11, { width: rightTableWidth / 2 - 8 });
      rowY += standardRowHeight;

      // Row 4: Buyer's Order No. | Dated
      doc.rect(rightTableX, rowY, rightTableWidth, standardRowHeight).lineWidth(0.5).stroke();
      doc.moveTo(rightMid, rowY).lineTo(rightMid, rowY + standardRowHeight).lineWidth(0.5).stroke();
      doc.font('Helvetica-Bold').fontSize(8.585).text('Buyer\'s Order No.', rightTableX + 4, rowY + 3, { width: rightTableWidth / 2 - 8 });
      doc.font('Helvetica').fontSize(8.585).text('', rightTableX + 4, rowY + 11, { width: rightTableWidth / 2 - 8 });
      doc.font('Helvetica-Bold').fontSize(8.585).text('Dated', rightMid + 4, rowY + 3, { width: rightTableWidth / 2 - 8 });
      doc.font('Helvetica').fontSize(8.585).text('', rightMid + 4, rowY + 11, { width: rightTableWidth / 2 - 8 });
      rowY += standardRowHeight;

      // Row 5: Dispatch Doc ID. | Delivery Note Date
      doc.rect(rightTableX, rowY, rightTableWidth, standardRowHeight).lineWidth(0.5).stroke();
      doc.moveTo(rightMid, rowY).lineTo(rightMid, rowY + standardRowHeight).lineWidth(0.5).stroke();
      doc.font('Helvetica-Bold').fontSize(8.585).text('Dispatch Doc ID.', rightTableX + 4, rowY + 3, { width: rightTableWidth / 2 - 8 });
      doc.font('Helvetica').fontSize(8.585).text('', rightTableX + 4, rowY + 11, { width: rightTableWidth / 2 - 8 });
      doc.font('Helvetica-Bold').fontSize(8.585).text('Delivery Note Date', rightMid + 4, rowY + 3, { width: rightTableWidth / 2 - 8 });
      doc.font('Helvetica').fontSize(8.585).text('', rightMid + 4, rowY + 11, { width: rightTableWidth / 2 - 8 });
      rowY += standardRowHeight;

      // Row 6: Terms of Delivery (full width) - taller row (no bottom border)
      doc.moveTo(rightTableX, rowY).lineTo(rightTableX + rightTableWidth, rowY).lineWidth(0.5).stroke(); // top border
      doc.moveTo(rightTableX, rowY).lineTo(rightTableX, rowY + termsOfDeliveryHeight).lineWidth(0.5).stroke(); // left border
      doc.moveTo(rightTableX + rightTableWidth, rowY).lineTo(rightTableX + rightTableWidth, rowY + termsOfDeliveryHeight).lineWidth(0.5).stroke(); // right border
      doc.font('Helvetica-Bold').fontSize(8.585).text('Terms of Delivery', rightTableX + 4, rowY + 3);
      doc.font('Helvetica').fontSize(8.585).text('', rightTableX + 4, rowY + 11);

      y = sectionStartY + 200;

      // === HORIZONTAL LINE ===
      doc.moveTo(margin, y).lineTo(margin + contentWidth, y).lineWidth(1).stroke();
      y += 6;

      // === PRODUCT TABLE ===
      const tableX = margin + 4;
      const tableWidth = contentWidth - 8;

      // Column widths - adjusted for better alignment
      const colSl = 25;
      const colDesc = 170;
      const colHSN = 55;
      const colQty = 45;
      const colRate = 70;
      const colRate2 = 50;  // For the tax-exclusive rate
      const colPerLabel = 30;  // For the 'Per' column (kwp)
      const colAmount = 35;

      // Table Header
      const headerRowHeight = 24;
      doc.rect(tableX, y, tableWidth, headerRowHeight).lineWidth(0.5).stroke();
      doc.font('Helvetica-Bold').fontSize(8.08);
      
      let colX = tableX;
      doc.text('Sl No.', colX + 2, y + 5, { width: colSl - 4, align: 'center' });
      doc.moveTo(colX + colSl, y).lineTo(colX + colSl, y + headerRowHeight).lineWidth(0.5).stroke();
      
      colX += colSl;
      doc.text('Description of Goods', colX + 2, y + 5, { width: colDesc - 4, align: 'left' });
      doc.moveTo(colX + colDesc, y).lineTo(colX + colDesc, y + headerRowHeight).lineWidth(0.5).stroke();
      
      colX += colDesc;
      doc.text('HSN/SAC', colX + 2, y + 5, { width: colHSN - 4, align: 'center' });
      doc.moveTo(colX + colHSN, y).lineTo(colX + colHSN, y + headerRowHeight).lineWidth(0.5).stroke();
      
      colX += colHSN;
      doc.text('Quantity', colX + 2, y + 5, { width: colQty - 4, align: 'center' });
      doc.moveTo(colX + colQty, y).lineTo(colX + colQty, y + headerRowHeight).lineWidth(0.5).stroke();
      
      colX += colQty;
      doc.text('Rate (Incl. of Tax)', colX + 2, y + 5, { width: colRate - 4, align: 'center' });
      doc.moveTo(colX + colRate, y).lineTo(colX + colRate, y + headerRowHeight).lineWidth(0.5).stroke();
      
      colX += colRate;
      doc.text('Rate', colX + 2, y + 5, { width: colRate2 - 4, align: 'center' });
      doc.moveTo(colX + colRate2, y).lineTo(colX + colRate2, y + headerRowHeight).lineWidth(0.5).stroke();
      
      colX += colRate2;
      doc.text('Per', colX + 2, y + 5, { width: colPerLabel - 4, align: 'center' });
      doc.moveTo(colX + colPerLabel, y).lineTo(colX + colPerLabel, y + headerRowHeight).lineWidth(0.5).stroke();
      
      colX += colPerLabel;
      doc.text('Amount', colX + 2, y + 5, { width: colAmount - 4, align: 'right' });

      y += headerRowHeight;

      // Product data
      const hsnRow1 = '85414300';
      const hsnRow2 = '998739';
      
      // Extract kwp value from structure column (e.g., "3kw" -> 3, "4kw" -> 4)
      const structureValue = invoice.structure || '';
      const kwpMatch = structureValue.match(/(\d+)/);
      const kwpQuantity = kwpMatch ? parseInt(kwpMatch[1]) : 1;
      
      const totalAmount = parseFloat(invoice.amount) || 0;
      const amount70 = totalAmount * 0.7;
      const amount30 = totalAmount * 0.3;
      
      // Calculate rates (with and without tax) based on quantity
      const gstRate = parseFloat(invoice.cgst_percentage) || 0;
      const totalGSTRate = gstRate * 2; // CGST + SGST for AP
      const rate70IncTax = kwpQuantity > 0 ? amount70 / kwpQuantity : 0;
      const rate30IncTax = kwpQuantity > 0 ? amount30 / kwpQuantity : 0;
      const rate70ExcTax = rate70IncTax / (1 + totalGSTRate / 100);
      const rate30ExcTax = rate30IncTax / (1 + totalGSTRate / 100);
      
      // Dynamic row height based on content
      const productRowHeight = 20;

      // Row 1 - 70% of amount
      doc.rect(tableX, y, tableWidth, productRowHeight).lineWidth(0.5).stroke();
      doc.font('Helvetica').fontSize(8.08);
      
      colX = tableX;
      doc.text('1', colX + 2, y + 2, { width: colSl - 4, align: 'center' });
      doc.moveTo(colX + colSl, y).lineTo(colX + colSl, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colSl;
      doc.text(invoice.product_description || '', colX + 2, y + 2, { width: colDesc - 4 });
      doc.moveTo(colX + colDesc, y).lineTo(colX + colDesc, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colDesc;
      doc.text(hsnRow1, colX + 2, y + 2, { width: colHSN - 4, align: 'center' });
      doc.moveTo(colX + colHSN, y).lineTo(colX + colHSN, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colHSN;
      doc.text(kwpQuantity.toString(), colX + 2, y + 2, { width: colQty - 4, align: 'center' });
      doc.moveTo(colX + colQty, y).lineTo(colX + colQty, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colQty;
      doc.text('₹ ' + rate70IncTax.toFixed(2), colX + 2, y + 2, { width: colRate - 4, align: 'center' });
      doc.moveTo(colX + colRate, y).lineTo(colX + colRate, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colRate;
      doc.text('₹ ' + rate70ExcTax.toFixed(2), colX + 2, y + 2, { width: colRate2 - 4, align: 'center' });
      doc.moveTo(colX + colRate2, y).lineTo(colX + colRate2, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colRate2;
      doc.text('kwp', colX + 2, y + 2, { width: colPerLabel - 4, align: 'center' });
      doc.moveTo(colX + colPerLabel, y).lineTo(colX + colPerLabel, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colPerLabel;
      doc.text('₹ ' + amount70.toFixed(2), colX + 2, y + 2, { width: colAmount - 4, align: 'right' });

      y += productRowHeight;

      // Row 2 - 30% of amount
      doc.rect(tableX, y, tableWidth, productRowHeight).lineWidth(0.5).stroke();
      doc.font('Helvetica').fontSize(8.08);
      
      colX = tableX;
      doc.text('2', colX + 2, y + 2, { width: colSl - 4, align: 'center' });
      doc.moveTo(colX + colSl, y).lineTo(colX + colSl, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colSl;
      doc.text('VIKRAM SOLAR PANELS', colX + 2, y + 2, { width: colDesc - 4 });
      doc.moveTo(colX + colDesc, y).lineTo(colX + colDesc, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colDesc;
      doc.text(hsnRow2, colX + 2, y + 2, { width: colHSN - 4, align: 'center' });
      doc.moveTo(colX + colHSN, y).lineTo(colX + colHSN, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colHSN;
      doc.text('', colX + 2, y + 2, { width: colQty - 4, align: 'center' });
      doc.moveTo(colX + colQty, y).lineTo(colX + colQty, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colQty;
      doc.text('', colX + 2, y + 2, { width: colRate - 4, align: 'right' });
      doc.moveTo(colX + colRate, y).lineTo(colX + colRate, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colRate;
      doc.text('', colX + 2, y + 2, { width: colRate2 - 4, align: 'right' });
      doc.moveTo(colX + colRate2, y).lineTo(colX + colRate2, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colRate2;
      doc.text('', colX + 2, y + 2, { width: colPerLabel - 4, align: 'center' });
      doc.moveTo(colX + colPerLabel, y).lineTo(colX + colPerLabel, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colPerLabel;
      doc.text('₹ ' + amount30.toFixed(2), colX + 2, y + 2, { width: colAmount - 4, align: 'right' });

      y += productRowHeight;

      // Subtotal row
      doc.rect(tableX, y, tableWidth, 11).lineWidth(0.5).stroke();
      doc.font('Helvetica-Bold').fontSize(8.08);
      colX = tableX + colSl + colDesc + colHSN + colQty + colRate + colRate2 + colPerLabel;
      doc.text('Subtotal', tableX + 8, y + 1);
      doc.text('₹ ' + totalAmount.toFixed(2), colX + 2, y + 1, { width: colAmount - 4, align: 'right' });

      y += 11;

      // Tax calculations
      const cgstRate = parseFloat(invoice.cgst_percentage) || 0;
      const sgstRate = parseFloat(invoice.sgst_percentage) || 0;
      const igstRate = parseFloat(invoice.igst_percentage) || 0;
      const cgstAmount = parseFloat(invoice.cgst_value) || 0;
      const sgstAmount = parseFloat(invoice.sgst_value) || 0;
      const igstAmount = parseFloat(invoice.igst_value) || 0;
      const isAP = invoice.state?.toLowerCase() === 'andhra pradesh';

      // CGST row (if AP)
      if (isAP) {
        doc.rect(tableX, y, tableWidth, 11).lineWidth(0.5).stroke();
        doc.font('Helvetica').fontSize(8.08);
        colX = tableX + colSl + colDesc + colHSN + colQty + colRate + colRate2 + colPerLabel;
        doc.text('CGST', tableX + 8, y + 1);
        doc.text('₹ ' + cgstAmount.toFixed(2), colX + 2, y + 1, { width: colAmount - 4, align: 'right' });
        y += 11;

        // SGST row
        doc.rect(tableX, y, tableWidth, 11).lineWidth(0.5).stroke();
        doc.font('Helvetica').fontSize(8.08);
        doc.text('SGST', tableX + 8, y + 1);
        doc.text('₹ ' + sgstAmount.toFixed(2), colX + 2, y + 1, { width: colAmount - 4, align: 'right' });
        y += 11;
      } else {
        // IGST row (non-AP)
        doc.rect(tableX, y, tableWidth, 11).lineWidth(0.5).stroke();
        doc.font('Helvetica').fontSize(8.08);
        colX = tableX + colSl + colDesc + colHSN + colQty + colRate + colRate2 + colPerLabel;
        doc.text('IGST', tableX + 8, y + 1);
        doc.text('₹ ' + igstAmount.toFixed(2), colX + 2, y + 1, { width: colAmount - 4, align: 'right' });
        y += 11;
      }

      // Total row
      doc.rect(tableX, y, tableWidth, 11).lineWidth(0.5).stroke();
      doc.font('Helvetica-Bold').fontSize(8.08);
      const totalTaxAmount = cgstAmount + sgstAmount + igstAmount;
      const grandTotal = totalAmount + totalTaxAmount;
      colX = tableX + colSl + colDesc + colHSN + colQty + colRate + colRate2 + colPerLabel;
      doc.text('Total', tableX + 8, y + 1);
      doc.text('₹ ' + grandTotal.toFixed(2), colX + 2, y + 1, { width: colAmount - 4, align: 'right' });

      y += 14;

      // === AMOUNT IN WORDS ===
      const amountWords = numberToWords(totalAmount);
      doc.font('Helvetica-Bold').fontSize(9.09).text('Amount Chargeable (in words) : INR ' + amountWords, tableX, y);
      y += 14;

      // === TAX SUMMARY TABLE ===
      const taxTableX = tableX;
      const taxColWidth = (tableWidth) / 9;

      // Tax table header
      doc.rect(taxTableX, y, tableWidth, 12).lineWidth(0.5).stroke();
      doc.font('Helvetica-Bold').fontSize(7.07);

      colX = taxTableX;
      doc.text('HSN/SAC', colX + 2, y + 3, { width: taxColWidth - 4, align: 'center' });
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 12).lineWidth(0.5).stroke();

      colX += taxColWidth;
      doc.text('Taxable Value', colX + 2, y + 3, { width: taxColWidth - 4, align: 'center' });
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 12).lineWidth(0.5).stroke();

      colX += taxColWidth;
      doc.text('CGST Rate', colX + 2, y + 3, { width: taxColWidth - 4, align: 'center' });
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 12).lineWidth(0.5).stroke();

      colX += taxColWidth;
      doc.text('CGST Amt', colX + 2, y + 3, { width: taxColWidth - 4, align: 'center' });
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 12).lineWidth(0.5).stroke();

      colX += taxColWidth;
      doc.text('SGST Rate', colX + 2, y + 3, { width: taxColWidth - 4, align: 'center' });
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 12).lineWidth(0.5).stroke();

      colX += taxColWidth;
      doc.text('SGST Amt', colX + 2, y + 3, { width: taxColWidth - 4, align: 'center' });
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 12).lineWidth(0.5).stroke();

      colX += taxColWidth;
      doc.text('IGST Rate', colX + 2, y + 3, { width: taxColWidth - 4, align: 'center' });
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 12).lineWidth(0.5).stroke();

      colX += taxColWidth;
      doc.text('IGST Amt', colX + 2, y + 3, { width: taxColWidth - 4, align: 'center' });
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 12).lineWidth(0.5).stroke();

      colX += taxColWidth;
      doc.text('Total Tax', colX + 2, y + 3, { width: taxColWidth - 4, align: 'center' });

      y += 12;

      // Tax summary row 1
      doc.rect(taxTableX, y, tableWidth, 10).lineWidth(0.5).stroke();
      doc.font('Helvetica').fontSize(7.07);

      colX = taxTableX;
      doc.text(hsnRow1, colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 10).lineWidth(0.5).stroke();

      colX += taxColWidth;
      doc.text(totalAmount.toFixed(2), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 10).lineWidth(0.5).stroke();

      colX += taxColWidth;
      if (isAP) {
        doc.text((cgstRate / 2).toFixed(2) + '%', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      } else {
        doc.text('0%', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      }
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 10).lineWidth(0.5).stroke();

      colX += taxColWidth;
      if (isAP) {
        doc.text(cgstAmount.toFixed(2), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      } else {
        doc.text('0', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      }
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 10).lineWidth(0.5).stroke();

      colX += taxColWidth;
      if (isAP) {
        doc.text((sgstRate / 2).toFixed(2) + '%', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      } else {
        doc.text('0%', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      }
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 10).lineWidth(0.5).stroke();

      colX += taxColWidth;
      if (isAP) {
        doc.text(sgstAmount.toFixed(2), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      } else {
        doc.text('0', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      }
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 10).lineWidth(0.5).stroke();

      colX += taxColWidth;
      if (!isAP) {
        doc.text(igstRate.toFixed(2) + '%', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      } else {
        doc.text('0%', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      }
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 10).lineWidth(0.5).stroke();

      colX += taxColWidth;
      if (!isAP) {
        doc.text(igstAmount.toFixed(2), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      } else {
        doc.text('0', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      }
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 10).lineWidth(0.5).stroke();

      colX += taxColWidth;
      doc.text(totalTaxAmount.toFixed(2), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });

      y += 10;

      // Tax summary row 2
      doc.rect(taxTableX, y, tableWidth, 10).lineWidth(0.5).stroke();
      doc.font('Helvetica').fontSize(7.07);

      colX = taxTableX;
      doc.text(hsnRow1, colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 10).lineWidth(0.5).stroke();

      colX += taxColWidth;
      doc.text(totalAmount.toFixed(2), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 10).lineWidth(0.5).stroke();

      colX += taxColWidth;
      if (isAP) {
        doc.text((cgstRate / 2).toFixed(2) + '%', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      } else {
        doc.text('0%', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      }
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 10).lineWidth(0.5).stroke();

      colX += taxColWidth;
      if (isAP) {
        doc.text(cgstAmount.toFixed(2), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      } else {
        doc.text('0', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      }
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 10).lineWidth(0.5).stroke();

      colX += taxColWidth;
      if (isAP) {
        doc.text((sgstRate / 2).toFixed(2) + '%', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      } else {
        doc.text('0%', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      }
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 10).lineWidth(0.5).stroke();

      colX += taxColWidth;
      if (isAP) {
        doc.text(sgstAmount.toFixed(2), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      } else {
        doc.text('0', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      }
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 10).lineWidth(0.5).stroke();

      colX += taxColWidth;
      if (!isAP) {
        doc.text(igstRate.toFixed(2) + '%', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      } else {
        doc.text('0%', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      }
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 10).lineWidth(0.5).stroke();

      colX += taxColWidth;
      if (!isAP) {
        doc.text(igstAmount.toFixed(2), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      } else {
        doc.text('0', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      }
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 10).lineWidth(0.5).stroke();

      colX += taxColWidth;
      doc.text(totalTaxAmount.toFixed(2), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });

      y += 10;

      // TOTAL row
      doc.rect(taxTableX, y, tableWidth, 10).lineWidth(0.5).stroke();
      doc.font('Helvetica-Bold').fontSize(7.07);

      colX = taxTableX;
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 10).lineWidth(0.5).stroke();
      doc.text('TOTAL', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });

      colX += taxColWidth;
      doc.text((totalAmount * 2).toFixed(2), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + 10).lineWidth(0.5).stroke();

      for (let i = 0; i < 6; i++) {
        colX += taxColWidth;
        doc.moveTo(colX, y).lineTo(colX, y + 10).lineWidth(0.5).stroke();
      }

      colX += taxColWidth;
      doc.text((totalTaxAmount * 2).toFixed(2), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });

      y += 12;

      // === TAX AMOUNT IN WORDS ===
      const taxWords = numberToWords(totalTaxAmount);
      doc.font('Helvetica-Bold').fontSize(9.09).text('Tax Amount (in words) : INR ' + taxWords, tableX, y);

      y += 14;

      // === HORIZONTAL LINE ===
      doc.moveTo(margin, y).lineTo(margin + contentWidth, y).lineWidth(1).stroke();
      y += 6;

      // === BANK DETAILS & DECLARATION ===
      const bankX = tableX;
      const declX = tableX + tableWidth / 2 + 10;

      doc.font('Helvetica-Bold').fontSize(10.1).text('Company Bank Details', bankX, y);
      y += 10;
      doc.font('Helvetica').fontSize(8.585)
        .text('Bank Name: ' + BANK_DETAILS.bankName, bankX, y)
        .text('Account Name: ' + BANK_DETAILS.accountName, bankX, y + 10)
        .text('Account Number: ' + BANK_DETAILS.accountNumber, bankX, y + 20)
        .text('IFSC: ' + BANK_DETAILS.ifsc, bankX, y + 30)
        .text('Branch: ' + BANK_DETAILS.branch, bankX, y + 40);

      // Declaration
      doc.font('Helvetica-Bold').fontSize(10.1).text('Declaration', declX, y);
      y += 10;
      doc.font('Helvetica').fontSize(8.08).text('We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.', declX, y, { width: 180 });

      // === SIGNATURE ===
      y += 50;
      doc.font('Helvetica-Bold').fontSize(10.1).text('For SOLARHUT', declX + 50, y, { align: 'right', width: 100 });
      doc.moveTo(declX + 50, y + 10).lineTo(declX + 150, y + 10).stroke();
      doc.font('Helvetica').fontSize(9.09).text('Authorised Signatory', declX + 50, y + 12, { align: 'right', width: 100 });

      doc.end();
    } catch (err) {
      console.error('[PDF ERROR]', err);
      reject(err);
    }
  });
}
