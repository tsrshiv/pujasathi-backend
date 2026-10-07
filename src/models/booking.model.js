import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    pandit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectedPandits: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    puja: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Puja',
      required: true,
    },
    bookingDate: { type: Date, required: true },
    timeSlot: { type: String, required: true },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      pincode: { type: String, required: true },
      // Client Location Coordinates [longitude, latitude]
      coordinates: {
        type: [Number],
      },
    },
    includeSamagri: { type: Boolean, default: false },
    totalAmount: { type: Number, required: true },
    bookingStatus: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'completed', 'cancelled'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['cod', 'online'],
      default: 'cod',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'cod_pending', 'cod_paid'],
      default: 'pending',
    },
    onlinePaymentOrderId: String,
    paymentDetails: {
      razorpayOrderId: String,
      razorpayPaymentId: String,
      razorpaySignature: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Booking', bookingSchema);