import express from 'express';
import {
  getPanditDashboard,
  getClientDashboard,
} from '../controllers/dashboard.controller.js';
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/pandit', verifyJWT, authorizeRoles('pandit'), getPanditDashboard);
router.get('/client', verifyJWT, authorizeRoles('client'), getClientDashboard);

export default router;