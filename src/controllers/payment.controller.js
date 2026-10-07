import Razorpay from 'razorpay';
import { createHmac, timingSafeEqual } from 'node:crypto';
import Booking from '../models/booking.model.js';
import { notifyBookingReady } from '../utils/bookingNotifications.js';
import { splitBookingAmount } from '../utils/commission.js';

const getRazorpay = () => {
  const { RAZORPAY_KEY_ID: key_id, RAZORPAY_KEY_SECRET: key_secret } = process.env;
  if (!key_id || !key_secret || key_id.startsWith('your_') || key_secret.startsWith('your_')) {
    throw new Error('Razorpay live/test API keys are not configured.');
  }
  return new Razorpay({ key_id, key_secret });
};

const isValidSignature = (orderId, paymentId, signature) => {
  const expected = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest();
  const supplied = Buffer.from(signature, 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
};

export const createOrder = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.body.bookingId,
      client: req.user._id,
    });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    if (booking.paymentMethod !== 'online') {
      return res.status(400).json({ success: false, message: 'This booking is not set to online payment.' });
    }
    if (booking.paymentStatus === 'paid') {
      return res.status(409).json({ success: false, message: 'This booking has already been paid.' });
    }
    if (booking.bookingStatus !== 'pending') {
      return res.status(409).json({ success: false, message: 'This booking is no longer payable.' });
    }

    const { totalPaise } = splitBookingAmount(booking.totalAmount);
    const razorpay = getRazorpay();
    const order = booking.onlinePaymentOrderId
      ? await razorpay.orders.fetch(booking.onlinePaymentOrderId)
      : await razorpay.orders.create({
        amount: totalPaise,
        currency: 'INR',
        receipt: `booking_${booking._id}`,
        notes: { bookingId: booking._id.toString(), clientId: req.user._id.toString() },
      });

    if (order.status === 'paid') {
      return res.status(409).json({
        success: false,
        message: 'Razorpay shows this order as paid. Contact support to reconcile the booking before another payment attempt.',
      });
    }

    if (!booking.onlinePaymentOrderId) {
      booking.onlinePaymentOrderId = order.id;
      await booking.save();
    }

    return res.status(200).json({
      success: true,
      data: {
        order,
        keyId: process.env.RAZORPAY_KEY_ID,
        bookingId: booking._id,
      },
    });
  } catch (error) {
    const statusCode = error.message.includes('not configured') ? 503 : 500;
    return res.status(statusCode).json({ success: false, message: error.message });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
      bookingId,
    } = req.body;

    if (![orderId, paymentId, signature, bookingId].every((value) => typeof value === 'string' && value)) {
      return res.status(400).json({ success: false, message: 'Payment verification details are incomplete.' });
    }

    const booking = await Booking.findOne({ _id: bookingId, client: req.user._id });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    if (booking.paymentStatus === 'paid' && booking.paymentDetails?.razorpayPaymentId === paymentId) {
      return res.status(200).json({ success: true, message: 'Payment has already been verified.' });
    }
    if (booking.paymentMethod !== 'online' || booking.onlinePaymentOrderId !== orderId) {
      return res.status(400).json({ success: false, message: 'Payment order does not belong to this booking.' });
    }
    const razorpay = getRazorpay();
    if (!isValidSignature(orderId, paymentId, signature)) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature.' });
    }

    const [order, fetchedPayment] = await Promise.all([
      razorpay.orders.fetch(orderId),
      razorpay.payments.fetch(paymentId),
    ]);
    const { totalPaise } = splitBookingAmount(booking.totalAmount);
    const payment = fetchedPayment.status === 'authorized'
      ? await razorpay.payments.capture(paymentId, totalPaise, 'INR')
      : fetchedPayment;
    if (payment.order_id !== orderId
      || payment.amount !== totalPaise
      || payment.currency !== 'INR'
      || payment.status !== 'captured'
      || order.amount !== totalPaise
      || order.currency !== 'INR') {
      return res.status(400).json({ success: false, message: 'Razorpay has not confirmed a captured payment for this amount.' });
    }

    const paidBooking = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        client: req.user._id,
        paymentMethod: 'online',
        paymentStatus: { $ne: 'paid' },
        onlinePaymentOrderId: orderId,
      },
      {
        $set: {
          paymentStatus: 'paid',
          paymentDetails: {
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            razorpaySignature: signature,
          },
        },
      },
      { new: true },
    );
    if (!paidBooking) {
      return res.status(409).json({ success: false, message: 'Booking payment state changed; refresh your bookings.' });
    }

    await notifyBookingReady(paidBooking._id);
    return res.status(200).json({
      success: true,
      message: 'Payment verified. Your request is now available to pandits.',
      data: paidBooking,
    });
  } catch (error) {
    const statusCode = error.message.includes('not configured') ? 503 : 500;
    return res.status(statusCode).json({ success: false, message: error.message });
  }
};
