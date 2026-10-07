import Review from '../models/review.model.js';
import Booking from '../models/booking.model.js';

// @desc    Create a review for a booking
// @route   POST /api/reviews
// @access  Private (Client)
export const createReview = async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Check if the user making request is the same client who booked
    if (booking.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized action' });
    }

    if (!booking.pandit) {
      return res.status(400).json({ success: false, message: 'No pandit assigned to this booking yet' });
    }

    // Prevent duplicate reviews for same booking
    const existingReview = await Review.findOne({ booking: bookingId });
    if (existingReview) {
      return res.status(400).json({ success: false, message: 'Review already submitted for this booking' });
    }

    const review = await Review.create({
      booking: bookingId,
      client: req.user._id,
      pandit: booking.pandit,
      rating,
      comment,
    });

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: review,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all reviews for a specific Pandit
// @route   GET /api/reviews/pandit/:panditId
// @access  Public
export const getPanditReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ pandit: req.params.panditId })
      .populate('client', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};