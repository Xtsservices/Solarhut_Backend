import { Request, Response } from 'express';
import Joi from 'joi';
import { createTaxInvoice as createTaxInvoiceQuery, getTaxInvoices, updateTaxInvoiceByEstimationId, getTaxInvoiceById, deleteTaxInvoiceById } from '../queries/invoiceQueries';
import { getEstimationById } from '../queries/estimationQueries';
import { generateInvoicePDF } from '../utils/invoicegenerate';
import { taxInvoiceValidation, deleteTaxInvoiceValidation } from '../utils/validations';

export const createTaxInvoice = async (req: Request, res: Response) => {
  if (!req.body.invoiceDate) {
    req.body.invoiceDate = new Date().toISOString().slice(0, 10);
  }
  // Accept: estimationId, amount, product_description, gst_percentage, structure (optional)
  // Calculate CGST/SGST/IGST automatically
  const { estimationId, amount, product_description, gst_percentage = 0, structure } = req.body;
  if (!estimationId || !amount || !gst_percentage) {
    return res.status(400).json({ error: 'estimationId, amount, and gst_percentage are required.' });
  }
  try {
    const estimation = await getEstimationById(estimationId);
    if (!estimation) {
      return res.status(404).json({ error: 'Estimation not found' });
    }
    // Calculate GST splits - amount is total including GST
    let cgst_percentage = 0, sgst_percentage = 0, igst_percentage = 0;
    let cgst_value = 0, sgst_value = 0, igst_value = 0;
    
    // Calculate base amount (excluding GST) from total amount (including GST)
    const baseAmount = amount / (1 + (gst_percentage / 100));
    
    if (estimation.state && estimation.state.toLowerCase() === 'andhra pradesh') {
      // Intra-state: split equally between CGST and SGST
      cgst_percentage = gst_percentage / 2;
      sgst_percentage = gst_percentage / 2;
      cgst_value = Math.round(((baseAmount * cgst_percentage) / 100) * 100) / 100;
      sgst_value = Math.round(((baseAmount * sgst_percentage) / 100) * 100) / 100;
    } else {
      // Inter-state: IGST only
      igst_percentage = gst_percentage;
      igst_value = Math.round(((baseAmount * igst_percentage) / 100) * 100) / 100;
    }
    const taxInvoiceToInsert = {
      estimation_id: estimationId,
      invoiceDate: req.body.invoiceDate,
      customer_name: estimation.customer_name,
      door_no: estimation.door_no || '',
      area: estimation.area || '',
      city: estimation.city || '',
      district: estimation.district || '',
      state: estimation.state || '',
      pincode: estimation.pincode || '',
      mobile: estimation.mobile || '',
      structure: structure !== undefined ? structure : estimation.structure,
      product_description: product_description !== undefined ? product_description : estimation.product_description,
      requested_watts: estimation.requested_watts || '',
      gst: gst_percentage,
      amount,
      cgst_value,
      cgst_percentage,
      sgst_value,
      sgst_percentage,
      igst_value,
      igst_percentage
    };
    // Check if tax invoice already exists for this estimation
    const [rows]: [any[], any] = await (await import('../db')).db.query('SELECT * FROM tax_invoices WHERE estimation_id = ?', [estimationId]);
    if (rows && rows.length > 0) {
      const updatedTaxInvoice = await updateTaxInvoiceByEstimationId(estimationId, taxInvoiceToInsert);
      return res.status(200).json(updatedTaxInvoice);
    } else {
      const taxInvoice = await createTaxInvoiceQuery(taxInvoiceToInsert);
      return res.status(201).json(taxInvoice);
    }
  } catch (err) {
    console.error('Create/Update Tax Invoice Error:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to create or update tax invoice', details: errorMessage });
  }
};

export const listTaxInvoices = async (req: Request, res: Response) => {
  try {
    const { includeInactive } = req.query;
    const includeInactiveFlag = includeInactive === 'true';
    const taxInvoices = await getTaxInvoices(includeInactiveFlag);
    res.json(taxInvoices);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tax invoices' });
  }
};

export const downloadTaxInvoice = async (req: Request, res: Response) => {
  try {
    const taxInvoiceId = parseInt(req.params.id, 10);
    if (isNaN(taxInvoiceId)) {
      return res.status(400).json({ error: 'Invalid tax invoice id' });
    }
    // For downloads, include inactive records so users can still download previously deleted tax invoices
    const taxInvoiceData = await getTaxInvoiceById(taxInvoiceId, true);
    console.log('[DEBUG] taxInvoiceData Raw from DB:', JSON.stringify(taxInvoiceData, null, 2));
    
    if (!taxInvoiceData) {
      return res.status(404).json({ error: 'Tax Invoice not found' });
    }
    
    // Log the IGST values specifically
    console.log('[DEBUG] IGST Values:');
    console.log('igst_value:', taxInvoiceData.igst_value);
    console.log('igst_percentage:', taxInvoiceData.igst_percentage);
    console.log('cgst_value:', taxInvoiceData.cgst_value);
    console.log('sgst_value:', taxInvoiceData.sgst_value);
    console.log('amount:', taxInvoiceData.amount);
    console.log('state:', taxInvoiceData.state);
    
    const taxInvoiceModule = await import('../utils/taxInvoice');
    const generateTaxInvoicePDF = taxInvoiceModule.generateTaxInvoicePDF;
    console.log('[DEBUG] Calling generateTaxInvoicePDF with:', taxInvoiceData);
    const pdfBuffer = await generateTaxInvoicePDF(taxInvoiceData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=tax_invoice.pdf');
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[TAX INVOICE PDF ERROR]', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to generate tax invoice PDF', details: errorMessage });
  }
};

export const deleteTaxInvoice = async (req: Request, res: Response) => {
  try {
    const taxInvoiceId = parseInt(req.params.id, 10);
    
    // Validate the request
    const { error } = deleteTaxInvoiceValidation.validate({ id: taxInvoiceId });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const deletedTaxInvoice = await deleteTaxInvoiceById(taxInvoiceId);
    
    if (!deletedTaxInvoice) {
      return res.status(404).json({ error: 'Tax invoice not found or already deleted' });
    }
    
    res.status(200).json({ 
      message: 'Tax invoice deleted successfully', 
      deletedTaxInvoice: {
        ...deletedTaxInvoice,
        status: 'Inactive'
      }
    });
  } catch (err) {
    console.error('Delete Tax Invoice Error:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to delete tax invoice', details: errorMessage });
  }
};
