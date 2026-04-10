const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  options: [{
    type: String
  }],
  correctAnswer: {
    type: Number,
    default: 0
  }
}, { _id: true });

const examSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  duration: {
    type: Number, // minutes
    default: 60
  },
  totalQuestions: {
    type: Number,
    default: 50
  },
  passingScore: {
    type: Number,
    default: 60
  },
  jobId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Job'
  },
  companyId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['mcq', 'coding', 'both'],
    default: 'mcq'
  },
  assignedCandidates: [{
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'closed'],
    default: 'draft'
  },
  questions: [questionSchema],
  applicants: [{
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }],
  results: [{
    userId: { type: mongoose.Schema.ObjectId, ref: 'User' },
    score: Number,
    timeTaken: Number,
    answers: [{
      questionId: mongoose.Schema.ObjectId,
      selectedAnswer: Number,
      isCorrect: Boolean
    }],
    submittedAt: Date
  }]
}, { timestamps: true });

module.exports = mongoose.models.Exam || mongoose.model('Exam', examSchema);

