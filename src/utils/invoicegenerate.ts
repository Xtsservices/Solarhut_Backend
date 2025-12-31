
import PDFDocument from 'pdfkit';
import path from 'path';

function numberToWords(num: number): string {
  // Simple number to words for rupees (reuse from estimation PDF)
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const amount = Math.round(num);
  if (amount === 0) return 'Zero Rupees only';
  function convertHundreds(n: number): string {
    let result = '';
    if (n >= 100) {
      result += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      result += tens[Math.floor(n / 10)];
      if (n % 10 !== 0) {
        result += ' ' + ones[n % 10];
      }
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
    if (remainder > 0) {
      result += convertHundreds(remainder);
    }
  } else if (amount >= 1000) {
    const thousands = Math.floor(amount / 1000);
    result += convertHundreds(thousands) + ' Thousand ';
    const remainder = amount % 1000;
    if (remainder > 0) {
      result += convertHundreds(remainder);
    }
  } else {
    result = convertHundreds(amount);
  }
  return result.trim() + ' Rupees only';
}

export async function generateInvoicePDF(invoice: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // Explicitly set A4 size in points to avoid any ambiguity
      const doc = new PDFDocument({ size: [595.28, 841.89], margin: 0 });

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
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Authorised Signatory at bottom, moved slightly left
      const pageHeight = doc.page.height;
      const signX = 320; // moved slightly right from 270
      // Move signatory block a little right and a little down
      const signBlockX = signX + 20; // 20px more to the right
      const signBlockY = pageHeight - 60; // 10px further down
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000')
        .text('For SOLAR HUT', signBlockX, signBlockY, { align: 'right', width: 215 })
        .text('Authorised Signatory', signBlockX, signBlockY + 20, { align: 'right', width: 215 });


      // === Header: Logo and Company Info (no background) ===
      try {
        doc.image(path.join(__dirname, '../assets/SolarHutLOGO1.png'), 40, 30, { width: 90 });
      } catch (e) {
        doc.fontSize(16).fillColor('#FF6B00').font('Helvetica-Bold').text('SOLAR HUT', 50, 40);
      }
      // Company info block (top right)
      const infoX = 340;
      let infoY = 40;
      // Removed yearText from company info block
      doc.font('Helvetica-Bold').fontSize(10)
        .text('GSTIN: 37AAKFS9782N1Z7', infoX, infoY, { align: 'right', width: 230 });
      infoY += 13;
      doc.font('Helvetica-Bold').text('Door No: 77-14-13, Ground Floor', infoX, infoY, { align: 'right', width: 230 });
      infoY += 13;
      doc.font('Helvetica-Bold').text('Shanthi Nagar, Pypula Road', infoX, infoY, { align: 'right', width: 230 });
      infoY += 13;
      doc.font('Helvetica-Bold').text('Ajith Singh Nagar, Vijayawada', infoX, infoY, { align: 'right', width: 230 });
      infoY += 13;
      doc.font('Helvetica-Bold').text('NTR District, Andhra Pradesh - 520015', infoX, infoY, { align: 'right', width: 230 });
      infoY += 13;
      doc.font('Helvetica-Bold').text('Mobile: 9848992333, 9966177225', infoX, infoY, { align: 'right', width: 230 });
      infoY += 13;
      doc.font('Helvetica-Bold').text('www.solarhutsolutions.in', infoX, infoY, { align: 'right', width: 230 });
  // Add horizontal line below logo and company info
  doc.moveTo(40, infoY + 20).lineTo(555, infoY + 20).strokeColor('#888888').lineWidth(1).stroke();

      // === Invoice Title ===
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#FF6B00').text('INVOICE', 0, 120, { align: 'center', width: doc.page.width });

      // === Invoice/Customer/Date Table ===
      const tableY = 160;
      doc.rect(40, tableY, 180, 30).fillAndStroke('#F5F5F5', '#888888');
      doc.rect(220, tableY, 150, 30).fillAndStroke('#F5F5F5', '#888888');
      doc.rect(370, tableY, 200, 30).fillAndStroke('#F5F5F5', '#888888');
      doc.fontSize(10).fillColor('#000').font('Helvetica-Bold')
        .text('Invoice No.', 45, tableY + 5, { width: 170 })
        .text('Date', 225, tableY + 5, { width: 140 })
        .text('Reference No.', 375, tableY + 5, { width: 190 });
      // Reference No. is the estimation id in the format SHS25-XXXXXX (same as estimation PDF)
      const referenceNo = invoice.estimation_id ? `SHS25-${String(invoice.estimation_id).padStart(6, '0')}` : '';
      doc.font('Helvetica').fontSize(10)
        .text('INV' + String(invoice.id).padStart(6, '0'), 45, tableY + 17, { width: 170 })
        .text(invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString('en-GB') : '', 225, tableY + 17, { width: 140 })
        .text(referenceNo, 375, tableY + 17, { width: 190 });

      // === Consignee (Ship to) and Bill To blocks ===
      const blockTop = tableY + 45;
      // Consignee (Ship to) - left side (dynamic customer details)
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text('Ship to:', 40, blockTop);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#333')
        .text(`${invoice.customer_name} Garu,`, 40, blockTop + 18)
        .text(`${invoice.door_no || ''}, ${invoice.area || ''}, ${invoice.city || ''}`, 40, blockTop + 33)
        .text(`${invoice.district || ''}, ${invoice.state || ''} - ${invoice.pincode || ''}`, 40, blockTop + 48)
        .text(`Ph: ${invoice.mobile || ''}`, 40, blockTop + 63);
      // Bill To - right side
      const billToX = 320;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text('Bill To:', billToX, blockTop);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#333')
        .text(`${invoice.customer_name} Garu,`, billToX, blockTop + 18)
        .text(`${invoice.door_no || ''}, ${invoice.area || ''}, ${invoice.city || ''}`, billToX, blockTop + 33)
        .text(`${invoice.district || ''}, ${invoice.state || ''} - ${invoice.pincode || ''}`, billToX, blockTop + 48)
        .text(`Ph: ${invoice.mobile || ''}`, billToX, blockTop + 63);

      // === Product Table ===
      const prodTableY = tableY + 140;
      // Table columns: Product Description | Quantity | Total Capacity | Amount
      // Adjusted to fit A4 page width (595pt) with 40pt left margin and 40pt right margin
      const tableLeft = 40;
      const tableWidth = 595 - 2 * tableLeft;
      const col1W = Math.round(tableWidth * 0.44); // Product Description
      const colQtyW = Math.round(tableWidth * 0.16); // Quantity
      const col2W = Math.round(tableWidth * 0.18); // Total Capacity
      const col3W = tableWidth - col1W - colQtyW - col2W; // Amount (remaining)
      const col1X = tableLeft;
      const colQtyX = col1X + col1W;
      const col2X = colQtyX + colQtyW;
      const col3X = col2X + col2W;
      const rowH = 28;
      // Header
      doc.rect(col1X, prodTableY, col1W, rowH).fillAndStroke('#E0E0E0', '#888888'); // Product Description
      doc.rect(colQtyX, prodTableY, colQtyW, rowH).fillAndStroke('#E0E0E0', '#888888'); // Quantity
      doc.rect(col2X, prodTableY, col2W, rowH).fillAndStroke('#E0E0E0', '#888888'); // Total Capacity
      doc.rect(col3X, prodTableY, col3W, rowH).fillAndStroke('#E0E0E0', '#888888'); // Amount
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000')
        .text('Product Description', col1X + 5, prodTableY + 8, { width: col1W - 10 })
        .text('Quantity', colQtyX + 5, prodTableY + 8, { width: colQtyW - 10, align: 'center' })
        .text('Total Capacity', col2X + 5, prodTableY + 8, { width: col2W - 10, align: 'center' })
        .text('Amount', col3X + 5, prodTableY + 8, { width: col3W - 10, align: 'right' });
      // Row
      const baseAmount = typeof invoice.amount === 'string' ? parseFloat(invoice.amount) : invoice.amount;
      const gstRate = typeof invoice.gst === 'string' ? parseFloat(invoice.gst) : invoice.gst;
      const gstAmount = (baseAmount * gstRate) / 100;
      const totalAmount = baseAmount + gstAmount;
      let rowY = prodTableY + rowH;
      // Dynamically calculate row height based on product description
      doc.font('Helvetica').fontSize(10);
      const descLines = doc.heightOfString(invoice.product_description || '', { width: col1W - 10 });
      const qtyLines = doc.heightOfString(invoice.requested_watts ? String(invoice.requested_watts) : '', { width: colQtyW - 10 });
      const gstLines = doc.heightOfString(invoice.gst ? `${invoice.gst}%` : '', { width: col2W - 10 });
      const amtLines = doc.heightOfString(baseAmount ? `Rs. ${baseAmount.toLocaleString('en-IN')}` : '', { width: col3W - 10 });
      const contentHeight = Math.max(descLines, qtyLines, gstLines, amtLines);
      const dynamicRowH = Math.max(contentHeight + 16, rowH); // Add padding, minimum rowH
      doc.rect(col1X, rowY, col1W, dynamicRowH).stroke('#888888');
      doc.rect(colQtyX, rowY, colQtyW, dynamicRowH).stroke('#888888');
      doc.rect(col2X, rowY, col2W, dynamicRowH).stroke('#888888');
      doc.rect(col3X, rowY, col3W, dynamicRowH).stroke('#888888');
      doc.font('Helvetica').fontSize(10).fillColor('#333')
        .text(invoice.product_description || '', col1X + 5, rowY + 8, { width: col1W - 10 })
        .text('1', colQtyX + 5, rowY + 8, { width: colQtyW - 10, align: 'center' })
        .text(invoice.requested_watts ? String(invoice.requested_watts) : '', col2X + 5, rowY + 8, { width: col2W - 10, align: 'center' })
        .text(baseAmount ? `Rs. ${baseAmount.toLocaleString('en-IN')}` : '', col3X + 5, rowY + 8, { width: col3W - 10, align: 'right' });

      // Total row (spans all columns, includes GST)
      rowY += dynamicRowH;
      const totalSpanW = col1W + colQtyW + col2W; // Span all columns except Amount
      // GST Amount Row
      doc.rect(col1X, rowY, totalSpanW, rowH).fillAndStroke('#FFF7E6', '#888888');
      doc.rect(col3X, rowY, col3W, rowH).fillAndStroke('#FFF7E6', '#888888');
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000')
        .text(`GST Amount (${invoice.gst ? `${invoice.gst}%` : ''})`, col1X + 5, rowY + 8, { width: totalSpanW - 10 })
        .text(`Rs. ${gstAmount.toLocaleString('en-IN')} /-`, col3X + 5, rowY + 8, { width: col3W - 10, align: 'right' });

      // Total Amount Row
      rowY += rowH;
      doc.rect(col1X, rowY, totalSpanW, rowH).fillAndStroke('#FFE5CC', '#888888');
      doc.rect(col3X, rowY, col3W, rowH).fillAndStroke('#FFE5CC', '#888888');
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000')
        .text('Total Amount (Incl. GST)', col1X + 5, rowY + 8, { width: totalSpanW - 10 })
        .text(`Rs. ${totalAmount.toLocaleString('en-IN')} /-`, col3X + 5, rowY + 8, { width: col3W - 10, align: 'right' });

      // Total in words
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#000')
        .text('Amount Chargeable (in words) : ', 40, rowY + rowH + 15, { continued: true })
        .font('Helvetica-Bold').text(numberToWords(totalAmount), { width: 495 });

      // Company's Bank Details (custom content)
      let bankY = rowY + rowH + 35;
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#FF6B00').text("Company's Bank Details", 40, bankY);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#333')
        .text('Bank Name: State Bank of India', 40, bankY + 20)
        .text('Account Name: Solar Hut Solutions LLP', 40, bankY + 35)
        .text('A/C No: 44513337275', 40, bankY + 50)
        .text('IFSC: SBIN0012948', 40, bankY + 65)
        .text('Branch: Pantakalava Road, Vijayawada.', 40, bankY + 80);

      // Declaration section (moved after bank details)
      // Terms & Conditions section (replaces Declaration)
      const termsY = bankY + 110;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text('Terms & Conditions:', 40, termsY);
      doc.font('Helvetica').fontSize(10).fillColor('#333');
      const terms = [
        'Material will be dispatched to the Buyer location only after 100% of the payment received in Cash / UPI / Loan to the Solar Hut Solutions LLP.',
        'Upon receiving the material, Buyer is responsible for the material dispatched at his / her location until installation process is completed.',
        'No Refund / Exchange can be processed once after the Invoice is generated.',
        'Installation will be done in orderly process.',
        'It is the responsibility of the Buyer to provide clean and obstacle free area for the installation team to carry out the installation process.'
      ];
      let termsYOffset = termsY + 18;
      terms.forEach((point, idx) => {
        // Draw point number at left, then text starting after number, with strict wrapping
        const pointNum = `${idx + 1})`;
        const leftMargin = 45;
        const numWidth = doc.widthOfString(pointNum) + 2;
        const contentStartX = leftMargin + numWidth;
        const maxTextWidth = 470; // fixed width for all lines
        // Manually wrap the content to align wrapped lines
        let words = point.split(' ');
        let line = '';
        let lines = [];
        words.forEach(word => {
          const testLine = line ? line + ' ' + word : word;
          if (doc.widthOfString(testLine) > maxTextWidth) {
            lines.push(line);
            line = word;
          } else {
            line = testLine;
          }
        });
        if (line) lines.push(line);
        // Draw the first line with the number
        doc.text(pointNum, leftMargin, termsYOffset, { continued: true });
        doc.text(lines[0], contentStartX, termsYOffset, { width: maxTextWidth });
        let lineHeight = doc.heightOfString(lines[0], { width: maxTextWidth });
        for (let i = 1; i < lines.length; i++) {
          termsYOffset += lineHeight;
          doc.text(lines[i], contentStartX, termsYOffset, { width: 515 - 10 - doc.widthOfString(pointNum) });
          lineHeight = doc.heightOfString(lines[i], { width: 515 - 10 - doc.widthOfString(pointNum) });
        }
        termsYOffset += lineHeight + 4;
      });

      // Add company seal image above the signatory section
      try {
        // Place the seal above the signatory block, move a bit more right and down for better appearance
        const sealWidth = 110;
        const sealHeight = 130;
        // Move the seal a bit more right and down
        const sealX = signX + (215 - sealWidth) / 2 + 90; // 20px further right than before
        const signatoryTop = pageHeight - 70;
        const sealY = signatoryTop - sealHeight + 40; // 20px further down than before
        doc.image(path.join(__dirname, '../assets/solarhutstamp.jpeg'), sealX, sealY, { width: sealWidth, height: sealHeight });
      } catch (e) {
        // If image fails, do nothing
      }
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
