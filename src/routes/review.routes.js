import express from 'express';
import { createReview, getPanditReviews } from '../controllers/review.controller.js';
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/', verifyJWT, authorizeRoles('client'), createReview);
router.get('/pandit/:panditId', getPanditReviews);

export default router;