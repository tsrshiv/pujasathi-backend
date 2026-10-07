import express from 'express';
import { getMyPanditLedger } from '../controllers/ledger.controller.js';
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/pandit', verifyJWT, authorizeRoles('pandit'), getMyPanditLedger);

export default router;
