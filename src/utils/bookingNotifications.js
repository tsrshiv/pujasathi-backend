import sendEmail from './sendEmail.js';
import { getIO } from '../socket.js';
import Booking from '../models/booking.model.js';

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const formatRupees = (amount) => `₹${Number(amount).toLocaleString('en-IN')}`;

const bookingDetails = (booking, puja) => `
  <table style="border-collapse:collapse;width:100%;max-width:600px">
    <tr><td style="padding:8px;border:1px solid #ddd"><strong>Booking ID</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(booking._id)}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd"><strong>Puja</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(puja?.title || 'Puja')}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd"><strong>Date</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(new Date(booking.bookingDate).toLocaleDateString('en-IN'))}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd"><strong>Time slot</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(booking.timeSlot)}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd"><strong>Payment</strong></td><td style="padding:8px;border:1px solid #ddd">${booking.paymentMethod === 'online' ? 'Online payment' : 'Cash on delivery'}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd"><strong>Samagri</strong></td><td style="padding:8px;border:1px solid #ddd">${booking.includeSamagri ? 'Included' : 'Not included'}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd"><strong>Puja price</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(formatRupees(puja?.priceWithoutSamagri ?? booking.totalAmount))}</td></tr>
    ${booking.includeSamagri && Number.isFinite(puja?.priceWithSamagri) && Number.isFinite(puja?.priceWithoutSamagri)
    ? `<tr><td style="padding:8px;border:1px solid #ddd"><strong>Samagri price</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(formatRupees(puja.priceWithSamagri - puja.priceWithoutSamagri))}</td></tr>`
    : ''}
    <tr><td style="padding:8px;border:1px solid #ddd"><strong>Total price</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(formatRupees(booking.totalAmount))}</td></tr>
  </table>`;

export const notifyBookingReady = async (bookingId) => {
  const booking = await Booking.findById(bookingId)
    .populate('client', 'name email phone')
    .populate('puja', 'title category priceWithoutSamagri priceWithSamagri');

  if (!booking) throw new Error(`Cannot notify for missing booking ${bookingId}`);

  try {
    await sendEmail({
      email: booking.client.email,
      subject: `Booking request received: ${booking.puja.title}`,
      html: `
        <h2>Hello ${escapeHtml(booking.client.name)},</h2>
        <p>We have received your puja booking request. It is pending acceptance by an available pandit.</p>
        ${bookingDetails(booking, booking.puja)}
        <h3>Service address</h3>
        <p>${escapeHtml(booking.address.street)}, ${escapeHtml(booking.address.city)} - ${escapeHtml(booking.address.pincode)}</p>
        <p>We will email you again when a pandit accepts the request.</p>
      `,
    });
  } catch (error) {
    console.error('Failed to send booking confirmation to client:', error.message);
  }

  if (process.env.ADMIN_EMAIL) {
    try {
      await sendEmail({
        email: process.env.ADMIN_EMAIL,
        subject: `New Booking Alert: ${booking.puja.title}`,
        html: `
          <h2>New Puja Booking Received</h2>
          ${bookingDetails(booking, booking.puja)}
          <h3>Client</h3>
          <p>${escapeHtml(booking.client.name)} · ${escapeHtml(booking.client.email)} · ${escapeHtml(booking.client.phone)}</p>
          <h3>Service address</h3>
          <p>${escapeHtml(booking.address.street)}, ${escapeHtml(booking.address.city)} - ${escapeHtml(booking.address.pincode)}</p>
        `,
      });
    } catch (error) {
      console.error('Failed to send admin booking email:', error.message);
    }
  }

  try {
    getIO().emit('new_booking_alert', {
      message: 'A new puja booking request is available!',
      bookingId: booking._id,
      city: booking.address.city,
    });
  } catch (error) {
    console.error('Socket notification error:', error.message);
  }
};
