// --- TAX INVOICE QUERIES ---
const validTaxInvoiceColumns = [
  'estimation_id', 'invoiceDate', 'tax_invoice_number', 'customer_name', 'door_no', 'area', 'city',
  'district', 'state', 'pincode', 'mobile', 'structure', 'product_description',
  'requested_watts', 'gst', 'amount', 'cgst_value', 'cgst_percentage',
  'sgst_value', 'sgst_percentage', 'igst_value', 'igst_percentage',
  'created_by', 'updated_by', 'status'
];

export async function createTaxInvoice(taxInvoice: any) {
  // Generate tax invoice number if not provided
  if (!taxInvoice.tax_invoice_number) {
    taxInvoice.tax_invoice_number = await getNextTaxInvoiceNumber();
  }
  
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

export async function getTaxInvoices(includeInactive: boolean = false) {
  let query = 'SELECT * FROM tax_invoices';
  if (!includeInactive) {
    query += ' WHERE status = "Active"';
  }
  query += ' ORDER BY invoiceDate DESC';
  const [rows] = await db.query(query);
  return rows;
}

export async function getTaxInvoiceById(id: number, includeInactive: boolean = false) {
  let query = 'SELECT * FROM tax_invoices WHERE id = ?';
  const params: any[] = [id];
  if (!includeInactive) {
    query += ' AND status = ?';
    params.push('Active');
  }
  query += ' LIMIT 1';
  const [rows]: [any[], any] = await db.query(query, params);
  return rows[0];
}

export async function deleteTaxInvoiceById(id: number) {
  // First check if the tax invoice exists and is active
  const [rows]: [any[], any] = await db.query('SELECT * FROM tax_invoices WHERE id = ? AND status = ? LIMIT 1', [id, 'Active']);
  if (rows.length === 0) {
    return null;
  }
  
  // Soft delete - change status to 'Inactive'
  await db.query('UPDATE tax_invoices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['Inactive', id]);
  return rows[0]; // Return the tax invoice data before deletion
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

// Helper function to generate next invoice number
export async function getNextInvoiceNumber(): Promise<string> {
  const [rows]: [any[], any] = await db.query(
    'SELECT MAX(CAST(invoice_number AS UNSIGNED)) as max_num FROM invoices WHERE invoice_number REGEXP "^[0-9]+$"'
  );
  const maxNum = rows[0]?.max_num || 0;
  return String(maxNum + 1).padStart(6, '0');
}

// Helper function to generate next tax invoice number
export async function getNextTaxInvoiceNumber(): Promise<string> {
  const [rows]: [any[], any] = await db.query(
    'SELECT MAX(CAST(tax_invoice_number AS UNSIGNED)) as max_num FROM tax_invoices WHERE tax_invoice_number REGEXP "^[0-9]+$"'
  );
  const maxNum = rows[0]?.max_num || 0;
  return String(maxNum + 1).padStart(6, '0');
}

export async function createInvoice(invoice: any) {
  // Generate invoice number if not provided
  if (!invoice.invoice_number) {
    invoice.invoice_number = await getNextInvoiceNumber();
  }
  
  // Insert invoice into DB (table: invoices)
  const [result]: any = await db.query(
    `INSERT INTO invoices (${Object.keys(invoice).join(",")}) VALUES (${Object.values(invoice).map(() => '?').join(",")})`,
    Object.values(invoice)
  );
  // Fetch the inserted row using the insertId
  const [rows]: [any[], any] = await db.query('SELECT * FROM invoices WHERE id = ?', [result.insertId]);
  return rows[0];
}

export async function getInvoices(includeInactive: boolean = false) {
  let query = 'SELECT * FROM invoices';
  if (!includeInactive) {
    query += ' WHERE status = "Active"';
  }
  query += ' ORDER BY invoiceDate DESC';
  const [rows] = await db.query(query);
  return rows;
}

export async function getInvoiceById(id: number, includeInactive: boolean = false) {
  let query = 'SELECT * FROM invoices WHERE id = ?';
  const params: any[] = [id];
  if (!includeInactive) {
    query += ' AND status = ?';
    params.push('Active');
  }
  query += ' LIMIT 1';
  const [rows]: [any[], any] = await db.query(query, params);
  return rows[0];
}

export async function deleteInvoiceById(id: number) {
  // First check if the invoice exists and is active
  const [rows]: [any[], any] = await db.query('SELECT * FROM invoices WHERE id = ? AND status = ? LIMIT 1', [id, 'Active']);
  if (rows.length === 0) {
    return null;
  }
  
  // Soft delete - change status to 'Inactive'
  await db.query('UPDATE invoices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['Inactive', id]);
  return rows[0]; // Return the invoice data before deletion
}
