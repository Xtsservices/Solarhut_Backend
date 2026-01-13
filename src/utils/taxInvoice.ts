import PDFDocument from 'pdfkit';
import path from 'path';
import { BANK_DETAILS } from './bankDetails';
import { getTaxInvoiceById } from '../queries/invoiceQueries';

// Helper function to format numbers with comma separation
function formatNumberWithCommas(num: number): string {
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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

      // === Add Logo Watermark (centered, low opacity) ===
      doc.save();
      try {
        doc.opacity(0.08);
        doc.image(path.join(__dirname, '../assets/SolarHutLOGO1.png'), 150, 250, { width: 300 });
        doc.opacity(1);
      } catch (e) {
        // If watermark fails, continue without it
      }
      doc.restore();

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 20; // Increased from 12 to 20 for more left margin
      const contentWidth = pageWidth - 2 * margin;

      // === OUTER BORDER ===
      doc.rect(margin, margin, contentWidth, pageHeight - 2 * margin).lineWidth(2).stroke();

      let y = margin + 10;

      // === TITLE ===
      doc.font('Helvetica-Bold').fontSize(20.67).text('Tax Invoice', margin, y, { align: 'center', width: pageWidth - 2 * margin });
      y += 26;

      // === HORIZONTAL LINE BELOW TITLE ===
      doc.moveTo(margin, y).lineTo(margin + contentWidth, y).lineWidth(1).stroke();
      y += 10;

      // === TOP SECTION: Company Info (Left) | Invoice Details (Right) ===
      const leftColX = margin + 8;
      const rightColX = margin + contentWidth / 2 + 2;
      const middleLineX = margin + contentWidth / 2;
      const rowHeight = 18;
      const cellHeight = 14;

      // No vertical line dividing left and right - will use horizontal lines to separate sections
      const sectionStartY = y;

      // LEFT SECTION: Company Details
      doc.font('Helvetica-Bold').fontSize(12.01).text('SOLARHUT', leftColX, y);
      y += 13;
      doc.font('Helvetica').fontSize(9.83)
        .text('GSTIN: 37AAKFS9782N1Z7', leftColX, y)
        .text('Door No: 77-14-13, Ground Floor', leftColX, y + 11)
        .text('Shanthi Nagar, Pypula Road', leftColX, y + 22)
        .text('Ajith Singh Nagar, Vijayawada', leftColX, y + 33)
        .text('NTR District, Andhra Pradesh - 520015', leftColX, y + 44)
        .text('Mobile: 9848992333, 9966177225', leftColX, y + 55)
        .text('www.solarhutsolutions.in', leftColX, y + 66);

      let consigneeY = y + 85;

      // Horizontal line separating Company Info and Consignee
      doc.moveTo(margin, consigneeY - 5).lineTo(middleLineX - 2, consigneeY - 5).lineWidth(0.5).stroke();

      // LEFT SECTION: Consignee (Ship to)
      doc.font('Helvetica-Bold').fontSize(10.92).text('Consignee (Ship to)', leftColX, consigneeY);
      consigneeY += 11;
      doc.font('Helvetica').fontSize(9.19)
        .text(invoice.customer_name || '', leftColX, consigneeY)
        .text(invoice.area || '', leftColX, consigneeY + 10)
        .text((invoice.district || ''), leftColX, consigneeY + 20)
        .text((invoice.pincode || ''), leftColX, consigneeY + 30)
        .text('State Name: ' + (invoice.state || '') + ', Code: 37', leftColX, consigneeY + 40);

      let buyerY = consigneeY + 70;

      // Horizontal line separating Consignee and Buyer
      doc.moveTo(margin, buyerY - 5).lineTo(middleLineX - 2, buyerY - 5).lineWidth(0.5).stroke();

      // LEFT SECTION: Buyer (Bill to)
      doc.font('Helvetica-Bold').fontSize(10.92).text('Buyer (Bill to)', leftColX, buyerY);
      buyerY += 11;
      doc.font('Helvetica').fontSize(9.19)
        .text(invoice.customer_name || '', leftColX, buyerY)
        .text(invoice.area || '', leftColX, buyerY + 10)
        .text((invoice.district || ''), leftColX, buyerY + 20)
        .text((invoice.pincode || ''), leftColX, buyerY + 30)
        .text('State Name: ' + (invoice.state || '') + ', Code: 37', leftColX, buyerY + 40);

      // RIGHT SECTION: Invoice Details Table
      const tableStartY = sectionStartY;
      let rowY = tableStartY;
      const rightTableX = middleLineX + 2;
      const rightTableWidth = margin + contentWidth - rightTableX - 2;
      const rightMid = rightTableX + rightTableWidth / 2;
      const standardRowHeight = 30;
      const termsOfDeliveryHeight = 50;

      // Row 1: Tax-Invoice No. | Date (left, bottom borders + center line)
      doc.moveTo(rightTableX, rowY).lineTo(rightTableX, rowY + standardRowHeight).lineWidth(0.5).stroke(); // left
      doc.moveTo(rightMid, rowY).lineTo(rightMid, rowY + standardRowHeight).lineWidth(0.5).stroke(); // center
      doc.moveTo(rightTableX, rowY + standardRowHeight).lineTo(rightTableX + rightTableWidth, rowY + standardRowHeight).lineWidth(0.5).stroke(); // bottom
      
      doc.font('Helvetica-Bold').fontSize(9.28).text('Tax-Invoice No.', rightTableX + 4, rowY + 3, { width: rightTableWidth / 2 - 8 });
      doc.font('Helvetica-Bold').fontSize(9.19).text(invoice.id ? String(invoice.id) : '', rightTableX + 4, rowY + 11, { width: rightTableWidth / 2 - 8 });
      
      doc.font('Helvetica-Bold').fontSize(9.19).text('Date', rightMid + 4, rowY + 3, { width: rightTableWidth / 2 - 8 });
      let invoiceDate = '';
      if (invoice.invoiceDate) {
        if (typeof invoice.invoiceDate === 'string') {
          const dateObj = new Date(invoice.invoiceDate);
          const day = String(dateObj.getDate()).padStart(2, '0');
          const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
          const year = dateObj.getFullYear();
          invoiceDate = `${day}-${month}-${year}`;
        } else if (invoice.invoiceDate instanceof Date) {
          const day = String(invoice.invoiceDate.getDate()).padStart(2, '0');
          const month = invoice.invoiceDate.toLocaleDateString('en-US', { month: 'short' });
          const year = invoice.invoiceDate.getFullYear();
          invoiceDate = `${day}-${month}-${year}`;
        }
      }
      doc.font('Helvetica-Bold').fontSize(7.64).text(invoiceDate, rightMid + 4, rowY + 11, { width: rightTableWidth / 2 - 8 });
      rowY += standardRowHeight;

      // Row 2: Mode/Terms of Payment | Delivery Note (left, bottom borders + center line only)
      doc.moveTo(rightTableX, rowY + standardRowHeight).lineTo(rightTableX + rightTableWidth, rowY + standardRowHeight).lineWidth(0.5).stroke(); // bottom
      doc.moveTo(rightTableX, rowY).lineTo(rightTableX, rowY + standardRowHeight).lineWidth(0.5).stroke(); // left
      doc.moveTo(rightMid, rowY).lineTo(rightMid, rowY + standardRowHeight).lineWidth(0.5).stroke(); // center
      
      doc.font('Helvetica-Bold').fontSize(9.19).text('Mode/Terms of Payment', rightTableX + 4, rowY + 3, { width: rightTableWidth / 2 - 8 });
      doc.font('Helvetica').fontSize(9.19).text('', rightTableX + 4, rowY + 11, { width: rightTableWidth / 2 - 8 });
      
      doc.font('Helvetica-Bold').fontSize(9.19).text('Delivery Note', rightMid + 4, rowY + 3, { width: rightTableWidth / 2 - 8 });
      doc.font('Helvetica').fontSize(9.19).text('', rightMid + 4, rowY + 11, { width: rightTableWidth / 2 - 8 });
      rowY += standardRowHeight;

      // Row 3: Reference No. & Date. | Other References (left, bottom borders + center line only)
      doc.moveTo(rightTableX, rowY + standardRowHeight).lineTo(rightTableX + rightTableWidth, rowY + standardRowHeight).lineWidth(0.5).stroke(); // bottom
      doc.moveTo(rightTableX, rowY).lineTo(rightTableX, rowY + standardRowHeight).lineWidth(0.5).stroke(); // left
      doc.moveTo(rightMid, rowY).lineTo(rightMid, rowY + standardRowHeight).lineWidth(0.5).stroke(); // center
      doc.font('Helvetica-Bold').fontSize(9.19).text('Reference No. & Date.', rightTableX + 4, rowY + 3, { width: rightTableWidth / 2 - 8 });
      doc.font('Helvetica').fontSize(9.19).text('', rightTableX + 4, rowY + 11, { width: rightTableWidth / 2 - 8 });
      doc.font('Helvetica-Bold').fontSize(9.19).text('Other References', rightMid + 4, rowY + 3, { width: rightTableWidth / 2 - 8 });
      doc.font('Helvetica').fontSize(9.19).text('', rightMid + 4, rowY + 11, { width: rightTableWidth / 2 - 8 });
      rowY += standardRowHeight;

      // Row 4: Buyer's Order No. | Dated (left, bottom borders + center line only)
      doc.moveTo(rightTableX, rowY + standardRowHeight).lineTo(rightTableX + rightTableWidth, rowY + standardRowHeight).lineWidth(0.5).stroke(); // bottom
      doc.moveTo(rightTableX, rowY).lineTo(rightTableX, rowY + standardRowHeight).lineWidth(0.5).stroke(); // left
      doc.moveTo(rightMid, rowY).lineTo(rightMid, rowY + standardRowHeight).lineWidth(0.5).stroke(); // center
      doc.font('Helvetica-Bold').fontSize(9.19).text('Buyer\'s Order No.', rightTableX + 4, rowY + 3, { width: rightTableWidth / 2 - 8 });
      doc.font('Helvetica').fontSize(9.19).text('', rightTableX + 4, rowY + 11, { width: rightTableWidth / 2 - 8 });
      doc.font('Helvetica-Bold').fontSize(9.19).text('Dated', rightMid + 4, rowY + 3, { width: rightTableWidth / 2 - 8 });
      doc.font('Helvetica').fontSize(9.19).text('', rightMid + 4, rowY + 11, { width: rightTableWidth / 2 - 8 });
      rowY += standardRowHeight;

      // Row 5: Dispatch Doc ID. | Delivery Note Date (left, bottom borders + center line only)
      doc.moveTo(rightTableX, rowY + standardRowHeight).lineTo(rightTableX + rightTableWidth, rowY + standardRowHeight).lineWidth(0.5).stroke(); // bottom
      doc.moveTo(rightTableX, rowY).lineTo(rightTableX, rowY + standardRowHeight).lineWidth(0.5).stroke(); // left
      doc.moveTo(rightMid, rowY).lineTo(rightMid, rowY + standardRowHeight).lineWidth(0.5).stroke(); // center
      doc.font('Helvetica-Bold').fontSize(9.19).text('Dispatch Doc ID.', rightTableX + 4, rowY + 3, { width: rightTableWidth / 2 - 8 });
      doc.font('Helvetica').fontSize(9.19).text('', rightTableX + 4, rowY + 11, { width: rightTableWidth / 2 - 8 });
      doc.font('Helvetica-Bold').fontSize(9.19).text('Delivery Note Date', rightMid + 4, rowY + 3, { width: rightTableWidth / 2 - 8 });
      doc.font('Helvetica').fontSize(9.19).text('', rightMid + 4, rowY + 11, { width: rightTableWidth / 2 - 8 });
      rowY += standardRowHeight;

      // Row 6: Terms of Delivery (left border only - no bottom border, no center line)
      const termsOfDeliveryStartY = rowY;
      doc.font('Helvetica-Bold').fontSize(9.19).text('Terms of Delivery', rightTableX + 4, rowY + 3);
      doc.font('Helvetica').fontSize(9.19).text('', rightTableX + 4, rowY + 11);

      y = sectionStartY + 240;

      // Extend left border line of Terms of Delivery up to product table line
      doc.moveTo(rightTableX, termsOfDeliveryStartY).lineTo(rightTableX, y).lineWidth(0.5).stroke();
      y += 8;

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
      const colAmount = 50;  // Increased to properly display values

      // Table Header
      const headerRowHeight = 27;
      doc.rect(tableX, y, tableWidth, headerRowHeight).lineWidth(0.5).stroke();
      doc.font('Helvetica-Bold').fontSize(8.65);
      
      let colX = tableX;
      doc.text('Sl No.', colX + 2, y + 5, { width: colSl - 4, align: 'center' });
      doc.moveTo(colX + colSl, y).lineTo(colX + colSl, y + headerRowHeight).lineWidth(0.5).stroke();
      
      colX += colSl;
      doc.text('Description of Goods', colX + 2, y + 5, { width: colDesc - 4, align: 'center' });
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
      doc.text('Amount', colX + 2, y + 5, { width: colAmount - 4, align: 'center' });

      y += headerRowHeight;

      // Product data
      const hsnRow1 = '85414300';
      const hsnRow2 = '998739';
      
      // Extract kwp value from structure column (e.g., "3kw" -> 3, "4kw" -> 4)
      const structureValue = invoice.structure || '';
      const kwpMatch = structureValue.match(/(\d+)/);
      const kwpQuantity = kwpMatch ? parseInt(kwpMatch[1]) : 1;
      
      // Get total amount from invoice (including GST)
      const totalAmountIncludingGST = parseFloat(invoice.amount) || 0;
      
      // Get tax rates
      const cgstPercentage = parseFloat(invoice.cgst_percentage) || 0;
      const sgstPercentage = parseFloat(invoice.sgst_percentage) || 0;
      const igstPercentage = parseFloat(invoice.igst_percentage) || 0;
      
      // Determine if buyer is from AP
      const isAP = invoice.state?.toLowerCase() === 'andhra pradesh';
      
      // Calculate combined tax rate
      let combinedTaxRate = 0;
      if (isAP) {
        combinedTaxRate = cgstPercentage + sgstPercentage; // CGST + SGST
      } else {
        combinedTaxRate = igstPercentage; // IGST
      }
      
      // Calculate Subtotal (excluding GST)
      const subtotalExcludingGST = totalAmountIncludingGST / (1 + combinedTaxRate / 100);
      
      // Row 1: 70% of subtotal (excluding GST) - with proper rounding
      let amount70 = subtotalExcludingGST * 0.7;
      
      // Row 2: 30% of subtotal (excluding GST) - ensure row1 + row2 = subtotal exactly
      let amount30 = subtotalExcludingGST - amount70;
      
      // Round to 2 decimal places with precision preservation
      amount70 = Math.round(amount70 * 100) / 100;
      // Adjust amount30 to ensure amount70 + amount30 + taxes = totalAmountIncludingGST exactly
      // This prevents any rounding discrepancies
      amount30 = totalAmountIncludingGST / (1 + combinedTaxRate / 100) - amount70;
      amount30 = Math.round(amount30 * 100) / 100;
      
      // Calculate rate per KWP (tax-exclusive)
      const rate70ExcTax = kwpQuantity > 0 ? amount70 / kwpQuantity : 0;
      
      // Calculate rate including tax (for display in "Rate (Incl. of Tax)" column)
      const rate70IncTax = rate70ExcTax * (1 + combinedTaxRate / 100);
      
      // Dynamic row height based on content
      const productRowHeight = 23;

      // Row 1 - 70% of amount
      doc.rect(tableX, y, tableWidth, productRowHeight).lineWidth(0.5).stroke();
      doc.font('Helvetica').fontSize(8.65);
      
      colX = tableX;
      doc.text('1', colX, y + 5, { width: colSl, align: 'center' });
      doc.moveTo(colX + colSl, y).lineTo(colX + colSl, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colSl;
      doc.font('Helvetica-Bold').fontSize(8.65);
      doc.text(invoice.product_description || '', colX + 2, y + 2, { width: colDesc - 4 });
      doc.font('Helvetica').fontSize(8.65);
      doc.moveTo(colX + colDesc, y).lineTo(colX + colDesc, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colDesc;
      doc.text(hsnRow1, colX, y + 5, { width: colHSN, align: 'center' });
      doc.moveTo(colX + colHSN, y).lineTo(colX + colHSN, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colHSN;
      doc.text(kwpQuantity.toString() + ' Kwp', colX, y + 5, { width: colQty, align: 'center' });
      doc.moveTo(colX + colQty, y).lineTo(colX + colQty, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colQty;
      doc.text(formatNumberWithCommas(rate70IncTax), colX, y + 5, { width: colRate, align: 'center' });
      doc.moveTo(colX + colRate, y).lineTo(colX + colRate, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colRate;
      doc.text(formatNumberWithCommas(rate70ExcTax), colX, y + 5, { width: colRate2, align: 'center' });
      doc.moveTo(colX + colRate2, y).lineTo(colX + colRate2, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colRate2;
      doc.text('kwp', colX, y + 5, { width: colPerLabel, align: 'center' });
      doc.moveTo(colX + colPerLabel, y).lineTo(colX + colPerLabel, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colPerLabel;
      doc.font('Helvetica-Bold').fontSize(8.08);
      doc.text(formatNumberWithCommas(amount70), colX + 2, y + 5, { width: colAmount - 4, align: 'center' });

      y += productRowHeight;

      // Row 2 - 30% of amount
      doc.rect(tableX, y, tableWidth, productRowHeight).lineWidth(0.5).stroke();
      doc.font('Helvetica').fontSize(8.65);
      
      colX = tableX;
      doc.text('2', colX, y + 5, { width: colSl, align: 'center' });
      doc.moveTo(colX + colSl, y).lineTo(colX + colSl, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colSl;
      doc.font('Helvetica-Bold').fontSize(8.65);
      doc.text('VIKRAM SOLAR PANELS', colX + 2, y + 5, { width: colDesc - 4 });
      doc.font('Helvetica').fontSize(8.65);
      doc.moveTo(colX + colDesc, y).lineTo(colX + colDesc, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colDesc;
      doc.text(hsnRow2, colX, y + 5, { width: colHSN, align: 'center' });
      doc.moveTo(colX + colHSN, y).lineTo(colX + colHSN, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colHSN;
      doc.text('', colX, y + 5, { width: colQty, align: 'center' });
      doc.moveTo(colX + colQty, y).lineTo(colX + colQty, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colQty;
      doc.text('', colX, y + 5, { width: colRate, align: 'center' });
      doc.moveTo(colX + colRate, y).lineTo(colX + colRate, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colRate;
      doc.text('', colX, y + 5, { width: colRate2, align: 'center' });
      doc.moveTo(colX + colRate2, y).lineTo(colX + colRate2, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colRate2;
      doc.text('', colX, y + 5, { width: colPerLabel, align: 'center' });
      doc.moveTo(colX + colPerLabel, y).lineTo(colX + colPerLabel, y + productRowHeight).lineWidth(0.5).stroke();
      
      colX += colPerLabel;
      doc.font('Helvetica-Bold').fontSize(8.65);
      doc.text(formatNumberWithCommas(amount30), colX + 2, y + 5, { width: colAmount - 4, align: 'center' });

      y += productRowHeight;

      // Subtotal row - part of product table
      doc.rect(tableX, y, tableWidth, 18).lineWidth(0.5).stroke();
      
      // Add vertical column separators
      colX = tableX;
      doc.moveTo(colX + colSl, y).lineTo(colX + colSl, y + 18).lineWidth(0.5).stroke();
      colX += colSl;
      doc.moveTo(colX + colDesc, y).lineTo(colX + colDesc, y + 18).lineWidth(0.5).stroke();
      colX += colDesc;
      doc.moveTo(colX + colHSN, y).lineTo(colX + colHSN, y + 18).lineWidth(0.5).stroke();
      colX += colHSN;
      doc.moveTo(colX + colQty, y).lineTo(colX + colQty, y + 18).lineWidth(0.5).stroke();
      colX += colQty;
      doc.moveTo(colX + colRate, y).lineTo(colX + colRate, y + 18).lineWidth(0.5).stroke();
      colX += colRate;
      doc.moveTo(colX + colRate2, y).lineTo(colX + colRate2, y + 18).lineWidth(0.5).stroke();
      colX += colRate2;
      doc.moveTo(colX + colPerLabel, y).lineTo(colX + colPerLabel, y + 18).lineWidth(0.5).stroke();
      
      doc.font('Helvetica-Bold').fontSize(8.65);
      colX = tableX + colSl + colDesc + colHSN + colQty + colRate + colRate2 + colPerLabel;
      // Subtotal should be the sum of row amounts (excluding GST)
      const subtotalForDisplay = amount70 + amount30;
      doc.text('Subtotal', tableX + colSl + 2, y + 5, { width: colDesc - 4 });
      doc.text(formatNumberWithCommas(subtotalForDisplay), colX + 2, y + 5, { width: colAmount - 4, align: 'center' });

      y += 18;

      // Tax calculations
      const cgstRate = parseFloat(invoice.cgst_percentage) || 0;
      const sgstRate = parseFloat(invoice.sgst_percentage) || 0;
      const igstRate = parseFloat(invoice.igst_percentage) || 0;
      
      // Calculate tax amounts based on the displayed subtotal (amount70 + amount30)
      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;
      let totalTaxAmount = 0;
      
      if (isAP) {
        // For Andhra Pradesh: apply CGST and SGST
        cgstAmount = (subtotalForDisplay * cgstRate) / 100;
        sgstAmount = (subtotalForDisplay * sgstRate) / 100;
        totalTaxAmount = cgstAmount + sgstAmount;
        
        // Round individual taxes to 2 decimals
        cgstAmount = Math.round(cgstAmount * 100) / 100;
        sgstAmount = Math.round(sgstAmount * 100) / 100;
        
        // Adjust the last tax to ensure subtotal + taxes = totalAmountIncludingGST exactly
        const calculatedSum = subtotalForDisplay + cgstAmount + sgstAmount;
        const rounding30iff = totalAmountIncludingGST - calculatedSum;
        if (Math.abs(rounding30iff) > 0.001) {
          sgstAmount = sgstAmount + rounding30iff;
        }
      } else {
        // For other states: apply IGST
        igstAmount = (subtotalForDisplay * igstRate) / 100;
        totalTaxAmount = igstAmount;
        
        // Round IGST to 2 decimals
        igstAmount = Math.round(igstAmount * 100) / 100;
        
        // Adjust IGST to ensure subtotal + igst = totalAmountIncludingGST exactly
        const calculatedSum = subtotalForDisplay + igstAmount;
        const roundingDiff = totalAmountIncludingGST - calculatedSum;
        if (Math.abs(roundingDiff) > 0.001) {
          igstAmount = igstAmount + roundingDiff;
        }
      }
      
      totalTaxAmount = cgstAmount + sgstAmount + igstAmount;

      // CGST row (if AP) - part of product table
      if (isAP) {
        doc.rect(tableX, y, tableWidth, 18).lineWidth(0.5).stroke();
        
        // Add vertical column separators
        colX = tableX;
        doc.moveTo(colX + colSl, y).lineTo(colX + colSl, y + 18).lineWidth(0.5).stroke();
        colX += colSl;
        doc.moveTo(colX + colDesc, y).lineTo(colX + colDesc, y + 18).lineWidth(0.5).stroke();
        colX += colDesc;
        doc.moveTo(colX + colHSN, y).lineTo(colX + colHSN, y + 18).lineWidth(0.5).stroke();
        colX += colHSN;
        doc.moveTo(colX + colQty, y).lineTo(colX + colQty, y + 18).lineWidth(0.5).stroke();
        colX += colQty;
        doc.moveTo(colX + colRate, y).lineTo(colX + colRate, y + 18).lineWidth(0.5).stroke();
        colX += colRate;
        doc.moveTo(colX + colRate2, y).lineTo(colX + colRate2, y + 18).lineWidth(0.5).stroke();
        colX += colRate2;
        doc.moveTo(colX + colPerLabel, y).lineTo(colX + colPerLabel, y + 18).lineWidth(0.5).stroke();
        
        doc.font('Helvetica-Bold').fontSize(8.65);
        colX = tableX + colSl + colDesc + colHSN + colQty + colRate + colRate2 + colPerLabel;
        doc.text('CGST', tableX + colSl + 2, y + 5, { width: colDesc - 4 });
        doc.text(formatNumberWithCommas(cgstAmount), colX + 2, y + 5, { width: colAmount - 4, align: 'center' });
        y += 18;

        // SGST row - part of product table
        doc.rect(tableX, y, tableWidth, 18).lineWidth(0.5).stroke();
        
        // Add vertical column separators
        colX = tableX;
        doc.moveTo(colX + colSl, y).lineTo(colX + colSl, y + 18).lineWidth(0.5).stroke();
        colX += colSl;
        doc.moveTo(colX + colDesc, y).lineTo(colX + colDesc, y + 18).lineWidth(0.5).stroke();
        colX += colDesc;
        doc.moveTo(colX + colHSN, y).lineTo(colX + colHSN, y + 18).lineWidth(0.5).stroke();
        colX += colHSN;
        doc.moveTo(colX + colQty, y).lineTo(colX + colQty, y + 18).lineWidth(0.5).stroke();
        colX += colQty;
        doc.moveTo(colX + colRate, y).lineTo(colX + colRate, y + 18).lineWidth(0.5).stroke();
        colX += colRate;
        doc.moveTo(colX + colRate2, y).lineTo(colX + colRate2, y + 18).lineWidth(0.5).stroke();
        colX += colRate2;
        doc.moveTo(colX + colPerLabel, y).lineTo(colX + colPerLabel, y + 18).lineWidth(0.5).stroke();
        
        doc.font('Helvetica-Bold').fontSize(8.65);
        colX = tableX + colSl + colDesc + colHSN + colQty + colRate + colRate2 + colPerLabel;
        doc.text('SGST', tableX + colSl + 2, y + 5, { width: colDesc - 4 });
        doc.text(formatNumberWithCommas(sgstAmount), colX + 2, y + 5, { width: colAmount - 4, align: 'center' });
        y += 18;
      } else {
        // IGST row (non-AP) - part of product table
        doc.rect(tableX, y, tableWidth, 18).lineWidth(0.5).stroke();
        
        // Add vertical column separators
        colX = tableX;
        doc.moveTo(colX + colSl, y).lineTo(colX + colSl, y + 18).lineWidth(0.5).stroke();
        colX += colSl;
        doc.moveTo(colX + colDesc, y).lineTo(colX + colDesc, y + 18).lineWidth(0.5).stroke();
        colX += colDesc;
        doc.moveTo(colX + colHSN, y).lineTo(colX + colHSN, y + 18).lineWidth(0.5).stroke();
        colX += colHSN;
        doc.moveTo(colX + colQty, y).lineTo(colX + colQty, y + 18).lineWidth(0.5).stroke();
        colX += colQty;
        doc.moveTo(colX + colRate, y).lineTo(colX + colRate, y + 18).lineWidth(0.5).stroke();
        colX += colRate;
        doc.moveTo(colX + colRate2, y).lineTo(colX + colRate2, y + 18).lineWidth(0.5).stroke();
        colX += colRate2;
        doc.moveTo(colX + colPerLabel, y).lineTo(colX + colPerLabel, y + 18).lineWidth(0.5).stroke();
        
        doc.font('Helvetica-Bold').fontSize(8.24);
        colX = tableX + colSl + colDesc + colHSN + colQty + colRate + colRate2 + colPerLabel;
        doc.text('IGST', tableX + colSl + 2, y + 5, { width: colDesc - 4 });
        doc.text(formatNumberWithCommas(igstAmount), colX + 2, y + 5, { width: colAmount - 4, align: 'center' });
        y += 18;
      }

      // Total row - part of product table
      doc.rect(tableX, y, tableWidth, 18).lineWidth(0.5).stroke();
      
      // Add vertical column separators
      colX = tableX;
      doc.moveTo(colX + colSl, y).lineTo(colX + colSl, y + 18).lineWidth(0.5).stroke();
      colX += colSl;
      doc.moveTo(colX + colDesc, y).lineTo(colX + colDesc, y + 18).lineWidth(0.5).stroke();
      colX += colDesc;
      doc.moveTo(colX + colHSN, y).lineTo(colX + colHSN, y + 18).lineWidth(0.5).stroke();
      colX += colHSN;
      doc.moveTo(colX + colQty, y).lineTo(colX + colQty, y + 18).lineWidth(0.5).stroke();
      colX += colQty;
      doc.moveTo(colX + colRate, y).lineTo(colX + colRate, y + 18).lineWidth(0.5).stroke();
      colX += colRate;
      doc.moveTo(colX + colRate2, y).lineTo(colX + colRate2, y + 18).lineWidth(0.5).stroke();
      colX += colRate2;
      doc.moveTo(colX + colPerLabel, y).lineTo(colX + colPerLabel, y + 18).lineWidth(0.5).stroke();
      
      doc.font('Helvetica-Bold').fontSize(8.65);
      const grandTotal = totalAmountIncludingGST;
      colX = tableX + colSl + colDesc + colHSN;
      doc.text('Total', tableX + colSl + 2, y + 5, { width: colDesc - 4 });
      doc.text(kwpQuantity.toString() + ' Kwp', colX + 2, y + 5, { width: colQty - 4, align: 'center' });
      colX = tableX + colSl + colDesc + colHSN + colQty + colRate + colRate2 + colPerLabel;
      doc.text(formatNumberWithCommas(grandTotal), colX + 2, y + 5, { width: colAmount - 4, align: 'center' });

      y += 18;

      // === AMOUNT IN WORDS ===
      y += 11; // Add space after product table for better view
      const amountWords = numberToWords(grandTotal);
      doc.font('Helvetica-Bold').fontSize(9.83).text('Amount Chargeable (in words) : INR ' + amountWords, tableX, y);
      y += 22; // Increased space to add line gap below

      // === TAX SUMMARY TABLE ===
      const taxTableX = tableX;
      // Dynamically calculate column width based on applicable taxes
      // For AP: HSN + Taxable Value + CGST Rate + CGST Amt + SGST Rate + SGST Amt + Total Tax = 7 cols
      // For non-AP: HSN + Taxable Value + IGST Rate + IGST Amt + Total Tax = 5 cols
      const numTaxCols = isAP ? 7 : 5;
      const taxColWidth = tableWidth / numTaxCols;

      // Tax table header
      const taxRowHeight = 20;
      const dataRowHeight = 18;
      doc.rect(taxTableX, y, tableWidth, taxRowHeight).lineWidth(0.5).stroke();
      doc.font('Helvetica-Bold').fontSize(9.50);

      colX = taxTableX;
      doc.text('HSN/SAC', colX + 2, y + 3, { width: taxColWidth - 4, align: 'center' });
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + taxRowHeight).lineWidth(0.5).stroke();

      colX += taxColWidth;
      doc.text('Taxable Value', colX + 2, y + 3, { width: taxColWidth - 4, align: 'center' });
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + taxRowHeight).lineWidth(0.5).stroke();

      if (isAP) {
        colX += taxColWidth;
        doc.text('CGST Rate', colX + 2, y + 3, { width: taxColWidth - 4, align: 'center' });
        doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + taxRowHeight).lineWidth(0.5).stroke();

        colX += taxColWidth;
        doc.text('CGST Amt', colX + 2, y + 3, { width: taxColWidth - 4, align: 'center' });
        doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + taxRowHeight).lineWidth(0.5).stroke();

        colX += taxColWidth;
        doc.text('SGST Rate', colX + 2, y + 3, { width: taxColWidth - 4, align: 'center' });
        doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + taxRowHeight).lineWidth(0.5).stroke();

        colX += taxColWidth;
        doc.text('SGST Amt', colX + 2, y + 3, { width: taxColWidth - 4, align: 'center' });
        doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + taxRowHeight).lineWidth(0.5).stroke();
      } else {
        colX += taxColWidth;
        doc.text('IGST Rate', colX + 2, y + 3, { width: taxColWidth - 4, align: 'center' });
        doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + taxRowHeight).lineWidth(0.5).stroke();

        colX += taxColWidth;
        doc.text('IGST Amt', colX + 2, y + 3, { width: taxColWidth - 4, align: 'center' });
        doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + taxRowHeight).lineWidth(0.5).stroke();
      }

      colX += taxColWidth;
      doc.text('Total Tax', colX + 2, y + 3, { width: taxColWidth - 4, align: 'center' });

      y += taxRowHeight;

      // Tax summary row 1 (70% HSN with amount70)
      doc.rect(taxTableX, y, tableWidth, dataRowHeight).lineWidth(0.5).stroke();
      doc.font('Helvetica').fontSize(9.50);

      colX = taxTableX;
      doc.text(hsnRow1, colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + dataRowHeight).lineWidth(0.5).stroke();

      colX += taxColWidth;
      doc.text(formatNumberWithCommas(amount70), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + dataRowHeight).lineWidth(0.5).stroke();

      if (isAP) {
        colX += taxColWidth;
        doc.text((cgstRate).toFixed(2) + '%', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
        doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + dataRowHeight).lineWidth(0.5).stroke();

        colX += taxColWidth;
        const cgstAmount70 = (amount70 * cgstRate) / 100;
        doc.text(formatNumberWithCommas(cgstAmount70), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
        doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + dataRowHeight).lineWidth(0.5).stroke();

        colX += taxColWidth;
        doc.text((sgstRate).toFixed(2) + '%', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
        doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + dataRowHeight).lineWidth(0.5).stroke();

        colX += taxColWidth;
        const sgstAmount70 = (amount70 * sgstRate) / 100;
        doc.text(formatNumberWithCommas(sgstAmount70), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
        doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + dataRowHeight).lineWidth(0.5).stroke();
      } else {
        colX += taxColWidth;
        doc.text(igstRate.toFixed(2) + '%', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
        doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + dataRowHeight).lineWidth(0.5).stroke();

        colX += taxColWidth;
        const igstAmount70 = (amount70 * igstRate) / 100;
        doc.text(formatNumberWithCommas(igstAmount70), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
        doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + dataRowHeight).lineWidth(0.5).stroke();
      }

      colX += taxColWidth;
      const totalTaxRow1 = isAP ? ((amount70 * cgstRate) / 100 + (amount70 * sgstRate) / 100) : ((amount70 * igstRate) / 100);
      doc.text(formatNumberWithCommas(totalTaxRow1), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });

      y += dataRowHeight;

      // Tax summary row 2 (30% HSN with amount30)
      doc.rect(taxTableX, y, tableWidth, dataRowHeight).lineWidth(0.5).stroke();
      doc.font('Helvetica').fontSize(9.50);

      colX = taxTableX;
      doc.text(hsnRow2, colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + dataRowHeight).lineWidth(0.5).stroke();

      colX += taxColWidth;
      doc.text(formatNumberWithCommas(amount30), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + dataRowHeight).lineWidth(0.5).stroke();

      if (isAP) {
        colX += taxColWidth;
        doc.text((cgstRate).toFixed(2) + '%', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
        doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + dataRowHeight).lineWidth(0.5).stroke();

        colX += taxColWidth;
        const cgstAmount30 = (amount30 * cgstRate) / 100;
        doc.text(formatNumberWithCommas(cgstAmount30), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
        doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + dataRowHeight).lineWidth(0.5).stroke();

        colX += taxColWidth;
        doc.text((sgstRate).toFixed(2) + '%', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
        doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + dataRowHeight).lineWidth(0.5).stroke();

        colX += taxColWidth;
        const sgstAmount30 = (amount30 * sgstRate) / 100;
        doc.text(formatNumberWithCommas(sgstAmount30), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
        doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + dataRowHeight).lineWidth(0.5).stroke();
      } else {
        colX += taxColWidth;
        doc.text(igstRate.toFixed(2) + '%', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
        doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + dataRowHeight).lineWidth(0.5).stroke();

        colX += taxColWidth;
        const igstAmount30 = (amount30 * igstRate) / 100;
        doc.text(formatNumberWithCommas(igstAmount30), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
        doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + dataRowHeight).lineWidth(0.5).stroke();
      }

      colX += taxColWidth;
      const totalTaxRow2 = isAP ? ((amount30 * cgstRate) / 100 + (amount30 * sgstRate) / 100) : ((amount30 * igstRate) / 100);
      doc.text(formatNumberWithCommas(totalTaxRow2), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });

      y += dataRowHeight;

      // TOTAL row
      doc.rect(taxTableX, y, tableWidth, dataRowHeight).lineWidth(0.5).stroke();
      doc.font('Helvetica-Bold').fontSize(9.50);

      colX = taxTableX;
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + dataRowHeight).lineWidth(0.5).stroke();
      doc.text('TOTAL', colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });

      colX += taxColWidth;
      doc.text(formatNumberWithCommas(subtotalForDisplay), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
      doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + dataRowHeight).lineWidth(0.5).stroke();

      if (isAP) {
        // Calculate totals for CGST and SGST
        const cgstAmount70 = (amount70 * cgstRate) / 100;
        const cgstAmount30 = (amount30 * cgstRate) / 100;
        const totalCgstAmount = cgstAmount70 + cgstAmount30;
        
        const sgstAmount70 = (amount70 * sgstRate) / 100;
        const sgstAmount30 = (amount30 * sgstRate) / 100;
        const totalSgstAmount = sgstAmount70 + sgstAmount30;

        colX += taxColWidth;
        doc.moveTo(colX, y).lineTo(colX, y + dataRowHeight).lineWidth(0.5).stroke();

        colX += taxColWidth;
        doc.text(formatNumberWithCommas(totalCgstAmount), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
        doc.moveTo(colX, y).lineTo(colX, y + dataRowHeight).lineWidth(0.5).stroke();

        colX += taxColWidth;
        doc.moveTo(colX, y).lineTo(colX, y + dataRowHeight).lineWidth(0.5).stroke();

        colX += taxColWidth;
        doc.text(formatNumberWithCommas(totalSgstAmount), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
        doc.moveTo(colX + taxColWidth, y).lineTo(colX + taxColWidth, y + dataRowHeight).lineWidth(0.5).stroke();
      } else {
        // Calculate total for IGST
        const igstAmount70 = (amount70 * igstRate) / 100;
        const igstAmount30 = (amount30 * igstRate) / 100;
        const totalIgstAmount = igstAmount70 + igstAmount30;

        colX += taxColWidth;
        doc.moveTo(colX, y).lineTo(colX, y + dataRowHeight).lineWidth(0.5).stroke();

        colX += taxColWidth;
        doc.text(formatNumberWithCommas(totalIgstAmount), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });
        doc.moveTo(colX, y).lineTo(colX, y + dataRowHeight).lineWidth(0.5).stroke();
      }

      colX += taxColWidth;
      doc.text(formatNumberWithCommas(totalTaxAmount), colX + 2, y + 2, { width: taxColWidth - 4, align: 'center' });

      y += dataRowHeight;

      // === TAX AMOUNT IN WORDS ===
      y += 8;
      const taxWords = numberToWords(totalTaxAmount);
      doc.font('Helvetica-Bold').fontSize(9.94).text('Tax Amount (in words) : INR ' + taxWords, tableX, y);

      y += 16;

      // === BANK DETAILS & DECLARATION ===
      const bankX = tableX + 4;

      y += 22; // Move bank details down

      doc.font('Helvetica-Bold').fontSize(12.31).text('Company Bank Details', bankX, y);
      y += 14;
      doc.font('Helvetica-Bold').fontSize(10.17)
        .text('Bank Name: ' + BANK_DETAILS.bankName, bankX, y)
        .text('Account Name: ' + BANK_DETAILS.accountName, bankX, y + 12)
        .text('Account Number: ' + BANK_DETAILS.accountNumber, bankX, y + 24)
        .text('IFSC: ' + BANK_DETAILS.ifsc, bankX, y + 36)
        .text('Branch: ' + BANK_DETAILS.branch, bankX, y + 48);

      // Declaration - moved below bank details
      y += 71; // Move down after bank details
      const declarationY = y;
      
      doc.font('Helvetica-Bold').fontSize(12.31).text('Declaration', bankX, y);
      y += 14;
      doc.font('Helvetica').fontSize(10.17).text('We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.', bankX, y, { width: 280 });

      // === SIGNATURE - positioned to right of declaration ===
      const signatureX = bankX + 410;
      doc.font('Helvetica-Bold').fontSize(12.31).text('For SOLARHUT', signatureX, declarationY + 8, { align: 'right', width: 100 });
      doc.font('Helvetica').fontSize(10.17).text('Authorised Signatory', signatureX, declarationY + 24, { align: 'right', width: 100 });

      doc.end();
    } catch (err) {
      console.error('[PDF ERROR]', err);
      reject(err);
    }
  });
}
