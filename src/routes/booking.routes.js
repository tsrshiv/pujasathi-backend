import express from 'express';
import {
  createBooking,
  getMyBookings,
  getNearbyPendingBookings,
  respondToBooking,
  getPanditJobs,
} from '../controllers/booking.controller.js';
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Client routes
router.post('/', verifyJWT, authorizeRoles('client'), createBooking);
router.get('/my-bookings', verifyJWT, authorizeRoles('client'), getMyBookings);

// Pandit routes
router.get('/pandit/pending', verifyJWT, authorizeRoles('pandit'), getNearbyPendingBookings);
router.get('/pandit/my-jobs', verifyJWT, authorizeRoles('pandit'), getPanditJobs);
router.put('/:id/respond', verifyJWT, authorizeRoles('pandit'), respondToBooking);

export default router;