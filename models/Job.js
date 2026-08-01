const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a job title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  company: {
    type: String,
    required: [true, 'Please add a company name'],
    trim: true
  },
  location: {
    type: String,
    required: [true, 'Please add a location'],
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['full-time', 'part-time', 'contract', 'internship', 'remote', 'tender', 'consultancy', 'public', 'other'],
    default: 'full-time'
  },
  category: {
    type: String,
    required: true,
    enum: ['technology', 'marketing', 'finance', 'healthcare', 'design', 'sales', 'education', 'other'],
    default: 'technology'
  },
  experience: {
    type: String,
    required: false,
    enum: ['entry', 'junior', 'mid', 'senior', 'lead', 'principal'],
    default: 'mid'
  },
  salary: {
    type: String,
    trim: true
  },
  salaryMin: {
    type: Number,
    default: 0
  },
  salaryMax: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    required: [true, 'Please add a job description']
  },
  responsibilities: [String],
  requirements: [String],
  benefits: [String],
  skills: [String],
  remote: {
    type: Boolean,
    default: false
  },
  urgent: {
    type: Boolean,
    default: false
  },
  featured: {
    type: Boolean,
    default: false
  },
  applicants: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'draft', 'paused', 'closed'],
    default: 'draft'
  },
  deadline: Date,
  contactEmail: String,
  contactPhone: String,
  applicationUrl: String,
  companyLogo: String,
  companySize: String,
  workCulture: String,
  image: {
    type: String,
    default: ''
  },
  postedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  companyId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  source: {
    key: String,
    name: String,
    url: String,
    externalId: String,
    applyUrl: String,
    importedAt: Date
  }
}, {
  timestamps: true
});

jobSchema.index({ postedBy: 1, createdAt: -1 });
jobSchema.index({ companyId: 1, createdAt: -1 });
jobSchema.index({ title: 'text', description: 'text' });
jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ createdAt: -1 });
jobSchema.index({ category: 1, type: 1 });
jobSchema.index({ remote: 1, location: 1 });
jobSchema.index({ 'source.key': 1, 'source.externalId': 1 }, { unique: true, sparse: true });

jobSchema.pre('save', function(next) {
  if (!this.experience) {
    this.experience = 'mid';
  }
  if (!this.status) {
    this.status = 'draft';
  }
  next();
});

module.exports = mongoose.models.Job || mongoose.model('Job', jobSchema);