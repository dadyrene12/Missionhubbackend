const express = require('express');
const router = express.Router();

// Import auth middleware
const { protect } = require('../middleware/auth');

// Apply protect middleware to all routes
router.use(protect);

// Get all talent pool candidates
router.get('/', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const TalentPool = mongoose.models.TalentPool;
    
    if (!TalentPool) {
      return res.json({
        success: true,
        message: 'Talent pool candidates retrieved',
        data: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0 }
      });
    }

    const { status, page = 1, limit = 20 } = req.query;
    const filter = { companyId: req.user.id || req.user._id };
    if (status) filter.status = status;

    const candidates = await TalentPool.find(filter)
      .populate('candidateId', 'name email profile')
      .populate('jobId', 'title')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await TalentPool.countDocuments(filter);

    res.json({
      success: true,
      message: 'Talent pool candidates retrieved successfully',
      data: candidates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get talent pool error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve talent pool candidates',
      error: error.message
    });
  }
});

// Add candidate to talent pool
router.post('/', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const TalentPool = mongoose.models.TalentPool;
    const User = require('../models/User');
    
    if (!TalentPool) {
      return res.status(500).json({
        success: false,
        message: 'TalentPool model not available'
      });
    }

    const { userId, jobId, source, notes, rating, tags } = req.body;

    const candidateUser = await User.findById(userId);
    if (!candidateUser) {
      return res.status(404).json({
        success: false,
        message: 'Candidate user not found'
      });
    }

    const existingCandidate = await TalentPool.findOne({ 
      companyId: req.user.id || req.user._id, 
      candidateId: userId 
    });
    if (existingCandidate) {
      return res.status(400).json({
        success: false,
        message: 'Candidate already in talent pool'
      });
    }

    const candidate = new TalentPool({
      companyId: req.user.id || req.user._id,
      candidateId: userId,
      jobId: jobId || null,
      source: source || 'application',
      notes,
      rating,
      tags: tags || []
    });

    await candidate.save();

    const populatedCandidate = await TalentPool.findById(candidate._id)
      .populate('candidateId', 'name email profile')
      .populate('jobId', 'title');

    res.status(201).json({
      success: true,
      message: 'Candidate added to talent pool successfully',
      data: populatedCandidate
    });
  } catch (error) {
    console.error('Add to talent pool error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add candidate to talent pool',
      error: error.message
    });
  }
});

// Update talent pool candidate
router.put('/:id', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const TalentPool = mongoose.models.TalentPool;
    
    if (!TalentPool) {
      return res.status(500).json({
        success: false,
        message: 'TalentPool model not available'
      });
    }

    const { status, notes, rating, tags, lastContacted, nextFollowUp } = req.body;

    const candidate = await TalentPool.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.id || req.user._id },
      { status, notes, rating, tags, lastContacted, nextFollowUp },
      { new: true }
    ).populate('candidateId', 'name email profile');

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    res.json({
      success: true,
      message: 'Candidate updated successfully',
      data: candidate
    });
  } catch (error) {
    console.error('Update talent pool candidate error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update candidate',
      error: error.message
    });
  }
});

// Delete talent pool candidate
router.delete('/:id', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const TalentPool = mongoose.models.TalentPool;
    
    if (!TalentPool) {
      return res.status(500).json({
        success: false,
        message: 'TalentPool model not available'
      });
    }

    const candidate = await TalentPool.findOneAndDelete({ 
      _id: req.params.id,
      companyId: req.user.id || req.user._id 
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    res.json({
      success: true,
      message: 'Candidate deleted successfully'
    });
  } catch (error) {
    console.error('Delete talent pool candidate error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete candidate',
      error: error.message
    });
  }
});

module.exports = router;
