import { Router } from 'express';
import { listInvoices, createInvoiceHandler, downloadInvoice, deleteInvoice } from '../controllers/invoiceController';

const router = Router();

router.get('/', listInvoices);
router.post('/', createInvoiceHandler);
router.get('/:id/download', downloadInvoice);
router.delete('/:id', deleteInvoice);

export default router;
