import { Router } from 'express';
import { createTaxInvoice, listTaxInvoices, downloadTaxInvoice, deleteTaxInvoice } from '../controllers/taxInvoiceController';

const router = Router();

router.post('/', createTaxInvoice);
router.get('/', listTaxInvoices);
router.get('/:id/download', downloadTaxInvoice);
router.delete('/:id', deleteTaxInvoice);

export default router;
