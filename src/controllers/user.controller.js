import User from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
// @desc    Get current logged in user profile
// @route   GET /api/users/profile
// @access  Private
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update User Profile details
// @route   PUT /api/users/profile
// @access  Private
export const updateUserProfile = async (req, res) => {
  try {
    const { name, phone, address, city, bio, experienceInYears, languages } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update basic fields
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (typeof address === 'string') user.address = address.trim();
    if (city) user.city = city;

    // Additional fields if user is a Pandit
    if (user.role === 'pandit') {
      if (bio) user.bio = bio;
      if (experienceInYears) user.experienceInYears = experienceInYears;
      if (languages) user.languages = languages;
    }

    const updatedUser = await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Pandit Live GPS Location
// @route   PUT /api/users/location
// @access  Private (Pandit)
export const updatePanditLocation = async (req, res) => {
  try {
    const { longitude, latitude } = req.body;

    if (longitude === undefined || latitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both longitude and latitude',
      });
    }

    const pandit = await User.findById(req.user._id);

    if (pandit.role !== 'pandit') {
      return res.status(403).json({ success: false, message: 'Only pandits can update live location' });
    }

    pandit.location = {
      type: 'Point',
      coordinates: [parseFloat(longitude), parseFloat(latitude)],
    };

    await pandit.save();

    res.status(200).json({
      success: true,
      message: 'Location updated successfully',
      data: pandit.location,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Upload User Profile Image
// @route   PUT /api/users/upload-avatar
// @access  Private
export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an image file' });
    }

    const imageUrl = await uploadOnCloudinary(req.file.path);

    if (!imageUrl) {
      return res.status(500).json({ success: false, message: 'Error uploading image to cloud' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profileImage: imageUrl },
      { new: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'Profile image updated successfully',
      data: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
