const Exam = require('../models/Exam');
const Job = require('../models/Job');
const asyncHandler = require('../middleware/async');
const ApiResponse = require('../utils/apiResponse');

// @desc    Get company exams
// @route   GET /api/exams/company
const getCompanyExams = asyncHandler(async (req, res) => {
  if (req.user.userType !== 'company') {
    return res.status(403).json(ApiResponse.error('Only companies can access their exams'));
  }

  const exams = await Exam.find({ companyId: req.user.id })
    .populate('jobId', 'title company')
    .sort({ createdAt: -1 });

  res.status(200).json(ApiResponse.success({
    count: exams.length,
    exams: [
      // Mock data for demo
      {
        _id: 'mock1',
        title: 'Frontend Developer Technical Test',
        description: 'HTML, CSS, JavaScript assessment',
        duration: 90,
        totalQuestions: 40,
        jobId: { title: 'Senior Frontend Developer', company: 'TechCorp' },
        status: 'published',
        applicants: 12,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3)
      },
      {
        _id: 'mock2',
        title: 'Backend API Test',
        description: 'Node.js, Express, MongoDB test',
        duration: 120,
        totalQuestions: 60,
        jobId: { title: 'Fullstack Engineer', company: 'TechCorp' },
        status: 'draft',
        applicants: 0,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1)
      }
    ]
  }));
});

module.exports = {
  getCompanyExams
};

