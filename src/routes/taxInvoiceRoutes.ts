import { Router } from 'express';
import { createTaxInvoice, listTaxInvoices, downloadTaxInvoice } from '../controllers/taxInvoiceController';

const router = Router();

router.post('/', createTaxInvoice);
router.get('/', listTaxInvoices);
router.get('/:id/download', downloadTaxInvoice);

export default router;
