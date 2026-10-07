import express from 'express';
import {
  createPuja,
  getAllPujas,
  getPujaById,
  updatePuja,
  deletePuja
} from '../controllers/puja.controller.js';
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Public Routes
router.get('/', getAllPujas);
router.get('/:id', getPujaById);

// Protected Admin Routes
router.post('/', verifyJWT, authorizeRoles('admin'), createPuja);
router.put('/:id', verifyJWT, authorizeRoles('admin'), updatePuja);
router.delete('/:id', verifyJWT, authorizeRoles('admin'), deletePuja);

export default router;