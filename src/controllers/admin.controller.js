import User from '../models/user.model.js';

// @desc    Get all pending unapproved Pandits
// @route   GET /api/admin/pandits/pending
// @access  Private (Admin)
export const getPendingPandits = async (req, res) => {
  try {
    const pandits = await User.find({ 
  role: 'pandit', 
  isApproved: { $ne: true } 
}).select('-password');

    res.status(200).json({
      success: true,
      count: pandits.length,
      data: pandits,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Approve or Reject Pandit
// @route   PUT /api/admin/pandits/:id/approve
// @access  Private (Admin)
export const approvePandit = async (req, res) => {
  try {
    const { isApproved } = req.body; // true or false
    const pandit = await User.findById(req.params.id);

    if (!pandit || pandit.role !== 'pandit') {
      return res.status(404).json({ success: false, message: 'Pandit user not found' });
    }

    pandit.isApproved = isApproved;
    await pandit.save();

    res.status(200).json({
      success: true,
      message: `Pandit status updated to ${isApproved ? 'Approved' : 'Rejected'}`,
      data: {
        _id: pandit._id,
        name: pandit.name,
        email: pandit.email,
        isApproved: pandit.isApproved,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};