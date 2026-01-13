import { Router } from 'express';
import { listInvoices, createInvoiceHandler, downloadInvoice } from '../controllers/invoiceController';

const router = Router();

router.get('/', listInvoices);
router.post('/', createInvoiceHandler);
router.get('/:id/download', downloadInvoice);

export default router;
