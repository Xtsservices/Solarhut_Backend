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
