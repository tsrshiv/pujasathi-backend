import mongoose from 'mongoose';

const registrationOtpSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
  lastSentAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
});

export default mongoose.model('RegistrationOtp', registrationOtpSchema);
