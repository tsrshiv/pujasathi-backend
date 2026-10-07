import express from 'express';
import { getPendingPandits, approvePandit } from '../controllers/admin.controller.js';
import { getAdminPanditLedgers, recordAdminSettlement } from '../controllers/ledger.controller.js';
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/pandits/pending', verifyJWT, authorizeRoles('admin'), getPendingPandits);
router.put('/pandits/:id/approve', verifyJWT, authorizeRoles('admin'), approvePandit);
router.get('/pandit-ledgers', verifyJWT, authorizeRoles('admin'), getAdminPanditLedgers);
router.post('/pandit-ledgers/:panditId/settlements', verifyJWT, authorizeRoles('admin'), recordAdminSettlement);

export default router;