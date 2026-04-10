const express = require('express');
const router = express.Router();
const { protect, authorize, authorizePermission } = require('../middleware/auth');

// Get all payments (admin only)
router.get('/', protect, authorizePermission('view_payments'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, companyId, dateFrom, dateTo } = req.query;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (companyId) filter.companyId = companyId;
    if (dateFrom || dateTo) {
      filter.paymentDate = {};
      if (dateFrom) filter.paymentDate.$gte = new Date(dateFrom);
      if (dateTo) filter.paymentDate.$lte = new Date(dateTo);
    }

    // Mock payments data - in production, this would come from database
    const payments = [
      {
        id: 1,
        companyId: 'company123',
        amount: 29.00,
        currency: 'USD',
        paymentMethod: 'credit_card',
        status: 'completed',
        paymentDate: new Date('2024-01-15'),
        subscriptionPlan: 'basic',
        description: 'Basic subscription - monthly',
        transactionId: 'txn_1234567890',
        invoiceId: 'inv_1234567890'
      },
      {
        id: 2,
        companyId: 'company456',
        amount: 99.00,
        currency: 'USD',
        paymentMethod: 'paypal',
        status: 'completed',
        paymentDate: new Date('2024-01-14'),
        subscriptionPlan: 'premium',
        description: 'Premium subscription - monthly',
        transactionId: 'txn_2345678901',
        invoiceId: 'inv_2345678901'
      },
      {
        id: 3,
        companyId: 'company789',
        amount: 299.00,
        currency: 'USD',
        paymentMethod: 'bank_transfer',
        status: 'pending',
        paymentDate: new Date('2024-01-16'),
        subscriptionPlan: 'enterprise',
        description: 'Enterprise subscription - monthly',
        transactionId: 'txn_3456789012',
        invoiceId: 'inv_3456789012'
      }
    ];

    // Apply filters
    let filteredPayments = payments;
    if (status) {
      filteredPayments = filteredPayments.filter(payment => payment.status === status);
    }
    if (companyId) {
      filteredPayments = filteredPayments.filter(payment => payment.companyId === companyId);
    }

    // Paginate
    const startIndex = (page - 1) * limit;
    const paginatedPayments = filteredPayments.slice(startIndex, startIndex + limit);

    res.json({
      success: true,
      payments: paginatedPayments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredPayments.length,
        pages: Math.ceil(filteredPayments.length / limit)
      }
    });

  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payments'
    });
  }
});

// Get company payments
router.get('/company/:companyId', protect, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    // Check authorization
    if (req.user._id.toString() !== companyId && req.user.userType !== 'admin' && req.user.userType !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access these payments'
      });
    }

    // Mock company payments
    const payments = [
      {
        id: 1,
        companyId: companyId,
        amount: 99.00,
        currency: 'USD',
        paymentMethod: 'credit_card',
        status: 'completed',
        paymentDate: new Date('2024-01-15'),
        subscriptionPlan: 'premium',
        description: 'Premium subscription - monthly',
        transactionId: 'txn_1234567890',
        invoiceId: 'inv_1234567890',
        nextBillingDate: new Date('2024-02-15')
      },
      {
        id: 2,
        companyId: companyId,
        amount: 99.00,
        currency: 'USD',
        paymentMethod: 'credit_card',
        status: 'completed',
        paymentDate: new Date('2023-12-15'),
        subscriptionPlan: 'premium',
        description: 'Premium subscription - monthly',
        transactionId: 'txn_0987654321',
        invoiceId: 'inv_0987654321'
      }
    ];

    // Filter by status if specified
    const filteredPayments = status 
      ? payments.filter(payment => payment.status === status)
      : payments;

    // Paginate
    const startIndex = (page - 1) * limit;
    const paginatedPayments = filteredPayments.slice(startIndex, startIndex + limit);

    res.json({
      success: true,
      payments: paginatedPayments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredPayments.length,
        pages: Math.ceil(filteredPayments.length / limit)
      }
    });

  } catch (error) {
    console.error('Get company payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching company payments'
    });
  }
});

// Create payment
router.post('/', protect, authorize('company'), async (req, res) => {
  try {
    const {
      amount,
      currency = 'USD',
      paymentMethod,
      subscriptionPlan,
      description
    } = req.body;

    if (!amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Amount and payment method are required'
      });
    }

    // Create payment record
    const payment = {
      id: Date.now(),
      companyId: req.user._id,
      amount: parseFloat(amount),
      currency,
      paymentMethod,
      status: 'pending',
      paymentDate: new Date(),
      subscriptionPlan,
      description: description || `${subscriptionPlan} subscription`,
      transactionId: `txn_${Date.now()}`,
      invoiceId: `inv_${Date.now()}`
    };

    // In production, this would integrate with payment gateway
    // For now, we'll simulate successful payment
    payment.status = 'completed';

    res.json({
      success: true,
      payment,
      message: 'Payment processed successfully'
    });

  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing payment'
    });
  }
});

// Initiate Mobile Money Payment
router.post('/initiate', protect, authorize('company'), async (req, res) => {
  try {
    const { type, amount, currency = 'RWF', method, phone, description } = req.body;

    if (!amount || !method) {
      return res.status(400).json({
        success: false,
        message: 'Amount and payment method are required'
      });
    }

    // In production, this would integrate with MTN MoMo or Airtel API
    // For now, we'll create a pending payment record
    const payment = {
      _id: `pay_${Date.now()}`,
      companyId: req.user._id,
      userId: req.user._id,
      amount: parseFloat(amount),
      currency,
      type: type || 'subscription',
      gateway: method,
      status: 'pending',
      createdAt: new Date(),
      description: description || `${type} payment`,
      phone: phone
    };

    // Simulate payment initiation success
    console.log(`Payment initiated: ${method} - ${amount} ${currency} to ${phone}`);

    res.json({
      success: true,
      message: 'Payment initiated. Please check your phone for the payment prompt.',
      payment: {
        id: payment._id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        reference: payment._id
      },
      instructions: `A ${method === 'mtn' ? 'MTN MoMo' : 'Airtel Money'} payment request has been sent to ${phone}. Please approve the payment on your phone.`
    });

  } catch (error) {
    console.error('Initiate payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate payment'
    });
  }
});

// Get company payments (simplified for frontend)
router.get('/company-payments', protect, async (req, res) => {
  try {
    const Payment = require('../models/Payment');
    
    const payments = await Payment.find({ companyId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      payments
    });
  } catch (error) {
    console.error('Get company payments error:', error);
    res.json({
      success: true,
      payments: []
    });
  }
});

// Update payment status
router.put('/:paymentId/status', protect, authorizePermission('manage_payments'), async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    // In production, this would update database
    console.log(`Payment ${paymentId} status updated to ${status} by admin ${req.user._id}`);
    if (notes) console.log(`Notes: ${notes}`);

    res.json({
      success: true,
      message: 'Payment status updated successfully'
    });

  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating payment status'
    });
  }
});

// Get payment statistics
router.get('/stats', protect, authorizePermission('view_analytics'), async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;

    // Mock statistics
    const stats = {
      totalRevenue: 15420.00,
      totalPayments: 156,
      completedPayments: 142,
      pendingPayments: 8,
      failedPayments: 6,
      averagePaymentAmount: 108.61,
      timeRange,
      breakdown: {
        byStatus: [
          { status: 'completed', count: 142, amount: 14120.00, percentage: 91.5 },
          { status: 'pending', count: 8, amount: 800.00, percentage: 5.1 },
          { status: 'failed', count: 6, amount: 500.00, percentage: 3.8 }
        ],
        byPlan: [
          { plan: 'basic', count: 85, amount: 2465.00, percentage: 16.0 },
          { plan: 'premium', count: 58, amount: 5742.00, percentage: 37.2 },
          { plan: 'enterprise', count: 13, amount: 7213.00, percentage: 46.8 }
        ],
        byMethod: [
          { method: 'credit_card', count: 98, amount: 9820.00, percentage: 63.7 },
          { method: 'paypal', count: 45, amount: 4455.00, percentage: 28.9 },
          { method: 'bank_transfer', count: 13, amount: 1145.00, percentage: 7.4 }
        ],
        daily: [
          { date: '2024-01-01', revenue: 485.00, payments: 5 },
          { date: '2024-01-02', revenue: 620.00, payments: 7 },
          { date: '2024-01-03', revenue: 380.00, payments: 4 },
          { date: '2024-01-04', revenue: 750.00, payments: 8 },
          { date: '2024-01-05', revenue: 520.00, payments: 6 },
          { date: '2024-01-06', revenue: 890.00, payments: 9 },
          { date: '2024-01-07', revenue: 425.00, payments: 5 }
        ]
      }
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Get payment stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payment statistics'
    });
  }
});

// Get payment methods
router.get('/methods', (req, res) => {
  try {
    const methods = [
      { id: 'credit_card', name: 'Credit Card', description: 'Pay with Visa, Mastercard, etc.' },
      { id: 'debit_card', name: 'Debit Card', description: 'Pay with your debit card' },
      { id: 'paypal', name: 'PayPal', description: 'Pay with PayPal account' },
      { id: 'bank_transfer', name: 'Bank Transfer', description: 'Direct bank transfer' },
      { id: 'crypto', name: 'Cryptocurrency', description: 'Pay with Bitcoin, Ethereum, etc.' }
    ];

    res.json({
      success: true,
      methods
    });

  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payment methods'
    });
  }
});

// Refund payment
router.post('/:paymentId/refund', protect, authorizePermission('manage_payments'), async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount, reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Refund reason is required'
      });
    }

    // In production, this would process refund through payment gateway
    const refund = {
      id: Date.now(),
      paymentId,
      amount: amount || 'full',
      reason,
      status: 'processed',
      processedAt: new Date(),
      processedBy: req.user._id
    };

    console.log(`Refund processed for payment ${paymentId}:`, refund);

    res.json({
      success: true,
      refund,
      message: 'Refund processed successfully'
    });

  } catch (error) {
    console.error('Refund payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing refund'
    });
  }
});

// Get payment details
router.get('/:paymentId', protect, async (req, res) => {
  try {
    const { paymentId } = req.params;

    // Mock payment details
    const payment = {
      id: paymentId,
      companyId: 'company123',
      amount: 99.00,
      currency: 'USD',
      paymentMethod: 'credit_card',
      status: 'completed',
      paymentDate: new Date('2024-01-15'),
      subscriptionPlan: 'premium',
      description: 'Premium subscription - monthly',
      transactionId: 'txn_1234567890',
      invoiceId: 'inv_1234567890',
      billingAddress: {
        line1: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        country: 'US'
      },
      cardDetails: {
        last4: '4242',
        brand: 'visa',
        expiry: '12/25'
      },
      refunds: [],
      metadata: {
        source: 'web',
        ip: '192.168.1.1'
      }
    };

    // Check authorization
    if (req.user._id.toString() !== payment.companyId && req.user.userType !== 'admin' && req.user.userType !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this payment'
      });
    }

    res.json({
      success: true,
      payment
    });

  } catch (error) {
    console.error('Get payment details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payment details'
    });
  }
});

module.exports = router;
