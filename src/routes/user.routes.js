import express from 'express';
import { uploadAvatar } from '../controllers/user.controller.js';
import { upload } from '../middlewares/multer.middleware.js';
import {
  getUserProfile,
  updateUserProfile,
  updatePanditLocation,
} from '../controllers/user.controller.js';
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/profile', verifyJWT, getUserProfile);
router.put('/profile', verifyJWT, updateUserProfile);
router.put('/location', verifyJWT, authorizeRoles('pandit'), updatePanditLocation);
router.put('/upload-avatar', verifyJWT, upload.single('avatar'), uploadAvatar);
export default router;