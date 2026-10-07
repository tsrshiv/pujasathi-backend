import User from '../models/user.model.js';
import generateToken from '../utils/generateToken.js';
import sendEmail from '../utils/sendEmail.js';
import { sendSMS } from '../utils/sendSMS.js';
import bcrypt from 'bcryptjs';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import RegistrationOtp from '../models/registrationOtp.model.js';

const hashRegistrationOtp = (email, otp) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET must be configured to verify registration OTPs');
  return createHmac('sha256', secret).update(`${email}:${otp}`).digest('hex');
};

const isValidRegistrationDetails = ({ name, email, phone, password, role, city }) =>
  [name, email, phone, password, role, city].every((value) => typeof value === 'string' && value.trim())
  && ['client', 'pandit'].includes(role)
  && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  && password.length >= 8;

export const sendRegistrationOtp = async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    if (await User.exists({ email })) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const otpRecord = await RegistrationOtp.findOne({ email });
    const now = new Date();
    if (otpRecord && now - otpRecord.lastSentAt < 60_000) {
      return res.status(429).json({ success: false, message: 'Please wait 60 seconds before requesting another code.' });
    }

    const otp = randomInt(100000, 1000000).toString();
    const otpHash = hashRegistrationOtp(email, otp);
    await RegistrationOtp.findOneAndUpdate(
      { email },
      {
        $set: {
          otpHash,
          expiresAt: new Date(now.getTime() + 10 * 60_000),
          lastSentAt: now,
          attempts: 0,
        },
      },
      { upsert: true, new: true, runValidators: true },
    );

    try {
      await sendEmail({
        email,
        subject: 'PujaSathi - Verify your email',
        html: `<h2>Verify your email</h2><p>Your PujaSathi registration code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${otp}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>`,
      });
    } catch (error) {
      await RegistrationOtp.deleteOne({ email, otpHash });
      throw error;
    }

    return res.status(200).json({ success: true, message: 'Verification code sent to your email.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const registerUser = async (req, res) => {
  try {
    const { name, phone, password, role, city, address, location, otp } = req.body;
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (!isValidRegistrationDetails({ name, email, phone, password, role, city })) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid registration details. Password must be at least 8 characters.',
      });
    }
    if (role === 'pandit' && (typeof address !== 'string' || !address.trim())) {
      return res.status(400).json({ success: false, message: 'Please provide your address as a pandit.' });
    }
    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, message: 'Enter the 6-digit email verification code.' });
    }

    if (await User.exists({ $or: [{ email }, { phone: phone.trim() }] })) {
      return res.status(409).json({ success: false, message: 'An account with this email or phone already exists.' });
    }

    const otpRecord = await RegistrationOtp.findOne({ email, expiresAt: { $gt: new Date() } });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Verification code is invalid or expired. Request a new code.' });
    }
    if (otpRecord.attempts >= 5) {
      await RegistrationOtp.deleteOne({ _id: otpRecord._id });
      return res.status(429).json({ success: false, message: 'Too many incorrect attempts. Request a new code.' });
    }

    const suppliedHash = Buffer.from(hashRegistrationOtp(email, otp), 'hex');
    const savedHash = Buffer.from(otpRecord.otpHash, 'hex');
    if (suppliedHash.length !== savedHash.length || !timingSafeEqual(suppliedHash, savedHash)) {
      await RegistrationOtp.updateOne({ _id: otpRecord._id }, { $inc: { attempts: 1 } });
      return res.status(400).json({ success: false, message: 'Incorrect verification code.' });
    }

    const consumedOtp = await RegistrationOtp.findOneAndDelete({
      _id: otpRecord._id,
      otpHash: otpRecord.otpHash,
      expiresAt: { $gt: new Date() },
    });
    if (!consumedOtp) {
      return res.status(400).json({ success: false, message: 'Verification code is invalid or expired. Request a new code.' });
    }

    const user = await User.create({
      name: name.trim(),
      email,
      phone: phone.trim(),
      password,
      role,
      address: typeof address === 'string' ? address.trim() : undefined,
      city: city.trim(),
      location: location || { type: 'Point', coordinates: [0, 0] },
      isApproved: role === 'pandit' ? false : true,
    });

    return res.status(201).json({
      success: true,
      message: role === 'pandit'
        ? 'Pandit registered successfully. Waiting for admin approval.'
        : 'User registered successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        address: user.address,
        city: user.city,
        isApproved: user.isApproved,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'An account with this email or phone already exists.' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.isPasswordCorrect(password))) {
      res.status(200).json({
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          token: generateToken(user._id),
        },
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Send OTP via Email/SMS for Password Reset
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email, phone } = req.body;

    const user = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // 6 Digit Random OTP जनरेट करें
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // OTP को 10 मिनट के लिए वैलिड रखें
    user.resetPasswordOTP = otp;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    const message = `PujaSathi Password Reset OTP is: ${otp}. Valid for 10 minutes.`;

    // Email या SMS से OTP भेजें
    if (email) {
      await sendEmail({
        email: user.email,
        subject: 'PujaSathi - Password Reset OTP',
        html: `<h3>Your Password Reset OTP: <b>${otp}</b></h3>`,
      });
    }

    if (phone) {
      await sendSMS(user.phone, message);
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully to your Email/Phone',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify OTP and Reset Password
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({
      email,
      resetPasswordOTP: otp,
      resetPasswordExpire: { $gt: Date.now() }, // OTP एक्सपायर तो नहीं हुआ
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or Expired OTP' });
    }

    // नया पासवर्ड हैश करके सेव करें
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    user.resetPasswordOTP = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful! You can now login.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};