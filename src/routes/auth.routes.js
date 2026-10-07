import express from 'express';
import { registerUser, loginUser, sendRegistrationOtp } from '../controllers/auth.controller.js';
import { forgotPassword, resetPassword } from '../controllers/auth.controller.js';
const router = express.Router();

router.post('/register', registerUser);
router.post('/register/send-otp', sendRegistrationOtp);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
export default router;