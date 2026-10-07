import express from 'express';
import { getNearbyPandits, togglePanditStatus } from '../controllers/pandit.controller.js';
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Public route to search nearby pandits
router.get('/nearby', getNearbyPandits);

// Protected route for pandits to switch online/offline
router.put('/toggle-status', verifyJWT, authorizeRoles('pandit'), togglePanditStatus);

export default router;