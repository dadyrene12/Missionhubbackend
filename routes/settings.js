const express = require('express');
const router = express.Router();
const PlatformSettings = require('../models/PlatformSettings');
const Payment = require('../models/Payment');
const { protect, authorize, superAdminProtect } = require('../middleware/auth');

router.get('/platform', protect, superAdminProtect, async (req, res) => {
  try {
    const settings = await PlatformSettings.getSettings();
    res.json({
      success: true,
      settings: {
        advertisePayMode: settings.advertisePayMode,
        provePayMode: settings.provePayMode,
        advertisePrice: settings.advertisePrice,
        provePrice: settings.provePrice,
        currency: settings.currency,
        emailVerificationRequired: settings.emailVerificationRequired
      }
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching platform settings'
    });
  }
});

router.put('/platform', protect, superAdminProtect, async (req, res) => {
  try {
    const { advertisePayMode, provePayMode, advertisePrice, provePrice, currency, emailVerificationRequired } = req.body;
    console.log('Updating settings:', { advertisePayMode, provePayMode, advertisePrice, provePrice, currency, emailVerificationRequired });
    
    const settings = await PlatformSettings.updateSettings({
      advertisePayMode,
      provePayMode,
      advertisePrice,
      provePrice,
      currency,
      emailVerificationRequired
    }, req.user._id);

    console.log('Settings updated - new advertisePayMode:', settings.advertisePayMode);

    res.json({
      success: true,
      message: 'Platform settings updated successfully',
      settings: {
        advertisePayMode: settings.advertisePayMode,
        provePayMode: settings.provePayMode,
        advertisePrice: settings.advertisePrice,
        provePrice: settings.provePrice,
        currency: settings.currency,
        emailVerificationRequired: settings.emailVerificationRequired
      }
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating platform settings'
    });
  }
});

router.get('/advertising-payments', protect, superAdminProtect, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = { type: { $in: ['advertise', 'advertisement'] } };
    
    if (status) {
      filter.status = status;
    }

    const payments = await Payment.find(filter)
      .populate('companyId', 'name email profile.companyName', null, { strictPopulate: false })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Payment.countDocuments(filter);

    const stats = {
      total: await Payment.countDocuments({ type: { $in: ['advertise', 'advertisement'] } }),
      completed: await Payment.countDocuments({ type: { $in: ['advertise', 'advertisement'] }, status: 'completed' }),
      pending: await Payment.countDocuments({ type: { $in: ['advertise', 'advertisement'] }, status: 'pending' }),
      totalRevenue: await Payment.aggregate([
        { $match: { type: { $in: ['advertise', 'advertisement'] }, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    };

    res.json({
      success: true,
      payments,
      stats: {
        total: stats.total,
        completed: stats.completed,
        pending: stats.pending,
        totalRevenue: stats.totalRevenue[0]?.total || 0
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get advertising payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching advertising payments'
    });
  }
});

router.get('/prove-payments', protect, superAdminProtect, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = { type: 'prove' };
    
    if (status) {
      filter.status = status;
    }

    const payments = await Payment.find(filter)
      .populate('companyId', 'name email profile.companyName', null, { strictPopulate: false })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Payment.countDocuments(filter);

    res.json({
      success: true,
      payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get prove payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching prove payments'
    });
  }
});

router.put('/payments/:paymentId/approve', protect, superAdminProtect, async (req, res) => {
  try {
    const payment = await Payment.findByIdAndUpdate(
      req.params.paymentId,
      { status: 'completed' },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.json({
      success: true,
      message: 'Payment approved successfully',
      payment
    });
  } catch (error) {
    console.error('Approve payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving payment'
    });
  }
});

router.put('/payments/:paymentId/reject', protect, superAdminProtect, async (req, res) => {
  try {
    const payment = await Payment.findByIdAndUpdate(
      req.params.paymentId,
      { status: 'rejected' },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.json({
      success: true,
      message: 'Payment rejected',
      payment
    });
  } catch (error) {
    console.error('Reject payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting payment'
    });
  }
});

// Generic update payment status
router.put('/payments/:paymentId', protect, superAdminProtect, async (req, res) => {
  try {
    const { status } = req.body;
    const payment = await Payment.findByIdAndUpdate(
      req.params.paymentId,
      { status },
      { new: true }
    ).populate('companyId', 'name email profile');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.json({
      success: true,
      message: `Payment ${status} successfully`,
      payment
    });
  } catch (error) {
    console.error('Update payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating payment'
    });
  }
});

module.exports = router;
