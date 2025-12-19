import PDFDocument from 'pdfkit';
import { Estimation } from '../queries/estimationQueries';
import { COMPANY_DETAILS, BANK_DETAILS, UPI_DETAILS } from './bankDetails';

type PDFDocumentType = InstanceType<typeof PDFDocument>;

// Product list with descriptions
const PRODUCT_LIST = [
    'Vikram Solar Panels 550 W M10 Bifacial G2G HC DCR – 6 Panels',
    'Jindal Structure for the 3 KW Roof Top Solar Plant',
    'GroWatt 3KW TL-X2 (Pro) Solar Invertor- 1',
    'Civil Work for the Roof Top Solar Plant (Includes labor and material)',
    'Havells SC 4.0 SQMM Solar DC Cable (RED)',
    'Havells SC 4.0 SQMM Solar DC Cable (BLACK) ',
    'Havells SC 4.0 SQMM FRLS (GREEN)',
    'Havells 2 Core 4.0 SQMM AC Cable ',
    'ACDB & DCBD 1KW –',
    'MC 4 Connectors ',
    'Earthing Cover 200 MM ',
    'Earthing Electrodes CB 17.2 MM, Dia 3 feet',
    'Earthing Chemical Bag 25 Kgs',
    'Lightning Arrestor CB W/Insulator',
    'PVC Pipes 1" Inch ',
    'PVC Long L Bends ',
    'PVC Short L Bends',
    'PVC T Bends',
    'Cable Ties 1 Pack (100 No)',
    'Lugs Rings & Pins ',
    'PVC Insulation Tapes',
    'C-Clamps 1 "Inch ',
    'Wood Gattis',
    'Flexible Pipe 1 "Inch ',
    'Anchor Bolts 12*100 ',
    'SS Bolts 6*25 ',
    'SS Bolts 12*30'
];

const PRODUCT_LIST_COLOR = '#FF0000'; // Red color for product list

const addWatermark = (doc: PDFDocumentType) => {
    doc.save();
    try {
        doc.opacity(0.08);
        doc.image(require('path').join(__dirname, '../assets/SolarHutLOGO1.png'), 150, 250, { width: 300 });
        doc.opacity(1);
    } catch (e) {
        doc.fontSize(60)
            .fillColor('#FF6B00', 0.05)
            .rotate(-45, { origin: [300, 400] })
            .text('SOLAR HUT SOLUTIONS', 100, 400, {
                align: 'center',
                width: 400
            });
    }
    doc.restore();
};

const addHeader = (doc: PDFDocumentType, pageNumber: number, estimation: Estimation) => {
    // Always show logo and company info on every page
    const topY = 40;
    // Logo
    try {
        doc.image(require('path').join(__dirname, '../assets/SolarHutLOGO1.png'), 50, topY, { width: 90 });
    } catch (e) {
        doc.fontSize(16)
            .fillColor('#FF6B00')
            .font('Helvetica-Bold')
            .text('SOLAR HUT', 50, topY)
            .fontSize(12)
            .fillColor('#333333')
            .font('Helvetica')
            .text('SOLUTIONS', 50, topY + 18);
    }
    // Margin below logo
    const logoBottom = topY + 90 + 15;
    // Company Details (aligned parallel to logo)
    const companyY = topY + 20;
    doc.fontSize(9)
        .fillColor('#333333')
        .font('Helvetica-Bold')
        .text(`GSTIN: ${COMPANY_DETAILS.gstin}`, 350, companyY, { align: 'right', width: 195 })
        .text(`Door No: ${COMPANY_DETAILS.doorNo}`, 350, companyY + 12, { align: 'right', width: 195 })
        .text(COMPANY_DETAILS.street1, 350, companyY + 24, { align: 'right', width: 195 })
        .text(COMPANY_DETAILS.street2, 350, companyY + 36, { align: 'right', width: 195 })
        .text(COMPANY_DETAILS.cityState, 350, companyY + 48, { align: 'right', width: 195 })
        .text(`Mobile: ${COMPANY_DETAILS.mobile}`, 350, companyY + 60, { align: 'right', width: 195 });
    // Horizontal line
    doc.strokeColor('#FF6B00')
        .lineWidth(2)
        .moveTo(50, logoBottom)
        .lineTo(545, logoBottom)
        .stroke();
    // Only on page 1: show Estimate ID/Date/Client District table
    if (pageNumber === 1) {
        const tableY = logoBottom + 10;
        const estimateNumber = `SHS25${String(estimation.id).padStart(6, '0')}`;
        const estimateDate = new Date(estimation.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        doc.rect(50, tableY, 140, 25).fillAndStroke('#F5F5F5', '#888888');
        doc.rect(190, tableY, 140, 25).fillAndStroke('#F5F5F5', '#888888');
        doc.rect(330, tableY, 215, 25).fillAndStroke('#F5F5F5', '#888888');
        doc.fontSize(9)
            .fillColor('#000000')
            .font('Helvetica-Bold')
            .text('Estimate ID', 55, tableY + 5, { width: 130 })
            .text('Date', 195, tableY + 5, { width: 130 })
            .text('Client District', 335, tableY + 5, { width: 205 });
        doc.font('Helvetica')
            .text(estimateNumber, 55, tableY + 15, { width: 130 })
            .text(estimateDate, 195, tableY + 15, { width: 130 })
            .text(`${estimation.district}, ${estimation.state}`, 335, tableY + 15, { width: 205 });
        doc.y = tableY + 30;
    } else {
        doc.y = logoBottom + 10;
    }
};

const addFooter = (doc: PDFDocumentType, pageNumber: number) => {
    doc.fontSize(9)
        .fillColor('#666666')
        .text(`${pageNumber} | Page`, 50, 770, { align: 'center' });
};

// Convert number to text format (e.g., 44000 -> "Forty Four Thousand")
function numberToWords(num: number): string {
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

    if (amount >= 1000000) {
        const millions = Math.floor(amount / 1000000);
        result += convertHundreds(millions) + ' Million ';
        let remainder = amount % 1000000;
        
        if (remainder >= 100000) {
            const lakhs = Math.floor(remainder / 100000);
            result += convertHundreds(lakhs) + ' Lakh ';
            remainder %= 100000;
        }
        
        if (remainder >= 1000) {
            const thousands = Math.floor(remainder / 1000);
            result += convertHundreds(thousands) + ' Thousand ';
            remainder %= 1000;
        }
        
        if (remainder > 0) {
            result += convertHundreds(remainder);
        }
    } else if (amount >= 100000) {
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

export const generateEstimationPDF = (estimation: Estimation, employee?: any): PDFDocumentType => {
    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        bufferPages: true
    });

    let pageNumber = 1;
    
    const baseAmount = typeof estimation.amount === 'string' ? parseFloat(estimation.amount) : estimation.amount;
    const gstRate = typeof estimation.gst === 'string' ? parseFloat(estimation.gst) : estimation.gst;
    const gstAmount = (baseAmount * gstRate) / 100;
    const totalAmount = baseAmount + gstAmount;
    
    addWatermark(doc);
    
    // Page 1: Cover Page with Clean Design and Visible Solar Panels
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    
    // Clean white/light cream background
    doc.rect(0, 0, pageWidth, pageHeight).fill('#FFFFFF');
    
    // Draw visible solar panel grid pattern (bottom section)
    doc.save();
    doc.opacity(0.25);
    const panelWidth = 70;
    const panelHeight = 45;
    const startY = pageHeight * 0.50;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 10; col++) {
            const x = col * panelWidth - 30;
            const y = startY + row * panelHeight;
            // Panel background (dark blue like real solar panels)
            doc.rect(x, y, panelWidth - 3, panelHeight - 3).fill('#1a237e');
            // Panel grid lines (silver/metallic look)
            doc.strokeColor('#4a5568').lineWidth(1);
            // Vertical lines
            doc.moveTo(x + panelWidth / 4, y).lineTo(x + panelWidth / 4, y + panelHeight - 3).stroke();
            doc.moveTo(x + panelWidth / 2, y).lineTo(x + panelWidth / 2, y + panelHeight - 3).stroke();
            doc.moveTo(x + (3 * panelWidth) / 4, y).lineTo(x + (3 * panelWidth) / 4, y + panelHeight - 3).stroke();
            // Horizontal lines
            doc.moveTo(x, y + panelHeight / 3).lineTo(x + panelWidth - 3, y + panelHeight / 3).stroke();
            doc.moveTo(x, y + (2 * panelHeight) / 3).lineTo(x + panelWidth - 3, y + (2 * panelHeight) / 3).stroke();
        }
    }
    doc.restore();
    
    // Add Solar Hut Logo at top center - prominently displayed
    try {
        doc.image(require('path').join(__dirname, '../assets/SolarHutLOGO1.png'), (pageWidth - 150) / 2, 40, { width: 150 });
    } catch (e) {
        // Fallback text logo
        doc.fontSize(36)
            .font('Helvetica-Bold')
            .fillColor('#FF6B00')
            .text('SOLAR HUT', 0, 50, { align: 'center', width: pageWidth })
            .fontSize(16)
            .fillColor('#333333')
            .text('SOLUTIONS', 0, 95, { align: 'center', width: pageWidth });
    }
    
    // Add dynamic data overlay on page 1
    const estimateNumber = `SHS25-${String(estimation.id).padStart(6, '0')}`;
    const estimateDate = new Date(estimation.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const requestedKW = estimation.requested_watts;
    
    // Main Title - SOLAR PROPOSAL
    doc.fontSize(44)
        .font('Helvetica-Bold')
        .fillColor('#FF6B00')
        .text('SOLAR', 0, 200, { align: 'center', width: pageWidth })
        .fillColor('#333333')
        .text('PROPOSAL', 0, 255, { align: 'center', width: pageWidth });
    
    // KW Display in circle badge
    doc.circle(pageWidth / 2, 340, 45).fill('#FFFFFF');
    doc.fontSize(12)
        .font('Helvetica')
        .fillColor('#666666')
        .text('System Size', 0, 318, { align: 'center', width: pageWidth });
    doc.fontSize(22)
        .font('Helvetica-Bold')
        .fillColor('#FF6B00')
        .text(requestedKW || '', 0, 340, { align: 'center', width: pageWidth });
    
    // Estimate Info Box (semi-transparent white)
    doc.save();
    doc.opacity(0.95);
    doc.roundedRect(60, 410, pageWidth - 120, 70, 10).fill('#FFFFFF');
    doc.restore();
    doc.roundedRect(60, 410, pageWidth - 120, 70, 10).stroke('#E0E0E0');
    doc.fontSize(10)
        .font('Helvetica')
        .fillColor('#888888')
        .text('Estimate ID', 90, 422)
        .text('Date', pageWidth / 2 + 30, 422);
    doc.fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#FF6B00')
        .text(estimateNumber, 90, 445)
        .text(estimateDate, pageWidth / 2 + 30, 445);
    
    // Divider in estimate box
    doc.strokeColor('#E0E0E0')
        .lineWidth(1)
        .moveTo(pageWidth / 2, 418)
        .lineTo(pageWidth / 2, 472)
        .stroke();
    
    // Prepared For and Prepared By sections at bottom of page 1
    const preparedByName = employee ? `${employee.first_name || ''} ${employee.last_name || ''}`.trim() : 'Solar Hut Solutions';
    const preparedByMobile = employee?.mobile || '9966177225';
    
    // Bottom section with semi-transparent white background over solar panels
    doc.save();
    doc.opacity(0.92);
    doc.rect(0, 510, pageWidth, pageHeight - 510).fill('#FFFFFF');
    doc.restore();
    
    // Orange accent line at top of bottom section
    doc.rect(0, 510, pageWidth, 3).fill('#FF6B00');
    
    // Positioned at bottom of page 1
    const footerY = 535;
    
    // Prepared For Section (left side)
    doc.fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#FF6B00')
        .text('PREPARED FOR', 60, footerY);
    
    doc.strokeColor('#FF6B00')
        .lineWidth(2)
        .moveTo(60, footerY + 16)
        .lineTo(160, footerY + 16)
        .stroke();
    
    doc.fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#333333')
        .text(estimation.customer_name, 60, footerY + 28, { width: 220 });
    
    doc.fontSize(10)
        .font('Helvetica')
        .fillColor('#666666')
        .text(`Mobile: ${estimation.mobile}`, 60, footerY + 46, { width: 220 })
        .text(`${estimation.door_no}, ${estimation.area}`, 60, footerY + 60, { width: 220 })
        .text(`${estimation.city}, ${estimation.district}`, 60, footerY + 74, { width: 220 })
        .text(`${estimation.state} - ${estimation.pincode}`, 60, footerY + 88, { width: 220 });
    
    // Prepared By Section (right side)
    const preparedByX = pageWidth / 2 + 30;
    doc.fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#FF6B00')
        .text('PREPARED BY', preparedByX, footerY);
    
    doc.strokeColor('#FF6B00')
        .lineWidth(2)
        .moveTo(preparedByX, footerY + 16)
        .lineTo(preparedByX + 100, footerY + 16)
        .stroke();
    
    doc.fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#333333')
        .text(preparedByName, preparedByX, footerY + 28, { width: 220 });
    
    doc.fontSize(10)
        .font('Helvetica')
        .fillColor('#666666')
        .text(`Mobile: ${preparedByMobile}`, preparedByX, footerY + 46, { width: 220 })
        .text('Solar Hut Solutions LLP', preparedByX, footerY + 60, { width: 220 })
        .text('Vijayawada, Andhra Pradesh', preparedByX, footerY + 74, { width: 220 });
    
    // Add new page and header starting from page 2
    doc.addPage();
    pageNumber++;
    addWatermark(doc);
    addHeader(doc, pageNumber, estimation);
    
    // Estimate ID, Date, District & State (table format - side by side)
    const infoY = doc.y;
    const estimateNum = `SHS25-${String(estimation.id).padStart(6, '0')}`;
    const estDate = new Date(estimation.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const infoRowHeight = 25;
    
    // Draw table cells
    doc.rect(50, infoY, 165, infoRowHeight).fillAndStroke('#F5F5F5', '#888888');
    doc.rect(215, infoY, 140, infoRowHeight).fillAndStroke('#F5F5F5', '#888888');
    doc.rect(355, infoY, 190, infoRowHeight).fillAndStroke('#F5F5F5', '#888888');
    
    // Labels and Values side by side (label normal, value bold)
    doc.fontSize(9)
        .fillColor('#000000')
        .font('Helvetica')
        .text('Estimate: ', 55, infoY + 8, { continued: true })
        .font('Helvetica-Bold')
        .text(estimateNum);
    
    doc.fontSize(9)
        .fillColor('#000000')
        .font('Helvetica')
        .text('Date: ', 220, infoY + 8, { continued: true })
        .font('Helvetica-Bold')
        .text(estDate);
    
    doc.fontSize(9)
        .fillColor('#000000')
        .font('Helvetica')
        .text('Client District: ', 360, infoY + 8, { continued: true })
        .font('Helvetica-Bold')
        .text(`${estimation.district}, ${estimation.state}`);
    
    doc.y = infoY + infoRowHeight + 10;
    
    // Bill To Section (label on one line, value on next line)
    doc.moveDown(0.5);
    doc.fontSize(10)
        .font('Helvetica')
        .fillColor('#000000')
        .text('Bill To:', 50, doc.y);
    
    doc.font('Helvetica-Bold')
        .text(`Sri/Smt, ${estimation.customer_name} Garu, ${estimation.door_no}, ${estimation.area}, ${estimation.city}, ${estimation.district}, ${estimation.state}- ${estimation.pincode}. Ph: ${estimation.mobile}`, 50, doc.y, { width: 495 })
        .moveDown(0.8);
    
    // Note Section
    doc.fontSize(9)
        .font('Helvetica')
        .fillColor('#000000')
        .text('Note: ', 50, doc.y, { continued: true })
        .font('Helvetica-Bold')
        .text(`Quote for Installation of ${requestedKW}KW RTS plant for Client including Civil Work.`, { width: 495 })
        .moveDown(0.8);
    
    // Table width expanded to full page width
    const tableStartY = doc.y;
    const col1X = 50;
    const col2X = 350;
    const col3X = 450;
    const col1Width = 300;
    const col2Width = 100;
    const col3Width = 95;
    const rowHeight = 25; // Increased from 20 to 25 for larger table cells
    // Header row background
    doc.rect(col1X, tableStartY, col1Width, rowHeight).fillAndStroke('#E0E0E0', '#888888');
    doc.rect(col2X, tableStartY, col2Width, rowHeight).fillAndStroke('#E0E0E0', '#888888');
    doc.rect(col3X, tableStartY, col3Width, rowHeight).fillAndStroke('#E0E0E0', '#888888');
    // Header text
    doc.fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text('Product Description', col1X + 5, tableStartY + 7, { width: col1Width - 10 })
        .text('GST', col2X + 5, tableStartY + 7, { width: col2Width - 10, align: 'center' })
        .text('Amount', col3X + 5, tableStartY + 7, { width: col3Width - 10, align: 'right' });
    let currentY = tableStartY + rowHeight;
    // 1st page: 11 rows, 2nd page: 16 rows
    const ROWS_PER_PAGE_1 = 15;
    const ROWS_PER_PAGE_2 = 16;
    // Draw 27 product rows, split across 2 pages
    PRODUCT_LIST.forEach((product, index) => {
        if ((pageNumber === 1 && index === ROWS_PER_PAGE_1) || (currentY > 700)) {
            addFooter(doc, pageNumber);
            doc.addPage();
            pageNumber++;
            addWatermark(doc);
            addHeader(doc, pageNumber, estimation);
            // Re-draw table header on new page
            const tableStartY2 = doc.y;
            doc.rect(col1X, tableStartY2, col1Width, rowHeight).fillAndStroke('#E0E0E0', '#888888');
            doc.rect(col2X, tableStartY2, col2Width, rowHeight).fillAndStroke('#E0E0E0', '#888888');
            doc.rect(col3X, tableStartY2, col3Width, rowHeight).fillAndStroke('#E0E0E0', '#888888');
            doc.fontSize(10)
                .font('Helvetica-Bold')
                .fillColor('#000000')
                .text('Product Description', col1X + 5, tableStartY2 + 7, { width: col1Width - 10 })
                .text('GST', col2X + 5, tableStartY2 + 7, { width: col2Width - 10, align: 'center' })
                .text('Amount', col3X + 5, tableStartY2 + 7, { width: col3Width - 10, align: 'right' });
            currentY = tableStartY2 + rowHeight;
        }
        // Draw row borders
        doc.rect(col1X, currentY, col1Width, rowHeight).stroke('#888888');
        doc.rect(col2X, currentY, col2Width, rowHeight).stroke('#888888');
        doc.rect(col3X, currentY, col3Width, rowHeight).stroke('#888888');
        // Dynamic data for 1st row
        if (index === 0) {
            doc.fontSize(9)
                .font('Helvetica-Bold')
                .fillColor('#333333')
                .text(`${index + 1}) ${estimation.product_description || product}`, col1X + 5, currentY + 8, { width: col1Width - 10 });
            doc.fontSize(9)
                .font('Helvetica-Bold')
                .fillColor('#333333')
                .text(estimation.gst ? `${estimation.gst}%` : '', col2X + 5, currentY + 8, { width: col2Width - 10, align: 'center' });
            doc.fontSize(9)
                .font('Helvetica-Bold')
                .fillColor('#333333')
                .text(estimation.amount ? `Rs. ${baseAmount.toLocaleString('en-IN')}` : '', col3X + 5, currentY + 8, { width: col3Width - 10, align: 'right' });
        } else if (index === 1) {
            // Dynamic inverter watt for 2nd row
            const structure = estimation.structure;
            doc.fontSize(9)
                .font('Helvetica-Bold')
                .fillColor('#333333')
                .text(`${index + 1}) ${structure}`, col1X + 5, currentY + 8, { width: col1Width - 10 });
        } else if (index === 2) {
            // Dynamic inverter watt for 3rd row
            const watt = estimation.requested_watts;
            doc.fontSize(9)
                .font('Helvetica-Bold')
                .fillColor('#333333')
                .text(`${index + 1}) ${watt}`, col1X + 5, currentY + 8, { width: col1Width - 10 });
        } else if (product.includes('(RED)')) {
            // Only (RED) text in red color
            const parts = product.split('(RED)');
            doc.fontSize(9)
                .font('Helvetica')
                .fillColor('#333333')
                .text(`${index + 1}) ${parts[0]}`, col1X + 5, currentY + 8, { continued: true })
                .fillColor('#FF0000')
                .text('(RED)', { continued: true })
                .fillColor('#333333')
                .text(parts[1] || '', { width: col1Width - 10 });
        } else if (product.includes('(BLACK)')) {
            // Only (BLACK) text in black color
            const parts = product.split('(BLACK)');
            doc.fontSize(9)
                .font('Helvetica')
                .fillColor('#333333')
                .text(`${index + 1}) ${parts[0]}`, col1X + 5, currentY + 8, { continued: true })
                .fillColor('#000000')
                .font('Helvetica-Bold')
                .text('(BLACK)', { continued: true })
                .font('Helvetica')
                .fillColor('#333333')
                .text(parts[1] || '', { width: col1Width - 10 });
        } else if (product.includes('(GREEN)')) {
            // Only (GREEN) text in green color
            const parts = product.split('(GREEN)');
            doc.fontSize(9)
                .font('Helvetica')
                .fillColor('#333333')
                .text(`${index + 1}) ${parts[0]}`, col1X + 5, currentY + 8, { continued: true })
                .fillColor('#008000')
                .text('(GREEN)', { continued: true })
                .fillColor('#333333')
                .text(parts[1] || '', { width: col1Width - 10 });
        } else {
            doc.fontSize(9)
                .font('Helvetica')
                .fillColor('#333333')
                .text(`${index + 1}) ${product}`, col1X + 5, currentY + 8, { width: col1Width - 10 });
        }
        currentY += rowHeight;
    });
    
    // Check if we need a new page for GST and Total rows
    if (currentY > 680) {
        addFooter(doc, pageNumber);
        doc.addPage();
        pageNumber++;
        addWatermark(doc);
        addHeader(doc, pageNumber, estimation);
        currentY = doc.y;
    }
    
    // GST and Total row with merged first two columns, inside table
    doc.rect(col1X, currentY, col1Width + col2Width, rowHeight).fillAndStroke('#F5F5F5', '#888888');
    doc.rect(col3X, currentY, col3Width, rowHeight).fillAndStroke('#F5F5F5', '#888888');
    doc.fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text(`GST (${gstRate}%)`, col1X + 5, currentY + 6, { width: col1Width + col2Width - 10 })
        .text(`Rs. ${gstAmount.toLocaleString('en-IN')} /-`, col3X + 5, currentY + 6, { width: col3Width - 10, align: 'right' });
    currentY += rowHeight;
    
    // Total Amount row
    doc.rect(col1X, currentY, col1Width + col2Width, rowHeight).fillAndStroke('#FFE5CC', '#888888');
    doc.rect(col3X, currentY, col3Width, rowHeight).fillAndStroke('#FFE5CC', '#888888');
    doc.fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text('Total Amount (Incl. GST)', col1X + 5, currentY + 6, { width: col1Width + col2Width - 10 })
        .text(`Rs. ${totalAmount.toLocaleString('en-IN')} /-`, col3X + 5, currentY + 6, { width: col3Width - 10, align: 'right' });
    
    // Total in words just below table - with margin top and indentation
    doc.moveDown(1.5);
    doc.fontSize(10)
        .font('Helvetica')
        .text('Total Amount in Words: ', 80, doc.y, { continued: true })
        .font('Helvetica-Bold')
        .text(numberToWords(totalAmount), { width: 465 });
    doc.moveDown(2);
    
    // Check if we need a new page for thank you message
    if (doc.y > 700) {
        addFooter(doc, pageNumber);
        doc.addPage();
        pageNumber++;
        addWatermark(doc);
        addHeader(doc, pageNumber, estimation);
    }
    
    // Thank you message - Bold text
    doc.fontSize(10)
        .font('Helvetica-Bold')
        .text('Thank you for your interest in doing business with Solar Hut Solutions. Waiting for your order confirmation…', 50, doc.y, { width: 495 })
        .moveDown(2);
    
    // Check if we need a new page for Bank Details
    if (doc.y > 700) {
        addFooter(doc, pageNumber);
        doc.addPage();
        pageNumber++;
        addWatermark(doc);
        addHeader(doc, pageNumber, estimation);
    }
    
    // Bank Details
    doc.moveDown(1.5);
    const bankDetailsY = doc.y;
    doc.fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#FF6B00')
        .text('Bank Details for Payments:', 50, bankDetailsY);
    doc.strokeColor('#FF6B00')
        .lineWidth(1)
        .moveTo(50, bankDetailsY + 14)
        .lineTo(210, bankDetailsY + 14)
        .stroke();
    doc.moveDown(1);
    
    doc.fontSize(10)
        .fillColor('#333333')
        .font('Helvetica')
        .text('Bank Name: ', 50, doc.y, { continued: true })
        .font('Helvetica-Bold')
        .text(BANK_DETAILS.bankName)
        .moveDown(0.3);
    
    doc.font('Helvetica')
        .text('Account Name: ', 50, doc.y, { continued: true })
        .font('Helvetica-Bold')
        .text(BANK_DETAILS.accountName)
        .moveDown(0.3);
    
    doc.font('Helvetica')
        .text('A/C No: ', 50, doc.y, { continued: true })
        .font('Helvetica-Bold')
        .text(BANK_DETAILS.accountNumber)
        .moveDown(0.3);
    
    doc.font('Helvetica')
        .text('IFSC: ', 50, doc.y, { continued: true })
        .font('Helvetica-Bold')
        .text(BANK_DETAILS.ifsc)
        .moveDown(0.3);
    
    doc.font('Helvetica')
        .text('Branch: ', 50, doc.y, { continued: true })
        .font('Helvetica-Bold')
        .text(BANK_DETAILS.branch)
        .moveDown(1);
    
    const upiY = doc.y;
    doc.fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#FF6B00')
        .text('For UPI Payments:', 50, upiY);
    doc.strokeColor('#FF6B00')
        .lineWidth(1)
        .moveTo(50, upiY + 14)
        .lineTo(155, upiY + 14)
        .stroke();
    doc.moveDown(0.8);
    
    doc.fontSize(10)
        .fillColor('#333333')
        .font('Helvetica')
        .text('UPI ID: ', 50, doc.y, { continued: true })
        .font('Helvetica-Bold')
        .text(UPI_DETAILS.upiId)
        .moveDown(2);
    
    // Check if we need a new page for Warranty
    if (doc.y > 650) {
        addFooter(doc, pageNumber);
        doc.addPage();
        pageNumber++;
        addWatermark(doc);
        addHeader(doc, pageNumber, estimation);
    }
    
    // Warranty Terms and Conditions
    const warrantyY = doc.y;
    doc.fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#FF6B00')
        .text('Warranty Terms and Conditions', 50, warrantyY);
    doc.strokeColor('#FF6B00')
        .lineWidth(1)
        .moveTo(50, warrantyY + 14)
        .lineTo(245, warrantyY + 14)
        .stroke();
    doc.moveDown(0.8);
    
    // Product Warranty Details Table
    const prodWarrantyY = doc.y;
    doc.fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#333333')
        .text('Product Warranty Details:', 50, prodWarrantyY);
    doc.strokeColor('#333333')
        .lineWidth(0.5)
        .moveTo(50, prodWarrantyY + 13)
        .lineTo(185, prodWarrantyY + 13)
        .stroke();
    doc.moveDown(0.7);
    
    // Table configuration
    const warrantyTableY = doc.y;
    const wCol1X = 50;
    const wCol2X = 150;
    const wCol3X = 295;
    const wCol4X = 400;
    const wCol1W = 100;
    const wCol2W = 145;
    const wCol3W = 105;
    const wCol4W = 95;
    const wRowHeight = 35;
    const wHeaderHeight = 25;
    
    // Header row
    doc.rect(wCol1X, warrantyTableY, wCol1W, wHeaderHeight).fillAndStroke('#E0E0E0', '#888888');
    doc.rect(wCol2X, warrantyTableY, wCol2W, wHeaderHeight).fillAndStroke('#E0E0E0', '#888888');
    doc.rect(wCol3X, warrantyTableY, wCol3W, wHeaderHeight).fillAndStroke('#E0E0E0', '#888888');
    doc.rect(wCol4X, warrantyTableY, wCol4W, wHeaderHeight).fillAndStroke('#E0E0E0', '#888888');
    
    doc.fontSize(8)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text('Component', wCol1X + 5, warrantyTableY + 8, { width: wCol1W - 10 })
        .text('Standard Warranty', wCol2X + 5, warrantyTableY + 8, { width: wCol2W - 10, align: 'center' })
        .text('Warranty Type', wCol3X + 5, warrantyTableY + 8, { width: wCol3W - 10, align: 'center' })
        .text('Extended Warranty\n(Optional)', wCol4X + 5, warrantyTableY + 3, { width: wCol4W - 10, align: 'center' });
    
    let wCurrentY = warrantyTableY + wHeaderHeight;
    
    // Warranty data rows
    const warrantyData = [
        { component: 'Solar PV Modules', standard: '10 Years – Product Warranty\n25 Years – Performance Warranty', type: 'Product &\nPerformance', extended: 'Not Available' },
        { component: 'Inverter', standard: '5 Years', type: 'Inverter Only', extended: '5 – 10 Years' },
        { component: 'Structure', standard: '5 Years', type: 'Structure Only', extended: 'Not Available' },
        { component: 'AC Cables', standard: '1 Year', type: 'AC Cables Only', extended: '2 Years' },
        { component: 'DC Cables', standard: '1 Year', type: 'DC Cables Only', extended: '2 Years' },
        { component: 'Lightning Protection', standard: '1 Year', type: 'Lightning Only', extended: 'Not Available' }
    ];
    
    warrantyData.forEach((row, index) => {
        const rowH = index === 0 ? wRowHeight + 10 : wRowHeight;
        
        // Check if we need a new page
        if (wCurrentY + rowH > 700) {
            addFooter(doc, pageNumber);
            doc.addPage();
            pageNumber++;
            addWatermark(doc);
            addHeader(doc, pageNumber, estimation);
            wCurrentY = doc.y;
            
            // Redraw header on new page
            doc.rect(wCol1X, wCurrentY, wCol1W, wHeaderHeight).fillAndStroke('#E0E0E0', '#888888');
            doc.rect(wCol2X, wCurrentY, wCol2W, wHeaderHeight).fillAndStroke('#E0E0E0', '#888888');
            doc.rect(wCol3X, wCurrentY, wCol3W, wHeaderHeight).fillAndStroke('#E0E0E0', '#888888');
            doc.rect(wCol4X, wCurrentY, wCol4W, wHeaderHeight).fillAndStroke('#E0E0E0', '#888888');
            
            doc.fontSize(8)
                .font('Helvetica-Bold')
                .fillColor('#000000')
                .text('Component', wCol1X + 5, wCurrentY + 8, { width: wCol1W - 10 })
                .text('Standard Warranty', wCol2X + 5, wCurrentY + 8, { width: wCol2W - 10, align: 'center' })
                .text('Warranty Type', wCol3X + 5, wCurrentY + 8, { width: wCol3W - 10, align: 'center' })
                .text('Extended Warranty\n(Optional)', wCol4X + 5, wCurrentY + 3, { width: wCol4W - 10, align: 'center' });
            
            wCurrentY += wHeaderHeight;
        }
        
        doc.rect(wCol1X, wCurrentY, wCol1W, rowH).stroke('#888888');
        doc.rect(wCol2X, wCurrentY, wCol2W, rowH).stroke('#888888');
        doc.rect(wCol3X, wCurrentY, wCol3W, rowH).stroke('#888888');
        doc.rect(wCol4X, wCurrentY, wCol4W, rowH).stroke('#888888');
        
        const textY = index === 0 ? wCurrentY + 8 : wCurrentY + 12;
        
        doc.fontSize(8)
            .font('Helvetica')
            .fillColor('#333333')
            .text(row.component, wCol1X + 5, textY, { width: wCol1W - 10 })
            .text(row.standard, wCol2X + 5, textY, { width: wCol2W - 10, align: 'center' })
            .text(row.type, wCol3X + 5, textY, { width: wCol3W - 10, align: 'center' })
            .text(row.extended, wCol4X + 5, textY, { width: wCol4W - 10, align: 'center' });
        
        wCurrentY += rowH;
    });
    
    doc.y = wCurrentY + 15;
    
    // Check if we need a new page for Warranty Coverage
    if (doc.y > 650) {
        addFooter(doc, pageNumber);
        doc.addPage();
        pageNumber++;
        addWatermark(doc);
        addHeader(doc, pageNumber, estimation);
    }
    
    const warrantyCoverageY = doc.y;
    doc.fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#333333')
        .text('Warranty Coverage', 50, warrantyCoverageY);
    doc.strokeColor('#333333')
        .lineWidth(0.5)
        .moveTo(50, warrantyCoverageY + 13)
        .lineTo(155, warrantyCoverageY + 13)
        .stroke();
    doc.moveDown(0.5);
    
    doc.fontSize(9)
        .font('Helvetica')
        .text('Our warranty covers the following aspects:', 50, doc.y)
        .moveDown(0.3);
    
    const warrantyCoverage = [
        'Manufacturing Defects: Any defects in materials or workmanship during the manufacturing process.',
        'Performance Degradation: For solar modules, warranty ensures performance remains within specified levels.',
        'Installation Defects: Workmanship-related faults covered if installed by Solar Hut Solutions.',
        'System Functionality: Includes issues in communication, display, or connectivity in smart monitoring systems.',
        'Hardware Failures: Applies to inverters, junction boxes, etc. under normal conditions.'
    ];
    
    warrantyCoverage.forEach((item, idx) => {
        // Check page before adding
        if (doc.y > 700) {
            addFooter(doc, pageNumber);
            doc.addPage();
            pageNumber++;
            addWatermark(doc);
            addHeader(doc, pageNumber, estimation);
        }
        doc.fontSize(9)
            .text(`${idx + 1}) ${item}`, 50, doc.y, { width: 495 })
            .moveDown(0.3);
    });
    
    // Warranty Eligibility
    if (doc.y > 650) {
        addFooter(doc, pageNumber);
        doc.addPage();
        pageNumber++;
        addWatermark(doc);
        addHeader(doc, pageNumber, estimation);
    }
    
    doc.moveDown(0.5);
    const warrantyEligibilityY = doc.y;
    doc.fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#333333')
        .text('Warranty Eligibility', 50, warrantyEligibilityY);
    doc.strokeColor('#333333')
        .lineWidth(0.5)
        .moveTo(50, warrantyEligibilityY + 13)
        .lineTo(150, warrantyEligibilityY + 13)
        .stroke();
    doc.moveDown(0.5);
    
    doc.fontSize(9)
        .font('Helvetica')
        .text('To claim warranty coverage, the following conditions must be met:', 50, doc.y)
        .moveDown(0.3);
    
    const eligibility = [
        'The system must be supplied or installed by Solar Hut Solutions or its authorized partner.',
        'The system should be installed and maintained as per original design specifications.',
        'Maintenance logs and service records should be made available if required during evaluation.'
    ];
    
    eligibility.forEach((item, idx) => {
        if (doc.y > 700) {
            addFooter(doc, pageNumber);
            doc.addPage();
            pageNumber++;
            addWatermark(doc);
            addHeader(doc, pageNumber, estimation);
        }
        doc.text(`${idx + 1}) ${item}`, 50, doc.y, { width: 495 })
            .moveDown(0.3);
    });
    
    doc.moveDown(0.5);
    
    if (doc.y > 650) {
        addFooter(doc, pageNumber);
        doc.addPage();
        pageNumber++;
        addWatermark(doc);
        addHeader(doc, pageNumber, estimation);
    }
    
    const exclusionsY = doc.y;
    doc.fontSize(11)
        .font('Helvetica-Bold')
        .text('Exclusions (What\'s NOT covered)', 50, exclusionsY);
    doc.strokeColor('#333333')
        .lineWidth(0.5)
        .moveTo(50, exclusionsY + 13)
        .lineTo(225, exclusionsY + 13)
        .stroke();
    doc.moveDown(0.5);
    
    doc.fontSize(9)
        .font('Helvetica')
        .text('The following circumstances will avoid or limit the warranty coverage:', 50, doc.y)
        .moveDown(0.3);
    
    const exclusions = [
        'Force Majeure / Acts of Nature - Natural disasters like lightning, floods, earthquakes, storms, fire.',
        'Unauthorized Modifications or Third-party Tampering by non-authorized persons.',
        'Negligence or Lack of Maintenance like physical damage caused by improper use.',
        'Vandalism or Accidental Damage like human-induced damage or accidents.',
        'Serial Number Tampering or Warranty Void Stickers Removed.'
    ];
    
    exclusions.forEach((item, idx) => {
        if (doc.y > 700) {
            addFooter(doc, pageNumber);
            doc.addPage();
            pageNumber++;
            addWatermark(doc);
            addHeader(doc, pageNumber, estimation);
        }
        doc.text(`${idx + 1}. ${item}`, 50, doc.y, { width: 495 })
            .moveDown(0.3);
    });
    
    doc.moveDown(1);
    
    // Check if we need a new page for Benefits
    if (doc.y > 650) {
        addFooter(doc, pageNumber);
        doc.addPage();
        pageNumber++;
        addWatermark(doc);
        addHeader(doc, pageNumber, estimation);
    }
    
    // Benefits Section
    const benefitsY = doc.y;
    doc.fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#FF6B00')
        .text('Benefits of choosing Solar Hut Solutions', 50, benefitsY);
    doc.strokeColor('#FF6B00')
        .lineWidth(1)
        .moveTo(50, benefitsY + 14)
        .lineTo(295, benefitsY + 14)
        .stroke();
    doc.moveDown(0.8);
    
    const benefits = [
        'Free Site Visits.',
        'End-End solutions from Consultation to Installation and Technical support',
        'We Provide Flexible Financing options from various Banks with EMI\'s Starting as low as Rs. 1,500 per Month.',
        'Provide Software and Hardware support throughout your Journey in Solar.',
        'Technical Solution will be resolved in minutes over phone (Software Related issues)',
        'For any Site related issue, the team will be dispatched within 24 hours after we receive the information.'
    ];
    
    benefits.forEach((item, idx) => {
        if (doc.y > 700) {
            addFooter(doc, pageNumber);
            doc.addPage();
            pageNumber++;
            addWatermark(doc);
            addHeader(doc, pageNumber, estimation);
        }
        doc.fontSize(10)
            .font('Helvetica')
            .fillColor('#333333')
            .text(`${idx + 1}) ${item}`, 50, doc.y, { width: 495 })
            .moveDown(0.5);
    });
    
    doc.moveDown(2);
    
    if (doc.y > 700) {
        addFooter(doc, pageNumber);
        doc.addPage();
        pageNumber++;
        addWatermark(doc);
        addHeader(doc, pageNumber, estimation);
    }
    
    // Regards Section with Stamp
    const regardsY = doc.y;
    
    doc.fontSize(10)
        .font('Helvetica-Bold')
        .text('Regards', 50, regardsY)
        .moveDown(0.3);

    const employeeName = `${employee?.first_name || 'Solar'} ${employee?.last_name || 'hut'}`.trim() || 'Solar hut';

    doc.fontSize(10)
        .font('Helvetica')
        .text(employeeName, 50, doc.y)
        .text(employee?.mobile || '9966177225', 50, doc.y)
        .text('Solar Hut Solutions LLP', 50, doc.y)
        .text('Vijayawada, Andhra Pradesh', 50, doc.y);
    
    // Add company stamp beside Regards section
    try {
        doc.image(require('path').join(__dirname, '../assets/stamp.png'), 350, regardsY - 10, { width: 100 });
    } catch (e) {
        // Fallback: Draw a simple stamp circle if image not found
        doc.save();
        doc.circle(400, regardsY + 35, 45).stroke('#333333');
        doc.circle(400, regardsY + 35, 40).stroke('#333333');
        doc.fontSize(8)
            .font('Helvetica-Bold')
            .fillColor('#333333')
            .text('SOLAR HUT SOLUTIONS LLP', 355, regardsY + 15, { width: 90, align: 'center' })
            .text('VIJAYAWADA', 355, regardsY + 45, { width: 90, align: 'center' });
        doc.restore();
    }
    
    addFooter(doc, pageNumber);

    return doc;
};
