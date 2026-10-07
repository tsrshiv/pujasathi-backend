import Puja from "../models/puja.model.js";

export const createPuja = async (req, res) => {
  try {
    const { title, description, category, priceWithoutSamagri, priceWithSamagri, durationInHours, samagriList, imageUrl } = req.body;   
    
    const puja = await Puja.create({
      title,
      description,
      category,
      priceWithoutSamagri,
      priceWithSamagri, 
      durationInHours,
      samagriList,
      imageUrl
    });

    res.status(201).json({ success: true, data: Puja });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  } 
};

// @desc    Get all Pujas
// @route   GET /api/pujas
// @access  Public

export const getAllPujas = async (req, res) => {
  try {
    const pujas = await Puja.find();
    res.status(200).json({ success: true, count: pujas.length, data: pujas });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};  

// @desc    Get single Puja by ID
// @route   GET /api/pujas/:id
// @access  Public

export const getPujaById = async (req, res) => {
  try {
    const puja = await Puja.findById(req.params.id);

    if (!puja) {
      return res.status(404).json({ success: false, message: 'Puja not found' });
    }

    res.status(200).json({ success: true, data: puja });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a Puja
// @route   PUT /api/pujas/:id
// @access  Private (Admin only)
export const updatePuja = async (req, res) => {
  try {
    const puja = await Puja.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!puja) {
      return res.status(404).json({ success: false, message: 'Puja not found' });
    }

    res.status(200).json({ success: true, data: puja });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a Puja
// @route   DELETE /api/pujas/:id
// @access  Private (Admin only)
export const deletePuja = async (req, res) => {
  try {
    const puja = await Puja.findByIdAndDelete(req.params.id);

    if (!puja) {
      return res.status(404).json({ success: false, message: 'Puja not found' });
    }

    res.status(200).json({ success: true, message: 'Puja deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};