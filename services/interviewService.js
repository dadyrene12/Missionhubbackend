// Interview Service - Simplified
class InterviewService {
  constructor() {
    this.interviewTypes = ['phone', 'video', 'in-person', 'technical', 'hr', 'panel'];
    this.assessmentTypes = ['technical_test', 'coding_challenge', 'personality_test'];
  }

  async getInterviewById(interviewId) {
    const Interview = require('../models/Interview');
    return await Interview.findById(interviewId)
      .populate('candidateId', 'name email profile.profilePhoto')
      .populate('jobId', 'title');
  }

  async getCompanyInterviews(companyId, filters = {}) {
    const Interview = require('../models/Interview');
    const { status, page = 1, limit = 20 } = filters;

    const query = { companyId };
    if (status) query.status = status;

    const interviews = await Interview.find(query)
      .populate('candidateId', 'name email profile.profilePhoto')
      .populate('jobId', 'title')
      .sort({ scheduledDate: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await Interview.countDocuments(query);

    return { interviews, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } };
  }

  async getCandidateInterviews(candidateId, filters = {}) {
    const Interview = require('../models/Interview');
    const { status, page = 1, limit = 20 } = filters;

    const query = { candidateId };
    if (status) query.status = status;

    const interviews = await Interview.find(query)
      .populate('jobId', 'title')
      .sort({ scheduledDate: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await Interview.countDocuments(query);

    return { interviews, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } };
  }
}

module.exports = new InterviewService();
