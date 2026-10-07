import express from 'express';
import { createOrder, verifyPayment } from '../controllers/payment.controller.js';
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/create-order', verifyJWT, authorizeRoles('client'), createOrder);
router.post('/verify', verifyJWT, authorizeRoles('client'), verifyPayment);

export default router;