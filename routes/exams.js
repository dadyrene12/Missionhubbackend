const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Import models
const Exam = mongoose.models.Exam || require('../models/Exam');
const Job = require('../models/Job');
const User = require('../models/User');

// Middleware to check authentication
const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-missionhub-admin');
    req.user = await User.findById(decoded.id);
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }
};

// Company only middleware
const companyOnly = (req, res, next) => {
  if (req.user.userType !== 'company') {
    return res.status(403).json({ success: false, message: 'Company accounts only' });
  }
  next();
};

// Get all exams for company
router.get('/company', protect, companyOnly, async (req, res) => {
  try {
    const exams = await Exam.find({ createdBy: req.user.id })
      .populate('jobId', 'title company')
      .sort({ createdAt: -1 })
      .lean();
    
    res.json({ success: true, exams });
  } catch (error) {
    console.error('Get exams error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create exam (alternate route)
router.post('/create', protect, companyOnly, async (req, res) => {
  try {
    const { title, description, duration, totalQuestions, jobId, questions, passingScore, status, type } = req.body;
    
    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    
    const exam = await Exam.create({
      title,
      description,
      duration: duration || 60,
      totalQuestions: totalQuestions || questions?.length || 0,
      jobId,
      companyId: req.user.id,
      createdBy: req.user.id,
      questions: questions || [],
      passingScore: passingScore || 70,
      status: status || 'draft',
      type: type || 'mcq'
    });
    
    res.status(201).json({ success: true, data: exam });
  } catch (error) {
    console.error('Create exam error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Assign exam to candidate
router.post('/assign', protect, companyOnly, async (req, res) => {
  try {
    const { examId, candidateId } = req.body;
    
    if (!examId || !candidateId) {
      return res.status(400).json({ success: false, message: 'Exam ID and Candidate ID are required' });
    }
    
    const exam = await Exam.findOne({ _id: examId, companyId: req.user.id });
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }
    
    if (!exam.assignedCandidates) {
      exam.assignedCandidates = [];
    }
    
    if (!exam.assignedCandidates.includes(candidateId)) {
      exam.assignedCandidates.push(candidateId);
      await exam.save();
    }
    
    res.json({ success: true, message: 'Exam assigned to candidate' });
  } catch (error) {
    console.error('Assign exam error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all exam results for company
router.get('/results', protect, companyOnly, async (req, res) => {
  try {
    const exams = await Exam.find({ companyId: req.user.id })
      .populate('jobId', 'title company')
      .lean();
    
    const allResults = [];
    exams.forEach(exam => {
      if (exam.results && exam.results.length > 0) {
        exam.results.forEach(result => {
          allResults.push({
            ...result,
            examTitle: exam.title,
            examId: exam._id,
            jobId: exam.jobId
          });
        });
      }
    });
    
    res.json({ success: true, results: allResults });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all exams
router.get('/', protect, async (req, res) => {
  try {
    const { jobId, status } = req.query;
    const filter = {};
    
    if (jobId) filter.jobId = jobId;
    if (status) filter.status = status;
    
    const exams = await Exam.find(filter)
      .populate('jobId', 'title company')
      .populate('companyId', 'name email', null, { strictPopulate: false })
      .sort({ createdAt: -1 })
      .lean();
    
    res.json({ success: true, data: exams });
  } catch (error) {
    console.error('Get exams error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get exam by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate('jobId', 'title company description')
      .populate('companyId', 'name email', null, { strictPopulate: false });
    
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }
    
    res.json({ success: true, data: exam });
  } catch (error) {
    console.error('Get exam error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create exam
router.post('/', protect, companyOnly, async (req, res) => {
  try {
    const { title, description, duration, totalQuestions, jobId, questions, passingScore, status } = req.body;
    
    if (!title || !jobId) {
      return res.status(400).json({ success: false, message: 'Title and job are required' });
    }
    
    // Verify job belongs to company
    const job = await Job.findOne({ _id: jobId, postedBy: req.user.id });
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }
    
    const exam = await Exam.create({
      title,
      description,
      duration: duration || 60,
      totalQuestions: totalQuestions || questions?.length || 0,
      jobId,
      companyId: req.user.id,
      createdBy: req.user.id,
      questions: questions || [],
      passingScore: passingScore || 70,
      status: status || 'draft'
    });
    
    res.status(201).json({ success: true, data: exam });
  } catch (error) {
    console.error('Create exam error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update exam
router.put('/:id', protect, companyOnly, async (req, res) => {
  try {
    const exam = await Exam.findOne({ _id: req.params.id, companyId: req.user.id });
    
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }
    
    const { title, description, duration, totalQuestions, questions, passingScore, status } = req.body;
    
    if (title) exam.title = title;
    if (description) exam.description = description;
    if (duration) exam.duration = duration;
    if (totalQuestions) exam.totalQuestions = totalQuestions;
    if (questions) exam.questions = questions;
    if (passingScore) exam.passingScore = passingScore;
    if (status) exam.status = status;
    
    await exam.save();
    
    res.json({ success: true, data: exam });
  } catch (error) {
    console.error('Update exam error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete exam
router.delete('/:id', protect, companyOnly, async (req, res) => {
  try {
    const exam = await Exam.findOneAndDelete({ _id: req.params.id, companyId: req.user.id });
    
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }
    
    res.json({ success: true, message: 'Exam deleted' });
  } catch (error) {
    console.error('Delete exam error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Submit exam answers
router.post('/:id/submit', protect, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }
    
    const { answers } = req.body;
    
    // Auto-grade the exam
    let correctAnswers = 0;
    const totalQuestions = exam.questions.length;
    
    exam.questions.forEach((question, index) => {
      if (answers[index] === question.correctAnswer) {
        correctAnswers++;
      }
    });
    
    const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    const passed = score >= exam.passingScore;
    
    // Save results
    exam.results.push({
      userId: req.user.id,
      score,
      timeTaken: req.body.timeTaken || 0,
      answers
    });
    
    exam.status = 'completed';
    await exam.save();
    
    res.json({ 
      success: true, 
      data: { 
        score, 
        passed,
        correctAnswers,
        totalQuestions
      }
    });
  } catch (error) {
    console.error('Submit exam error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get exam results
router.get('/:id/results', protect, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate('results.userId', 'name email');
    
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }
    
    res.json({ success: true, data: exam.results });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Publish exam (make it available to applicants)
router.post('/:id/publish', protect, companyOnly, async (req, res) => {
  try {
    const exam = await Exam.findOne({ _id: req.params.id, companyId: req.user.id });
    
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }
    
    exam.status = 'published';
    await exam.save();
    
    res.json({ success: true, message: 'Exam published successfully' });
  } catch (error) {
    console.error('Publish exam error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;