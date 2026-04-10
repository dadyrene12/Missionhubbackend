const express = require('express');
const router = express.Router();
const PlatformSettings = require('../models/PlatformSettings');
const Payment = require('../models/Payment');
const GalleryPost = require('../models/GalleryPost');
const { protect, authorize } = require('../middleware/auth');

// Middleware to check company user
const companyOnly = (req, res, next) => {
  if (!req.user || (req.user.userType !== 'company' && req.user.role !== 'company_admin')) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Company account required.'
    });
  }
  next();
};

router.get('/settings', protect, async (req, res) => {
  try {
    const settings = await PlatformSettings.getSettings();
    console.log('Settings endpoint - advertisePayMode:', settings.advertisePayMode);
    res.json({
      success: true,
      settings: {
        advertisePayMode: settings.advertisePayMode,
        provePayMode: settings.provePayMode,
        advertisePrice: settings.advertisePrice,
        provePrice: settings.provePrice,
        currency: settings.currency
      }
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching settings'
    });
  }
});

// Create advertisement - requires company user
router.post('/advertise', protect, companyOnly, async (req, res) => {
  try {
    console.log('Creating advertisement, user:', req.user?._id);
    console.log('User type:', req.user?.userType);

    const settings = await PlatformSettings.getSettings();
    console.log('Settings - advertisePayMode:', settings.advertisePayMode);
    console.log('Settings - advertisePrice:', settings.advertisePrice);
    
    const { title, description, duration, positions } = req.body;

    if (!title || !duration) {
      return res.status(400).json({
        success: false,
        message: 'Title and duration are required'
      });
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (duration * 30));

    const paymentData = {
      companyId: req.user._id,
      amount: (settings.advertisePrice || 0) * (duration || 1),
      currency: settings.currency || 'RWF',
      type: 'advertise',
      status: settings.advertisePayMode ? 'pending' : 'completed',
      gateway: settings.advertisePayMode ? 'manual' : 'free',
      description: `Advertising payment for ${duration} month(s) - ${title}`,
      advertiseDetails: {
        title,
        description,
        duration,
        startDate,
        endDate,
        positions: positions || 1
      }
    };

    console.log('Creating payment:', paymentData);
    const payment = await Payment.create(paymentData);
    console.log('Payment created:', payment._id);

    res.status(201).json({
      success: true,
      message: settings.advertisePayMode ? 'Advertisement created. Please complete payment.' : 'Advertisement created successfully!',
      payment: {
        id: payment._id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        description: payment.description,
        advertiseDetails: payment.advertiseDetails
      },
      pricing: {
        pricePerMonth: settings.advertisePrice,
        currency: settings.currency,
        totalMonths: duration,
        totalAmount: settings.advertisePrice * duration
      }
    });
  } catch (error) {
    console.error('Create advertisement error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating advertisement'
    });
  }
});

router.post('/advertise/:paymentId/pay', protect, companyOnly, async (req, res) => {
  try {
    const { paymentMethod, transactionId, notes } = req.body;
    const payment = await Payment.findOne({
      _id: req.params.paymentId,
      companyId: req.user._id
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Payment has already been processed'
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Payment method is required'
      });
    }

    payment.paymentMethod = paymentMethod;
    payment.transactionId = transactionId || `txn_${Date.now()}`;
    payment.status = 'completed';
    payment.metadata = { ...payment.metadata, notes, paidAt: new Date() };
    await payment.save();

    res.json({
      success: true,
      message: 'Payment completed successfully',
      payment: {
        id: payment._id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        transactionId: payment.transactionId,
        advertiseDetails: payment.advertiseDetails
      }
    });
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing payment'
    });
  }
});

router.post('/prove', protect, companyOnly, async (req, res) => {
  try {
    const settings = await PlatformSettings.getSettings();
    
    const { applicantId, applicationId, notes } = req.body;

    if (!applicantId) {
      return res.status(400).json({
        success: false,
        message: 'Applicant ID is required'
      });
    }

    const paymentData = {
      companyId: req.user._id,
      userId: applicantId,
      amount: settings.provePrice,
      currency: settings.currency,
      type: 'prove',
      status: settings.provePayMode ? 'pending' : 'completed',
      gateway: settings.provePayMode ? 'manual' : 'free',
      description: `Prove payment for applicant approval`,
      proveDetails: {
        applicantId,
        applicationId
      },
      metadata: { notes }
    };

    const payment = await Payment.create(paymentData);

    res.status(201).json({
      success: true,
      message: 'Prove payment created. Please complete payment to approve applicant.',
      payment: {
        id: payment._id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        description: payment.description
      },
      pricing: {
        amount: settings.provePrice,
        currency: settings.currency
      }
    });
  } catch (error) {
    console.error('Create prove payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating prove payment'
    });
  }
});

router.post('/prove/:paymentId/pay', protect, companyOnly, async (req, res) => {
  try {
    const { paymentMethod, transactionId, notes } = req.body;
    const payment = await Payment.findOne({
      _id: req.params.paymentId,
      companyId: req.user._id
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Payment has already been processed'
      });
    }

    payment.paymentMethod = paymentMethod || 'manual';
    payment.transactionId = transactionId || `txn_${Date.now()}`;
    payment.status = 'completed';
    payment.metadata = { ...payment.metadata, notes, paidAt: new Date() };
    await payment.save();

    res.json({
      success: true,
      message: 'Prove payment completed successfully. You can now approve the applicant.',
      payment: {
        id: payment._id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        transactionId: payment.transactionId
      }
    });
  } catch (error) {
    console.error('Process prove payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing payment'
    });
  }
});

router.get('/my-payments', protect, companyOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const filter = { companyId: req.user._id };
    
    if (type) {
      filter.type = type;
    }

    const payments = await Payment.find(filter)
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
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payments'
    });
  }
});

router.get('/my-ads', protect, companyOnly, async (req, res) => {
  try {
    const payments = await Payment.find({
      companyId: req.user._id
    }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      advertisements: payments
    });
  } catch (error) {
    console.error('Get my-ads error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching advertisements'
    });
  }
});

router.get('/my-advertisements', protect, companyOnly, async (req, res) => {
  try {
    console.log('Fetching ads for company:', req.user._id);
    const payments = await Payment.find({
      companyId: req.user._id
    }).sort({ createdAt: -1 });
    console.log('Found payments:', payments.length);
    
    res.json({
      success: true,
      advertisements: payments
    });
  } catch (error) {
    console.error('Get advertisements error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching advertisements'
    });
  }
});

router.get('/check-payment/:type', protect, companyOnly, async (req, res) => {
  try {
    const settings = await PlatformSettings.getSettings();
    const { type } = req.params;

    let hasActivePayment = false;
    let latestPayment = null;

    if (type === 'advertise') {
      latestPayment = await Payment.findOne({
        companyId: req.user._id,
        type: 'advertise',
        status: 'completed',
        'advertiseDetails.endDate': { $gt: new Date() }
      }).sort({ createdAt: -1 });
      hasActivePayment = !!latestPayment;
    }

    res.json({
      success: true,
      payModeEnabled: type === 'advertise' ? settings.advertisePayMode : settings.provePayMode,
      hasActivePayment,
      latestPayment: latestPayment ? {
        id: latestPayment._id,
        amount: latestPayment.amount,
        endDate: latestPayment.advertiseDetails?.endDate
      } : null
    });
  } catch (error) {
    console.error('Check payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking payment status'
    });
  }
});

// Gallery routes for company showcase
router.get('/gallery', protect, companyOnly, async (req, res) => {
  try {
    const posts = await GalleryPost.find({ companyId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, posts });
  } catch (error) {
    console.error('Get gallery error:', error);
    res.status(500).json({ success: false, message: 'Error fetching gallery' });
  }
});

router.post('/gallery', protect, companyOnly, async (req, res) => {
  try {
    const { type, url, caption, tags, campaign } = req.body;
    const post = await GalleryPost.create({
      companyId: req.user._id,
      type: type || 'image',
      url,
      caption,
      tags: tags || [],
      campaign: campaign || 'general'
    });
    res.status(201).json({ success: true, post });
  } catch (error) {
    console.error('Create gallery post error:', error);
    res.status(500).json({ success: false, message: 'Error creating post' });
  }
});

router.delete('/gallery/:id', protect, companyOnly, async (req, res) => {
  try {
    const post = await GalleryPost.findOneAndDelete({ _id: req.params.id, companyId: req.user._id });
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    res.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    console.error('Delete gallery post error:', error);
    res.status(500).json({ success: false, message: 'Error deleting post' });
  }
});

module.exports = router;
