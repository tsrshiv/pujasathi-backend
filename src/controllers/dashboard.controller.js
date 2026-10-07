import Booking from '../models/booking.model.js';
import Review from '../models/review.model.js';

// @desc    Get Pandit Dashboard Stats (Earnings, Bookings, Ratings)
// @route   GET /api/dashboard/pandit
// @access  Private (Pandit)
export const getPanditDashboard = async (req, res) => {
  try {
    const panditId = req.user._id;

    // Fetch all completed bookings for earnings calculation
    const completedBookings = await Booking.find({
      pandit: panditId,
      bookingStatus: 'completed',
    });

    const totalEarnings = completedBookings.reduce(
      (acc, booking) => acc + booking.totalAmount,
      0
    );

    // Counts for different statuses
    const pendingRequests = await Booking.countDocuments({
      'address.city': req.user.city,
      bookingStatus: 'pending',
      pandit: { $exists: false },
      rejectedPandits: { $ne: panditId },
    });

    const acceptedBookings = await Booking.countDocuments({
      pandit: panditId,
      bookingStatus: 'accepted',
    });

    // Rating Average
    const reviews = await Review.find({ pandit: panditId });
    const avgRating =
      reviews.length > 0
        ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
        : 0;

    res.status(200).json({
      success: true,
      data: {
        totalEarnings,
        completedPujasCount: completedBookings.length,
        acceptedBookingsCount: acceptedBookings,
        pendingRequestsCount: pendingRequests,
        averageRating: parseFloat(avgRating),
        totalReviews: reviews.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Client Dashboard Stats (Upcoming & Past Bookings)
// @route   GET /api/dashboard/client
// @access  Private (Client)
export const getClientDashboard = async (req, res) => {
  try {
    const clientId = req.user._id;

    const upcomingBookings = await Booking.find({
      client: clientId,
      bookingStatus: { $in: ['pending', 'accepted'] },
    })
      .populate('puja', 'title category durationInHours')
      .populate('pandit', 'name phone')
      .sort({ bookingDate: 1 });

    const pastBookings = await Booking.find({
      client: clientId,
      bookingStatus: { $in: ['completed', 'cancelled'] },
    })
      .populate('puja', 'title category')
      .populate('pandit', 'name')
      .sort({ bookingDate: -1 });

    res.status(200).json({
      success: true,
      data: {
        upcomingCount: upcomingBookings.length,
        pastCount: pastBookings.length,
        upcomingBookings,
        pastBookings,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};