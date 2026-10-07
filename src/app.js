import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import pujaRoutes from './routes/puja.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import panditRoutes from './routes/pandit.routes.js';
import adminRoutes from './routes/admin.routes.js';
import reviewRoutes from './routes/review.routes.js';
import userRoutes from './routes/user.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import ledgerRoutes from './routes/ledger.routes.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/pujas', pujaRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/pandits', panditRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ledger', ledgerRoutes);

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: "Puja Booking API is running successfully!"
  });
});

export default app;