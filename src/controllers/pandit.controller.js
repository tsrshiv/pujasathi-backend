import User from '../models/user.model.js';

// @desc    Get nearby available pandits by Lat/Lng OR City
// @route   GET /api/pandits/nearby
// @access  Public / Private
export const getNearbyPandits = async (req, res) => {
  try {
    const { longitude, latitude, city, distanceInKm = 10 } = req.query;

    let query = {
      role: 'pandit',
      isAvailable: true,
      isApproved: true, 
    };

    // Option 1: GPS Radius Based Search (Uber Style)
    if (longitude && latitude) {
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: parseFloat(distanceInKm) * 1000, // Distance in Meters
        },
      };
    } 
    // Option 2: Fallback City Name Search
    else if (city) {
      query.city = { $regex: new RegExp(city, 'i') }; // Case-insensitive match
    }

    const pandits = await User.find(query).select('-password');

    res.status(200).json({
      success: true,
      count: pandits.length,
      data: pandits,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle Pandit Online/Offline Availability
// @route   PUT /api/pandits/toggle-status
// @access  Private (Pandit only)
export const togglePanditStatus = async (req, res) => {
  try {
    const pandit = await User.findById(req.user._id);

    if (pandit.role !== 'pandit') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    pandit.isAvailable = !pandit.isAvailable;
    await pandit.save();

    res.status(200).json({
      success: true,
      message: `Pandit status changed to ${pandit.isAvailable ? 'Online' : 'Offline'}`,
      isAvailable: pandit.isAvailable,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};