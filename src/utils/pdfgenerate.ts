import PDFDocument from 'pdfkit';
import { Estimation } from '../queries/estimationQueries';

type PDFDocumentType = InstanceType<typeof PDFDocument>;

// Product list with descriptions
const PRODUCT_LIST = [
    'Vikram Solar Panels 550 W M10 Bifacial G2G HC DCR – 6 Panels',
    'Jindal Structure for the 3 KW Roof Top Solar Plant',
    'GroWatt 3KW TL-X2 (Pro) Solar Invertor- 1',
    'Civil Work for the Roof Top Solar Plant (Includes labor and material)',
    'Havells SC 4.0 SQMM Solar DC Cable (RED) 20 meters',
    'Havells SC 4.0 SQMM Solar DC Cable (BLACK) 20 meters',
    'Havells SC 4.0 SQMM FRLS (GREEN) 90 meters',
    'Havells 2 Core 4.0 SQMM AC Cable 33 meters',
    'ACDB & DCBD 1KW – 3 KW',
    'MC 4 Connectors – 2',
    'Earthing Cover 200 MM – 3',
    'Earthing Electrodes CB 17.2 MM, Dia 3 feet – 3',
    'Earthing Chemical Bag 25 Kgs – 1',
    'Lightning Arrestor CB W/Insulator – 1',
    'PVC Pipes 1" Inch – 200 Feet',
    'PVC Long L Bends – 10',
    'PVC Short L Bends – 10',
    'PVC T Bends – 10',
    'Cable Ties 1 Pack (100 No)',
    'Lugs Rings & Pins – 10 each',
    'PVC Insulation Tapes -2',
    'C-Clamps 1 "Inch – 1 Pack',
    'Wood Gattis -1 Pack',
    'Flexible Pipe 1 "Inch – 5 Meters',
    'Anchor Bolts 12*100 – 16 Pieces',
    'SS Bolts 6*25 – 26 Pieces',
    'SS Bolts 12*30 – 16 Pieces'
];

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
        .font('Helvetica')
        .text('GSTIN: 37AAKFS9782N1Z7', 350, companyY, { align: 'right', width: 195 })
        .text('40-15-25/4, Labbipet', 350, companyY + 12, { align: 'right', width: 195 })
        .text('Vijayawada, Andhra Pradesh - 520010', 350, companyY + 24, { align: 'right', width: 195 })
        .text('Mobile: +91-9848992333', 350, companyY + 36, { align: 'right', width: 195 });
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
        const estimateDate = new Date(estimation.created_at).toLocaleDateString('en-GB');
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

function numberToWords(num: number): string {
    const amount = Math.round(num);
    
    if (amount >= 100000) {
        const lakhs = Math.floor(amount / 100000);
        const remainder = amount % 100000;
        const lakhsText = lakhs === 1 ? 'One Lakh' : `${lakhs} Lakhs`;
        
        if (remainder >= 1000) {
            const thousands = Math.floor(remainder / 1000);
            return `${lakhsText} and ${thousands === 1 ? 'One' : thousands} Thousand Rupees`;
        }
        return `${lakhsText} Rupees`;
    } else if (amount >= 1000) {
        const thousands = Math.floor(amount / 1000);
        return `${thousands === 1 ? 'One' : thousands} Thousand Rupees`;
    }
    
    return `${amount} Rupees`;
}

export const generateEstimationPDF = (estimation: Estimation): PDFDocumentType => {
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
    addHeader(doc, pageNumber, estimation);
    
    // Bill To Section
    doc.fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text('Bill To', 50, doc.y)
        .moveDown(0.3);
    
    doc.fontSize(9)
        .font('Helvetica')
        .fillColor('#333333')
        .text(`Sri/Smt, ${estimation.customer_name} Garu,`, 50, doc.y)
        .text(`${estimation.door_no}, ${estimation.area}, ${estimation.city}, ${estimation.district}, ${estimation.state}- ${estimation.pincode}.`, 50, doc.y)
        .text(`Ph: ${estimation.mobile}.`, 50, doc.y)
        .moveDown(0.8);
    
    // Note Section
    const requestedKW = estimation.requested_watts ? (parseFloat(estimation.requested_watts) / 1000).toFixed(1) : '3';
    doc.fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text(`Note: Quote for Installation of ${requestedKW}KW RTS plant for Client including Civil Work.`, 50, doc.y, { width: 495 })
        .moveDown(0.8);
    
    // Table width reduced to 25% of page width (A4 width ~595, so ~150px)
    const tableStartY = doc.y;
    const col1X = 70;
    const col2X = 220;
    const col3X = 295;
    const col1Width = 150;
    const col2Width = 75;
    const col3Width = 90;
    const rowHeight = 20;
    // Header row background
    doc.rect(col1X, tableStartY, col1Width, rowHeight).fillAndStroke('#E0E0E0', '#888888');
    doc.rect(col2X, tableStartY, col2Width, rowHeight).fillAndStroke('#E0E0E0', '#888888');
    doc.rect(col3X, tableStartY, col3Width, rowHeight).fillAndStroke('#E0E0E0', '#888888');
    // Header text
    doc.fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text('Product Description', col1X + 5, tableStartY + 6, { width: col1Width - 10 })
        .text('GST', col2X + 5, tableStartY + 6, { width: col2Width - 10, align: 'center' })
        .text('Amount', col3X + 5, tableStartY + 6, { width: col3Width - 10, align: 'right' });
    let currentY = tableStartY + rowHeight;
    // 1st page: 11 rows, 2nd page: 16 rows
    const ROWS_PER_PAGE_1 = 11;
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
            doc.fontSize(9)
                .font('Helvetica-Bold')
                .fillColor('#000000')
                .text('Product Description', col1X + 5, tableStartY2 + 6, { width: col1Width - 10 })
                .text('GST', col2X + 5, tableStartY2 + 6, { width: col2Width - 10, align: 'center' })
                .text('Amount', col3X + 5, tableStartY2 + 6, { width: col3Width - 10, align: 'right' });
            currentY = tableStartY2 + rowHeight;
        }
        // Draw row borders
        doc.rect(col1X, currentY, col1Width, rowHeight).stroke('#888888');
        doc.rect(col2X, currentY, col2Width, rowHeight).stroke('#888888');
        doc.rect(col3X, currentY, col3Width, rowHeight).stroke('#888888');
        // Dynamic data for 1st row
        if (index === 0) {
            doc.fontSize(8)
                .font('Helvetica')
                .fillColor('#333333')
                .text(`${index + 1}) ${estimation.product_description || product}`, col1X + 5, currentY + 6, { width: col1Width - 10 });
            doc.fontSize(8)
                .font('Helvetica')
                .fillColor('#333333')
                .text(estimation.gst ? `${estimation.gst}%` : '', col2X + 5, currentY + 6, { width: col2Width - 10, align: 'center' });
            doc.fontSize(8)
                .font('Helvetica')
                .fillColor('#333333')
                .text(estimation.amount ? `Rs. ${baseAmount.toLocaleString('en-IN')}` : '', col3X + 5, currentY + 6, { width: col3Width - 10, align: 'right' });
        } else if (index === 2) {
            // Dynamic inverter watt for 3rd row
            const watt = estimation.requested_watts ? `${estimation.requested_watts}W` : '3KW';
            doc.fontSize(8)
                .font('Helvetica')
                .fillColor('#333333')
                .text(`${index + 1}) GroWatt ${watt} TL-X2 (Pro) Solar Invertor- 1`, col1X + 5, currentY + 6, { width: col1Width - 10 });
        } else {
            doc.fontSize(8)
                .font('Helvetica')
                .fillColor('#333333')
                .text(`${index + 1}) ${product}`, col1X + 5, currentY + 6, { width: col1Width - 10 });
        }
        currentY += rowHeight;
    });
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
    // Total in words just below table
    doc.fontSize(10)
        .font('Helvetica-Bold')
        .text(`Total Amount in Words: ${numberToWords(totalAmount)} only`, col1X, currentY + rowHeight + 5, { width: col1Width + col2Width + col3Width });
    doc.y = currentY + rowHeight + 30;
    // 1st page: 11 rows, 2nd page: 16 rows, so after 11 rows, next page, after 27 rows, next page
    if (pageNumber === 2) {
        doc.fontSize(10)
            .font('Helvetica')
            .text('Thank you for your interest in doing business with Solar Hut Solutions. Waiting for your order confirmation…', 50, doc.y, { width: 495 })
            .moveDown(2);
        addFooter(doc, pageNumber);
        // Page 3: Bank details, then warranty
        doc.addPage();
        pageNumber++;
        addWatermark(doc);
        addHeader(doc, pageNumber, estimation);
        doc.fontSize(12)
            .font('Helvetica-Bold')
            .fillColor('#FF6B00')
            .text('Bank Details for Payments:', 50, doc.y)
            .moveDown(0.5);
        doc.fontSize(10)
            .font('Helvetica')
            .fillColor('#333333')
            .text('Bank Name: State Bank of India', 50, doc.y)
            .text('Account Name: Solar Hut Solutions LLP', 50, doc.y)
            .text('A/C No: 44513337275', 50, doc.y)
            .text('IFSC: SBIN0012948', 50, doc.y)
            .text('Branch: Pantakalava Road, Vijayawada.', 50, doc.y)
            .moveDown(1);
        doc.fontSize(12)
            .font('Helvetica-Bold')
            .fillColor('#FF6B00')
            .text('For UPI Payments:', 50, doc.y)
            .moveDown(0.5);
        doc.fontSize(10)
            .font('Helvetica')
            .fillColor('#333333')
            .text('UPI ID: solarhutsolutionsllp@sbi', 50, doc.y)
            .moveDown(2);
        // Warranty Terms and Coverage
        doc.fontSize(12)
            .font('Helvetica-Bold')
            .fillColor('#FF6B00')
            .text('Warranty Terms and Conditions', 50, doc.y)
            .moveDown(0.5);
        doc.fontSize(11)
            .font('Helvetica-Bold')
            .fillColor('#333333')
            .text('Warranty Coverage', 50, doc.y)
            .moveDown(0.3);
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
            doc.fontSize(9)
                .text(`${idx + 1}) ${item}`, 50, doc.y, { width: 495 })
                .moveDown(0.3);
        });
        addFooter(doc, pageNumber);
        // Page 4: Warranty eligibility, exclusions
        doc.addPage();
        pageNumber++;
        addWatermark(doc);
        addHeader(doc, pageNumber, estimation);
        doc.fontSize(11)
            .font('Helvetica-Bold')
            .fillColor('#333333')
            .text('Warranty Eligibility', 50, doc.y)
            .moveDown(0.3);
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
            doc.text(`${idx + 1}) ${item}`, 50, doc.y, { width: 495 })
                .moveDown(0.3);
        });
        doc.moveDown(0.5);
        doc.fontSize(11)
            .font('Helvetica-Bold')
            .text('Exclusions (What\'s NOT covered)', 50, doc.y)
            .moveDown(0.3);
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
            doc.text(`${idx + 1}. ${item}`, 50, doc.y, { width: 495 })
                .moveDown(0.3);
        });
        addFooter(doc, pageNumber);
        // Page 5: Benefits and regards
        doc.addPage();
        pageNumber++;
        addWatermark(doc);
        addHeader(doc, pageNumber, estimation);
        doc.fontSize(12)
            .font('Helvetica-Bold')
            .fillColor('#FF6B00')
            .text('Benefits of choosing Solar Hut Solutions', 50, doc.y)
            .moveDown(0.5);
        const benefits = [
            'Free Site Visits.',
            'End-End solutions from Consultation to Installation and Technical support',
            'We Provide Flexible Financing options from various Banks with EMI\'s Starting as low as Rs. 1,500 per Month.',
            'Provide Software and Hardware support throughout your Journey in Solar.',
            'Technical Solution will be resolved in minutes over phone (Software Related issues)',
            'For any Site related issue, the team will be dispatched within 24 hours after we receive the information.'
        ];
        benefits.forEach((item, idx) => {
            doc.fontSize(10)
                .font('Helvetica')
                .fillColor('#333333')
                .text(`${idx + 1}) ${item}`, 50, doc.y, { width: 495 })
                .moveDown(0.5);
        });
        doc.moveDown(2);
        doc.fontSize(10)
            .font('Helvetica-Bold')
            .text('Regards', 50, doc.y)
            .moveDown(0.3);
        doc.fontSize(10)
            .font('Helvetica')
            .text('Phani Devunipally', 50, doc.y)
            .text('9848992333', 50, doc.y)
            .text('Solar Hut Solutions LLP', 50, doc.y)
            .text('Vijayawada, Andhra Pradesh', 50, doc.y);
        addFooter(doc, pageNumber);
    }
    // Page 2: Amount in words and thank you
    addFooter(doc, pageNumber);
    doc.addPage();
    pageNumber++;
    addWatermark(doc);
    addHeader(doc, pageNumber, estimation);
    // doc.fontSize(10)
    //     .font('Helvetica-Bold')
    //     .text(`Total Amount in Words: ${numberToWords(totalAmount)} only`, 50, doc.y)
    //     .moveDown(1);
    // doc.fontSize(10)
    //     .font('Helvetica')
    //     .text('Thank you for your interest in doing business with Solar Hut Solutions. Waiting for your order confirmation…', 50, doc.y, { width: 495 })
    //     .moveDown(2);
    // addFooter(doc, pageNumber);
    // Page 3: Warranty content
    doc.addPage();
    pageNumber++;
    addWatermark(doc);
    addHeader(doc, pageNumber, estimation);
    doc.fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#FF6B00')
        .text('Warranty Terms and Conditions', 50, doc.y)
        .moveDown(0.5);
    doc.fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#333333')
        .text('Warranty Coverage', 50, doc.y)
        .moveDown(0.3);
    doc.fontSize(9)
        .font('Helvetica')
        .text('Our warranty covers the following aspects:', 50, doc.y)
        .moveDown(0.3);
    // ...existing code...
    
    doc.addPage();
    pageNumber++;
    addWatermark(doc);
    addHeader(doc, pageNumber, estimation);
    
    doc.fontSize(10)
        .font('Helvetica-Bold')
        .text(`Total Amount in Words: ${numberToWords(totalAmount)} only`, 50, doc.y)
        .moveDown(1);
    
    doc.fontSize(10)
        .font('Helvetica')
        .text('Thank you for your interest in doing business with Solar Hut Solutions. Waiting for your order confirmation…', 50, doc.y, { width: 495 })
        .moveDown(2);
    
    addFooter(doc, pageNumber);
    
    doc.addPage();
    pageNumber++;
    addWatermark(doc);
    addHeader(doc, pageNumber, estimation);
    
    doc.fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#FF6B00')
        .text('Bank Details for Payments:', 50, doc.y)
        .moveDown(0.5);
    
    doc.fontSize(10)
        .font('Helvetica')
        .fillColor('#333333')
        .text('Bank Name: State Bank of India', 50, doc.y)
        .text('Account Name: Solar Hut Solutions LLP', 50, doc.y)
        .text('A/C No: 44513337275', 50, doc.y)
        .text('IFSC: SBIN0012948', 50, doc.y)
        .text('Branch: Pantakalava Road, Vijayawada.', 50, doc.y)
        .moveDown(1);
    
    doc.fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#FF6B00')
        .text('For UPI Payments:', 50, doc.y)
        .moveDown(0.5);
    
    doc.fontSize(10)
        .font('Helvetica')
        .fillColor('#333333')
        .text('UPI ID: solarhutsolutionsllp@sbi', 50, doc.y)
        .moveDown(2);
    
    doc.fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#FF6B00')
        .text('Warranty Terms and Conditions', 50, doc.y)
        .moveDown(0.5);
    
    doc.fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#333333')
        .text('Warranty Coverage', 50, doc.y)
        .moveDown(0.3);
    
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
        doc.fontSize(9)
            .text(`${idx + 1}) ${item}`, 50, doc.y, { width: 495 })
            .moveDown(0.3);
    });
    
    addFooter(doc, pageNumber);
    
    doc.addPage();
    pageNumber++;
    addWatermark(doc);
    addHeader(doc, pageNumber, estimation);
    
    doc.fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#333333')
        .text('Warranty Eligibility', 50, doc.y)
        .moveDown(0.3);
    
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
        doc.text(`${idx + 1}) ${item}`, 50, doc.y, { width: 495 })
            .moveDown(0.3);
    });
    
    doc.moveDown(0.5);
    
    doc.fontSize(11)
        .font('Helvetica-Bold')
        .text('Exclusions (What\'s NOT covered)', 50, doc.y)
        .moveDown(0.3);
    
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
        doc.text(`${idx + 1}. ${item}`, 50, doc.y, { width: 495 })
            .moveDown(0.3);
    });
    
    addFooter(doc, pageNumber);
    
    doc.addPage();
    pageNumber++;
    addWatermark(doc);
    addHeader(doc, pageNumber, estimation);
    
    doc.fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#FF6B00')
        .text('Benefits of choosing Solar Hut Solutions', 50, doc.y)
        .moveDown(0.5);
    
    const benefits = [
        'Free Site Visits.',
        'End-End solutions from Consultation to Installation and Technical support',
        'We Provide Flexible Financing options from various Banks with EMI\'s Starting as low as Rs. 1,500 per Month.',
        'Provide Software and Hardware support throughout your Journey in Solar.',
        'Technical Solution will be resolved in minutes over phone (Software Related issues)',
        'For any Site related issue, the team will be dispatched within 24 hours after we receive the information.'
    ];
    
    benefits.forEach((item, idx) => {
        doc.fontSize(10)
            .font('Helvetica')
            .fillColor('#333333')
            .text(`${idx + 1}) ${item}`, 50, doc.y, { width: 495 })
            .moveDown(0.5);
    });
    
    doc.moveDown(2);
    
    doc.fontSize(10)
        .font('Helvetica-Bold')
        .text('Regards', 50, doc.y)
        .moveDown(0.3);
    
    doc.fontSize(10)
        .font('Helvetica')
        .text('Phani Devunipally', 50, doc.y)
        .text('9848992333', 50, doc.y)
        .text('Solar Hut Solutions LLP', 50, doc.y)
        .text('Vijayawada, Andhra Pradesh', 50, doc.y);
    
    addFooter(doc, pageNumber);

    return doc;
};
