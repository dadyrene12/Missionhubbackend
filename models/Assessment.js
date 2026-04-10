const mongoose = require('mongoose');

const assessmentSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  candidateId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  jobId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Job',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['technical_test', 'coding_challenge', 'personality_test', 'situational_judgment', 'language_proficiency', 'skills_assessment']
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  description: {
    type: String,
    required: true,
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  instructions: {
    type: String,
    maxlength: [2000, 'Instructions cannot be more than 2000 characters']
  },
  questions: [{
    question: {
      type: String,
      required: true
    },
    type: {
      type: String,
      required: true,
      enum: ['multiple_choice', 'true_false', 'short_answer', 'essay', 'coding']
    },
    options: [String], // For multiple choice questions
    correctAnswer: mongoose.Schema.Types.Mixed, // For objective questions
    points: {
      type: Number,
      default: 1,
      min: 1
    },
    required: {
      type: Boolean,
      default: true
    },
    order: {
      type: Number,
      default: 0
    }
  }],
  timeLimit: {
    type: Number,
    required: true,
    min: 5, // Minimum 5 minutes
    max: 480 // Maximum 8 hours
  },
  passingScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 70
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'expired', 'cancelled'],
    default: 'pending'
  },
  answers: [{
    questionIndex: Number,
    answer: mongoose.Schema.Types.Mixed,
    timeSpent: Number // Time spent on this question in seconds
  }],
  score: {
    type: Number,
    min: 0,
    max: 100
  },
  passed: {
    type: Boolean
  },
  timeSpent: {
    type: Number, // Total time spent in seconds
    default: 0
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  expiresAt: {
    type: Date,
    required: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  maxAttempts: {
    type: Number,
    default: 3
  },
  feedback: {
    type: String,
    maxlength: [1000, 'Feedback cannot be more than 1000 characters']
  },
  reviewerNotes: {
    type: String,
    maxlength: [2000, 'Reviewer notes cannot be more than 2000 characters']
  },
  tags: [String],
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  metadata: {
    randomizeQuestions: {
      type: Boolean,
      default: false
    },
    showResults: {
      type: Boolean,
      default: true
    },
    allowReview: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Indexes
assessmentSchema.index({ companyId: 1, candidateId: 1 });
assessmentSchema.index({ jobId: 1, status: 1 });
assessmentSchema.index({ candidateId: 1, status: 1 });
assessmentSchema.index({ expiresAt: 1 });

// Virtual for checking if assessment is expired
assessmentSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiresAt;
});

// Virtual for time remaining
assessmentSchema.virtual('timeRemaining').get(function() {
  if (this.status !== 'pending') return 0;
  const now = new Date();
  const expiryTime = new Date(this.expiresAt);
  return Math.max(0, expiryTime - now);
});

// Virtual for completion percentage
assessmentSchema.virtual('completionPercentage').get(function() {
  if (this.questions.length === 0) return 0;
  return Math.round((this.answers.length / this.questions.length) * 100);
});

// Method to start assessment
assessmentSchema.methods.startAssessment = function() {
  if (this.status !== 'pending') {
    throw new Error('Assessment cannot be started');
  }
  
  if (this.isExpired) {
    throw new Error('Assessment has expired');
  }
  
  if (this.attempts >= this.maxAttempts) {
    throw new Error('Maximum attempts reached');
  }
  
  this.status = 'in_progress';
  this.startedAt = new Date();
  this.attempts += 1;
  
  // Set expiry time if not already set
  if (!this.expiresAt) {
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + this.timeLimit);
    this.expiresAt = expiryTime;
  }
  
  return this.save();
};

// Method to submit answer
assessmentSchema.methods.submitAnswer = function(questionIndex, answer, timeSpent = 0) {
  if (this.status !== 'in_progress') {
    throw new Error('Assessment is not in progress');
  }
  
  if (this.isExpired) {
    throw new Error('Assessment has expired');
  }
  
  // Remove existing answer for this question if any
  this.answers = this.answers.filter(a => a.questionIndex !== questionIndex);
  
  // Add new answer
  this.answers.push({
    questionIndex,
    answer,
    timeSpent
  });
  
  return this.save();
};

// Method to complete assessment
assessmentSchema.methods.completeAssessment = function() {
  if (this.status !== 'in_progress') {
    throw new Error('Assessment is not in progress');
  }
  
  this.status = 'completed';
  this.completedAt = new Date();
  
  // Calculate score
  const scoringService = require('../services/scoringService');
  const result = scoringService.calculateAssessmentScore(this.questions, this.answers);
  
  this.score = result.score;
  this.passed = result.passed;
  
  return this.save();
};

// Method to get next unanswered question
assessmentSchema.methods.getNextQuestion = function() {
  const answeredQuestions = this.answers.map(a => a.questionIndex);
  const unansweredQuestions = this.questions
    .map((q, index) => ({ ...q.toObject(), index }))
    .filter(q => !answeredQuestions.includes(q.index) && q.required);
  
  if (this.metadata.randomizeQuestions) {
    // Shuffle unanswered questions
    for (let i = unansweredQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unansweredQuestions[i], unansweredQuestions[j]] = [unansweredQuestions[j], unansweredQuestions[i]];
    }
  }
  
  return unansweredQuestions[0] || null;
};

// Method to get assessment summary
assessmentSchema.methods.getSummary = function() {
  return {
    id: this._id,
    title: this.title,
    type: this.type,
    totalQuestions: this.questions.length,
    answeredQuestions: this.answers.length,
    completionPercentage: this.completionPercentage,
    timeLimit: this.timeLimit,
    timeSpent: this.timeSpent,
    score: this.score,
    passed: this.passed,
    status: this.status,
    startedAt: this.startedAt,
    completedAt: this.completedAt,
    isExpired: this.isExpired
  };
};

// Static method to get pending assessments for candidate
assessmentSchema.statics.getPendingAssessments = function(candidateId) {
  return this.find({
    candidateId,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  }).populate(['companyId', 'jobId']);
};

// Static method to get completed assessments for candidate
assessmentSchema.statics.getCompletedAssessments = function(candidateId) {
  return this.find({
    candidateId,
    status: 'completed'
  }).populate(['companyId', 'jobId']).sort({ completedAt: -1 });
};

// Static method to get assessments for company
assessmentSchema.statics.getCompanyAssessments = function(companyId, filters = {}) {
  const query = { companyId };
  
  if (filters.status) query.status = filters.status;
  if (filters.type) query.type = filters.type;
  if (filters.candidateId) query.candidateId = filters.candidateId;
  if (filters.jobId) query.jobId = filters.jobId;
  
  return this.find(query)
    .populate(['candidateId', 'jobId'])
    .sort({ createdAt: -1 });
};

// Pre-save middleware to set expiry time
assessmentSchema.pre('save', function(next) {
  if (this.isNew && !this.expiresAt) {
    const expiryTime = new Date();
    // Default expiry: 7 days from creation
    expiryTime.setDate(expiryTime.getDate() + 7);
    this.expiresAt = expiryTime;
  }
  next();
});

module.exports = mongoose.model('Assessment', assessmentSchema);
