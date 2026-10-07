import Booking from '../models/booking.model.js';
import mongoose from 'mongoose';
import Puja from '../models/puja.model.js';
import User from '../models/user.model.js';
import sendEmail from '../utils/sendEmail.js';
import { getIO } from '../socket.js';
import PanditLedgerEntry from '../models/panditLedgerEntry.model.js';
import { notifyBookingReady } from '../utils/bookingNotifications.js';
import { COD_COMMISSION_DUE_DAYS, splitBookingAmount } from '../utils/commission.js';

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const formatRupees = (amount) => `₹${Number(amount).toLocaleString('en-IN')}`;

const bookingEmailDetails = (booking, puja) => `
  <table style="border-collapse:collapse;width:100%;max-width:600px">
    <tr><td style="padding:8px;border:1px solid #ddd"><strong>Booking ID</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(booking._id)}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd"><strong>Puja</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(puja?.title || 'Puja')}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd"><strong>Category</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(puja?.category || 'N/A')}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd"><strong>Date</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(new Date(booking.bookingDate).toLocaleDateString('en-IN'))}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd"><strong>Time slot</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(booking.timeSlot)}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd"><strong>Payment method</strong></td><td style="padding:8px;border:1px solid #ddd">${booking.paymentMethod === 'cod' ? 'Cash on delivery' : 'Online payment'}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd"><strong>Samagri</strong></td><td style="padding:8px;border:1px solid #ddd">${booking.includeSamagri ? 'Included' : 'Not included'}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd"><strong>Puja price</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(formatRupees(puja?.priceWithoutSamagri ?? booking.totalAmount))}</td></tr>
    ${booking.includeSamagri && Number.isFinite(puja?.priceWithSamagri) && Number.isFinite(puja?.priceWithoutSamagri)
    ? `<tr><td style="padding:8px;border:1px solid #ddd"><strong>Samagri price</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(formatRupees(puja.priceWithSamagri - puja.priceWithoutSamagri))}</td></tr>`
    : ''}
    <tr><td style="padding:8px;border:1px solid #ddd"><strong>Total price</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(formatRupees(booking.totalAmount))}</td></tr>
  </table>`;

// @desc    Create a new Booking & Notify Admin + Socket Alert
// @route   POST /api/bookings
// @access  Private (Client only)
export const createBooking = async (req, res) => {
  try {
    const {
      pujaId, bookingDate, timeSlot, address, includeSamagri,
      paymentMethod = 'cod',
    } = req.body;
    if (!['cod', 'online'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: 'Choose cash on delivery or online payment.' });
    }

    const puja = await Puja.findById(pujaId);
    if (!puja) {
      return res.status(404).json({ success: false, message: 'Puja not found' });
    }

    const totalAmount = includeSamagri
      ? puja.priceWithSamagri
      : puja.priceWithoutSamagri;

    const booking = await Booking.create({
      client: req.user._id,
      puja: pujaId,
      bookingDate,
      timeSlot,
      address,
      includeSamagri,
      totalAmount,
      paymentMethod,
      paymentStatus: paymentMethod === 'cod' ? 'cod_pending' : 'pending',
    });

    const populatedBooking = await Booking.findById(booking._id)
      .populate('client', 'name email phone')
      .populate('puja', 'title category priceWithoutSamagri priceWithSamagri');

    if (paymentMethod === 'cod') {
      await notifyBookingReady(booking._id);
    }

    res.status(201).json({ success: true, data: populatedBooking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get bookings of the logged-in client
// @route   GET /api/bookings/my-bookings
// @access  Private (Client)
export const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ client: req.user._id })
      .populate('puja', 'title category durationInHours')
      .populate('pandit', 'name phone');

    res.status(200).json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update booking status (Accept / Reject / Complete)
// @route   PUT /api/bookings/:id/status
// @access  Private (Pandit / Admin)
export const updateBookingStatus = async (req, res) => {
  try {
    const { bookingStatus } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (req.user.role === 'pandit' && bookingStatus === 'accepted') {
      booking.pandit = req.user._id;
    }

    booking.bookingStatus = bookingStatus;
    await booking.save();

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get nearby pending bookings for Pandit
// @route   GET /api/bookings/pandit/pending
// @access  Private (Pandit)
export const getNearbyPendingBookings = async (req, res) => {
  try {
    const pandit = await User.findById(req.user._id);

    if (!pandit.isAvailable) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    const bookings = await Booking.find({
      bookingStatus: 'pending',
      pandit: { $exists: false },
      $or: [
        { paymentMethod: 'cod' },
        { paymentMethod: 'online', paymentStatus: 'paid' },
        { paymentMethod: { $exists: false } },
      ],
      'address.city': { $regex: new RegExp(pandit.city, 'i') },
      rejectedPandits: { $ne: req.user._id },
    })
      .populate('client', 'name email phone')
      .populate('puja', 'title priceWithoutSamagri priceWithSamagri');

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Accept or Reject a booking by Pandit
// @route   PUT /api/bookings/:id/respond
// @access  Private (Pandit)
export const respondToBooking = async (req, res) => {
  try {
    const { action } = req.body;
    const bookingId = req.params.id;

    if (!['accept', 'reject', 'complete'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid booking action.' });
    }

    const booking = await Booking.findById(bookingId)
      .populate('client', 'email name')
      .populate('puja', 'title category priceWithoutSamagri priceWithSamagri');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (action === 'complete') {
      if (booking.bookingStatus !== 'accepted' || booking.pandit?.toString() !== req.user._id.toString()) {
        return res.status(409).json({ success: false, message: 'Only the assigned pandit can complete an accepted booking.' });
      }
      if (booking.paymentMethod === 'online' && booking.paymentStatus !== 'paid') {
        return res.status(409).json({ success: false, message: 'Online payment must be verified before completion.' });
      }

      const { platformFeePaise, panditSharePaise } = splitBookingAmount(booking.totalAmount);
      const isCod = booking.paymentMethod !== 'online';
      const session = await mongoose.startSession();
      let completedBooking;
      try {
        await session.withTransaction(async () => {
          completedBooking = await Booking.findOneAndUpdate(
            { _id: bookingId, pandit: req.user._id, bookingStatus: 'accepted' },
            {
              $set: {
                bookingStatus: 'completed',
                ...(isCod ? { paymentStatus: 'cod_paid' } : {}),
              },
            },
            { new: true, session },
          );
          if (!completedBooking) {
            const error = new Error('Booking state changed; refresh your jobs.');
            error.statusCode = 409;
            throw error;
          }
          await PanditLedgerEntry.findOneAndUpdate(
            { idempotencyKey: `completion:${booking._id}` },
            {
              $setOnInsert: {
                pandit: req.user._id,
                booking: booking._id,
                type: isCod ? 'cod_platform_fee' : 'online_earning',
                amountPaise: isCod ? -platformFeePaise : panditSharePaise,
                ...(isCod ? {
                  dueAt: new Date(Date.now() + COD_COMMISSION_DUE_DAYS * 24 * 60 * 60 * 1000),
                } : {}),
                idempotencyKey: `completion:${booking._id}`,
              },
            },
            { upsert: true, new: true, runValidators: true, session },
          );
        });
      } catch (error) {
        if (error.statusCode === 409) {
          return res.status(409).json({ success: false, message: error.message });
        }
        throw error;
      } finally {
        await session.endSession();
      }

      return res.status(200).json({
        success: true,
        message: isCod
          ? `Booking completed. ${formatRupees(platformFeePaise / 100)} COD platform fee is due within ${COD_COMMISSION_DUE_DAYS} days.`
          : 'Booking completed. Your 90% share was added to your pending payout balance.',
        data: completedBooking,
      });
    }

    if (booking.bookingStatus !== 'pending') {
      return res.status(400).json({ success: false, message: 'Booking is no longer pending' });
    }

    if (!booking.address?.city || !req.user.city
      || booking.address.city.toLowerCase() !== req.user.city.toLowerCase()) {
      return res.status(403).json({ success: false, message: 'This booking is outside your service city.' });
    }

    if (action === 'accept') {
      // Several pandits can see an offer, but only the first successful
      // atomic update can accept it.
      const acceptedBooking = await Booking.findOneAndUpdate(
        {
          _id: bookingId,
          bookingStatus: 'pending',
          pandit: { $exists: false },
          rejectedPandits: { $ne: req.user._id },
          $or: [
            { paymentMethod: 'cod' },
            { paymentMethod: 'online', paymentStatus: 'paid' },
            { paymentMethod: { $exists: false } },
          ],
        },
        { $set: { bookingStatus: 'accepted', pandit: req.user._id } },
        { new: true },
      );

      if (!acceptedBooking) {
        return res.status(409).json({ success: false, message: 'This booking has already been accepted or is unavailable.' });
      }
      booking.bookingStatus = acceptedBooking.bookingStatus;
      booking.pandit = acceptedBooking.pandit;
    } else {
      const rejected = await Booking.updateOne(
        { _id: bookingId, bookingStatus: 'pending', pandit: { $exists: false } },
        { $addToSet: { rejectedPandits: req.user._id } },
      );
      if (!rejected.matchedCount) {
        return res.status(409).json({ success: false, message: 'This booking has already been accepted or is unavailable.' });
      }
      booking.rejectedPandits = [...(booking.rejectedPandits || []), req.user._id];
    }

    if (action === 'accept') {
      const acceptedDetails = await Booking.findById(bookingId)
        .populate('pandit', 'name phone address city')
        .populate('puja', 'title category priceWithoutSamagri priceWithSamagri');
      const pandit = acceptedDetails.pandit;
      const panditAddress = [pandit.address, pandit.city].filter(Boolean).map(escapeHtml).join(', ')
        || 'Not provided in pandit profile. Please contact the pandit using the phone number below.';

      try {
        await sendEmail({
          email: booking.client.email,
          subject: `Pandit confirmed your booking: ${acceptedDetails.puja.title}`,
          html: `
            <h2>Hello ${escapeHtml(booking.client.name)},</h2>
            <p>Your puja booking has been accepted by a pandit.</p>
            ${bookingEmailDetails(acceptedDetails, acceptedDetails.puja)}
            <h3>Pandit details</h3>
            <p><strong>Name:</strong> ${escapeHtml(pandit.name)}</p>
            <p><strong>Phone:</strong> ${escapeHtml(pandit.phone)}</p>
            <p><strong>Address:</strong> ${panditAddress}</p>
            <h3>Your service address</h3>
            <p>${escapeHtml(booking.address.street)}, ${escapeHtml(booking.address.city)} - ${escapeHtml(booking.address.pincode)}</p>
          `,
        });
      } catch (emailError) {
        console.error('Failed to send pandit acceptance details to client:', emailError.message);
      }
    } else if (action === 'reject') {
      try {
        await sendEmail({
          email: booking.client.email,
          subject: 'A pandit declined your Puja request',
          html: `<h2>Hello ${escapeHtml(booking.client.name)},</h2>
                 <p>One pandit declined your request. It remains available for other pandits in your city.</p>
                 ${bookingEmailDetails(booking, booking.puja)}`,
        });
      } catch (emailError) {
        console.error('Failed to send pandit rejection update to client:', emailError.message);
      }
    }

    // 2. Real-Time Socket Notification Client को भेजना
    try {
      const io = getIO();
      io.to(booking.client._id.toString()).emit('booking_status_updated', {
        message: action === 'accept'
          ? 'A pandit has accepted your booking'
          : 'A pandit declined your request; it is still being offered to others',
        booking,
      });
    } catch (socketErr) {
      console.error('Socket notification error:', socketErr.message);
    }

    res.status(200).json({
      success: true,
      message: action === 'accept'
        ? 'Booking successfully accepted'
        : 'Request declined. The booking remains available for other pandits.',
      data: booking,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all accepted bookings for logged-in Pandit
// @route   GET /api/bookings/pandit/my-jobs
// @access  Private (Pandit)
export const getPanditJobs = async (req, res) => {
  try {
    const bookings = await Booking.find({ pandit: req.user._id })
      .populate('client', 'name email phone')
      .populate('puja', 'title priceWithoutSamagri priceWithSamagri');

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};