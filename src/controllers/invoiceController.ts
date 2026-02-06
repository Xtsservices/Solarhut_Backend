import { Request, Response } from 'express';

import { createInvoice, getInvoices, getInvoiceById, deleteInvoiceById } from '../queries/invoiceQueries';
import { getEstimationById } from '../queries/estimationQueries';
import { generateInvoicePDF } from '../utils/invoicegenerate';
import { invoiceValidation, deleteInvoiceValidation } from '../utils/validations';

export const listInvoices = async (req: Request, res: Response) => {
  try {
    const { includeInactive } = req.query;
    const includeInactiveFlag = includeInactive === 'true';
    const invoices = await getInvoices(includeInactiveFlag);
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
};


export const createInvoiceHandler = async (req: Request, res: Response) => {
  if (!req.body.invoiceDate) {
    req.body.invoiceDate = new Date().toISOString().slice(0, 10);
  }
  const { error } = invoiceValidation.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });
  try {
    const { estimationId, amount, product_description } = req.body;
    const estimation = await getEstimationById(estimationId);
    if (!estimation) {
      return res.status(404).json({ error: 'Estimation not found' });
    }
    const invoiceToInsert = {
      ...estimation,
      estimation_id: estimationId,
      invoiceDate: req.body.invoiceDate,
      amount,
      product_description: product_description !== undefined ? product_description : estimation.product_description
    };
    const invoice = await createInvoice(invoiceToInsert);
    res.status(201).json(invoice);
  } catch (err) {
    console.error('Create Invoice Error:', err);
    let errorMessage = 'Failed to create invoice';
    // MySQL duplicate entry error code is 'ER_DUP_ENTRY'
    if (err && typeof err === 'object' && 'code' in err && (err as any).code === 'ER_DUP_ENTRY') {
      // Try to extract which field is duplicated
      if ((err as any).message && (err as any).message.includes('estimation_id')) {
        errorMessage = 'Invoice already exists for this estimation.';
      } else {
        errorMessage = 'Duplicate entry. An invoice with this key already exists.';
      }
      return res.status(400).json({ error: errorMessage });
    }
    // fallback for other errors
    errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to create invoice', details: errorMessage });
  }
};

export const downloadInvoice = async (req: Request, res: Response) => {
  try {
    const invoiceId = parseInt(req.params.id, 10);
    if (isNaN(invoiceId)) {
      return res.status(400).json({ error: 'Invalid invoice id' });
    }
    // For downloads, include inactive records so users can still download previously deleted invoices
    const invoiceData = await getInvoiceById(invoiceId, true);
    if (!invoiceData) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    const pdfBuffer = await generateInvoicePDF(invoiceData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=invoice.pdf');
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate invoice PDF' });
  }
};

export const deleteInvoice = async (req: Request, res: Response) => {
  try {
    const invoiceId = parseInt(req.params.id, 10);
    
    // Validate the request
    const { error } = deleteInvoiceValidation.validate({ id: invoiceId });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const deletedInvoice = await deleteInvoiceById(invoiceId);
    
    if (!deletedInvoice) {
      return res.status(404).json({ error: 'Invoice not found or already deleted' });
    }
    
    res.status(200).json({ 
      message: 'Invoice deleted successfully', 
      deletedInvoice: {
        ...deletedInvoice,
        status: 'Inactive'
      }
    });
  } catch (err) {
    console.error('Delete Invoice Error:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to delete invoice', details: errorMessage });
  }
};
