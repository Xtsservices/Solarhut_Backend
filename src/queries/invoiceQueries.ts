// --- TAX INVOICE QUERIES ---
const validTaxInvoiceColumns = [
  'estimation_id', 'invoiceDate', 'customer_name', 'door_no', 'area', 'city',
  'district', 'state', 'pincode', 'mobile', 'structure', 'product_description',
  'requested_watts', 'gst', 'amount', 'cgst_value', 'cgst_percentage',
  'sgst_value', 'sgst_percentage', 'igst_value', 'igst_percentage',
  'created_by', 'updated_by', 'status'
];

export async function createTaxInvoice(taxInvoice: any) {
  // Filter only valid columns
  const keys: string[] = [];
  const values: any[] = [];
  
  for (const key of validTaxInvoiceColumns) {
    if (key in taxInvoice) {
      keys.push(`\`${key}\``);
      values.push(taxInvoice[key]);
    }
  }
  
  const [result]: any = await db.query(
    `INSERT INTO tax_invoices (${keys.join(',')}) VALUES (${values.map(() => '?').join(',')})`,
    values
  );
  const [rows]: [any[], any] = await db.query('SELECT * FROM tax_invoices WHERE id = ?', [result.insertId]);
  return rows[0];
}

export async function updateTaxInvoiceByEstimationId(estimationId: number, updateData: any) {
  // Filter only valid columns
  const setClauses: string[] = [];
  const values: any[] = [];
  
  for (const key of validTaxInvoiceColumns) {
    if (key in updateData && key !== 'estimation_id') { // Don't update estimation_id
      setClauses.push(`\`${key}\` = ?`);
      values.push(updateData[key]);
    }
  }
  
  if (setClauses.length === 0) {
    const [rows]: [any[], any] = await db.query('SELECT * FROM tax_invoices WHERE estimation_id = ? LIMIT 1', [estimationId]);
    return rows[0];
  }
  
  await db.query(
    `UPDATE tax_invoices SET ${setClauses.join(', ')} WHERE estimation_id = ?`,
    [...values, estimationId]
  );
  const [rows]: [any[], any] = await db.query('SELECT * FROM tax_invoices WHERE estimation_id = ? LIMIT 1', [estimationId]);
  return rows[0];
}

export async function getTaxInvoices() {
  const [rows] = await db.query('SELECT * FROM tax_invoices ORDER BY invoiceDate DESC');
  return rows;
}

export async function getTaxInvoiceById(id: number) {
  const [rows]: [any[], any] = await db.query('SELECT * FROM tax_invoices WHERE id = ? LIMIT 1', [id]);
  return rows[0];
}
export async function updateInvoiceByEstimationId(estimationId: number, updateData: any) {
  // Build SET clause dynamically
  const setClause = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
  const values = Object.values(updateData);
  // Update invoice where estimation_id matches
  await db.query(
    `UPDATE invoices SET ${setClause} WHERE estimation_id = ?`,
    [...values, estimationId]
  );
  // Return the updated invoice
  const [rows]: [any[], any] = await db.query('SELECT * FROM invoices WHERE estimation_id = ? LIMIT 1', [estimationId]);
  return rows[0];
}
import db from '../db';

export async function createInvoice(invoice: any) {
  // Insert invoice into DB (table: invoices)
  const [result]: any = await db.query(
    `INSERT INTO invoices (${Object.keys(invoice).join(",")}) VALUES (${Object.values(invoice).map(() => '?').join(",")})`,
    Object.values(invoice)
  );
  // Fetch the inserted row using the insertId
  const [rows]: [any[], any] = await db.query('SELECT * FROM invoices WHERE id = ?', [result.insertId]);
  return rows[0];
}

export async function getInvoices() {
  const [rows] = await db.query('SELECT * FROM invoices ORDER BY invoiceDate DESC');
  return rows;
}

export async function getInvoiceById(id: number) {
  const [rows]: [any[], any] = await db.query('SELECT * FROM invoices WHERE id = ? LIMIT 1', [id]);
  return rows[0];
}
