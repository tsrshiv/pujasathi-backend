import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['client', 'pandit', 'admin'], default: 'client' },
    address: { type: String, trim: true },
    city: { type: String },
    bio: { type: String, trim: true },
    experienceInYears: { type: Number, min: 0 },
    languages: [{ type: String, trim: true }],
    profileImage: { type: String, trim: true },
    isAvailable: { type: Boolean, default: true },
    resetPasswordOTP: String,
    resetPasswordExpire: Date,
    // 1. default: false सेट करें ताकि हर नए पंडित को isApproved फ़ील्ड मिले
    isApproved: { type: Boolean, default: false },

    // 2. GeoJSON Location Format
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },
  },
  { timestamps: true }
);

userSchema.index({ location: '2dsphere' });


userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

export default mongoose.model('User', userSchema);