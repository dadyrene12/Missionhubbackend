// Advanced Analytics and Reporting Service
class AnalyticsService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // Get cache key
  getCacheKey(prefix, params) {
    return `${prefix}_${JSON.stringify(params)}`;
  }

  // Check cache
  getCachedData(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  // Set cache
  setCachedData(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  // Generate comprehensive dashboard analytics
  async generateDashboardAnalytics(timeRange = '30d') {
    const cacheKey = this.getCacheKey('dashboard_analytics', { timeRange });
    const cached = this.getCachedData(cacheKey);
    
    if (cached) return cached;

    const User = require('../models/User');
    const Job = require('../models/Job');
    const Application = require('../models/Application');
    const Message = require('../models/Message');
    const Payment = require('../models/Payment');

    const dateRange = this.getDateRange(timeRange);

    try {
      const [
        totalUsers,
        newUsers,
        totalJobs,
        newJobs,
        totalApplications,
        newApplications,
        totalMessages,
        newMessages,
        totalRevenue,
        userGrowth,
        jobGrowth,
        applicationGrowth,
        topCategories,
        topLocations,
        userTypes,
        conversionRates
      ] = await Promise.all([
        // User metrics
        User.countDocuments(),
        User.countDocuments({ createdAt: { $gte: dateRange.start } }),
        
        // Job metrics
        Job.countDocuments(),
        Job.countDocuments({ createdAt: { $gte: dateRange.start } }),
        
        // Application metrics
        Application.countDocuments(),
        Application.countDocuments({ createdAt: { $gte: dateRange.start } }),
        
        // Message metrics
        Message.countDocuments(),
        Message.countDocuments({ createdAt: { $gte: dateRange.start } }),
        
        // Revenue metrics
        this.getTotalRevenue(dateRange),
        
        // Growth trends
        this.getUserGrowth(dateRange),
        this.getJobGrowth(dateRange),
        this.getApplicationGrowth(dateRange),
        
        // Top analytics
        this.getTopCategories(dateRange),
        this.getTopLocations(dateRange),
        this.getUserTypeDistribution(),
        this.getConversionRates(dateRange)
      ]);

      const analytics = {
        overview: {
          totalUsers,
          newUsers,
          totalJobs,
          newJobs,
          totalApplications,
          newApplications,
          totalMessages,
          newMessages,
          totalRevenue
        },
        trends: {
          userGrowth,
          jobGrowth,
          applicationGrowth
        },
        insights: {
          topCategories,
          topLocations,
          userTypes,
          conversionRates
        },
        performance: {
          averageResponseTime: await this.getAverageResponseTime(dateRange),
          userEngagement: await this.getUserEngagement(dateRange),
          platformHealth: await this.getPlatformHealth()
        },
        timeRange,
        generatedAt: new Date()
      };

      this.setCachedData(cacheKey, analytics);
      return analytics;

    } catch (error) {
      console.error('Error generating dashboard analytics:', error);
      throw error;
    }
  }

  // Generate detailed user analytics
  async generateUserAnalytics(userId, timeRange = '30d') {
    const cacheKey = this.getCacheKey('user_analytics', { userId, timeRange });
    const cached = this.getCachedData(cacheKey);
    
    if (cached) return cached;

    const User = require('../models/User');
    const Application = require('../models/Application');
    const Message = require('../models/Message');
    const Notification = require('../models/Notification');

    const dateRange = this.getDateRange(timeRange);

    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      const [
        applications,
        messages,
        notifications,
        applicationStats,
        profileViews,
        searchAppearances,
        skillMatchScores
      ] = await Promise.all([
        Application.find({ userId, createdAt: { $gte: dateRange.start } }),
        Message.find({ $or: [{ fromUserId: userId }, { toUserId: userId }], createdAt: { $gte: dateRange.start } }),
        Notification.find({ userId, createdAt: { $gte: dateRange.start } }),
        this.getApplicationStats(userId, dateRange),
        this.getProfileViews(userId, dateRange),
        this.getSearchAppearances(userId, dateRange),
        this.getSkillMatchScores(userId, dateRange)
      ]);

      const analytics = {
        userInfo: {
          id: user._id,
          name: user.name,
          email: user.email,
          userType: user.userType,
          joinDate: user.createdAt
        },
        activity: {
          applicationsCount: applications.length,
          messagesCount: messages.length,
          notificationsCount: notifications.length,
          profileViews,
          searchAppearances
        },
        performance: {
          applicationStats,
          skillMatchScores,
          responseRate: this.calculateResponseRate(messages),
          engagementScore: this.calculateEngagementScore(user, applications, messages)
        },
        trends: {
          applicationTrend: this.getApplicationTrend(applications),
          messageTrend: this.getMessageTrend(messages)
        },
        timeRange,
        generatedAt: new Date()
      };

      this.setCachedData(cacheKey, analytics);
      return analytics;

    } catch (error) {
      console.error('Error generating user analytics:', error);
      throw error;
    }
  }

  // Generate company analytics
  async generateCompanyAnalytics(companyId, timeRange = '30d') {
    const cacheKey = this.getCacheKey('company_analytics', { companyId, timeRange });
    const cached = this.getCachedData(cacheKey);
    
    if (cached) return cached;

    const User = require('../models/User');
    const Job = require('../models/Job');
    const Application = require('../models/Application');
    const CompanyProfile = require('../models/CompanyProfile');

    const dateRange = this.getDateRange(timeRange);

    try {
      const company = await User.findById(companyId);
      const companyProfile = await CompanyProfile.findOne({ userId: companyId });

      if (!company) throw new Error('Company not found');

      const [
        jobs,
        applications,
        applicationStats,
        candidateQuality,
        hiringFunnel,
        costPerHire,
        timeToHire
      ] = await Promise.all([
        Job.find({ postedBy: companyId, createdAt: { $gte: dateRange.start } }),
        Application.find({ postedBy: companyId, createdAt: { $gte: dateRange.start } }),
        this.getCompanyApplicationStats(companyId, dateRange),
        this.getCandidateQuality(companyId, dateRange),
        this.getHiringFunnel(companyId, dateRange),
        this.getCostPerHire(companyId, dateRange),
        this.getTimeToHire(companyId, dateRange)
      ]);

      const analytics = {
        companyInfo: {
          id: company._id,
          name: company.name,
          email: company.email,
          profile: companyProfile
        },
        performance: {
          jobsPosted: jobs.length,
          totalApplications: applications.length,
          applicationStats,
          candidateQuality,
          hiringFunnel
        },
        efficiency: {
          costPerHire,
          timeToHire,
          applicationRate: this.calculateApplicationRate(jobs, applications),
          hireRate: this.calculateHireRate(applications)
        },
        trends: {
          postingTrend: this.getJobPostingTrend(jobs),
          applicationTrend: this.getCompanyApplicationTrend(applications)
        },
        timeRange,
        generatedAt: new Date()
      };

      this.setCachedData(cacheKey, analytics);
      return analytics;

    } catch (error) {
      console.error('Error generating company analytics:', error);
      throw error;
    }
  }

  // Generate job-specific analytics
  async generateJobAnalytics(jobId, timeRange = '30d') {
    const cacheKey = this.getCacheKey('job_analytics', { jobId, timeRange });
    const cached = this.getCachedData(cacheKey);
    
    if (cached) return cached;

    const Job = require('../models/Job');
    const Application = require('../models/Application');
    const User = require('../models/User');

    const dateRange = this.getDateRange(timeRange);

    try {
      const job = await Job.findById(jobId).populate('postedBy', 'name companyName');
      if (!job) throw new Error('Job not found');

      const [
        applications,
        applicationTrends,
        candidateDemographics,
        sourceAnalytics,
        funnelAnalytics
      ] = await Promise.all([
        Application.find({ jobId, createdAt: { $gte: dateRange.start } }),
        this.getJobApplicationTrends(jobId, dateRange),
        this.getCandidateDemographics(jobId, dateRange),
        this.getSourceAnalytics(jobId, dateRange),
        this.getFunnelAnalytics(jobId, dateRange)
      ]);

      const analytics = {
        jobInfo: {
          id: job._id,
          title: job.title,
          company: job.company,
          postedBy: job.postedBy,
          category: job.category,
          type: job.type,
          location: job.location,
          postedDate: job.createdAt
        },
        performance: {
          totalViews: job.views || 0,
          totalApplications: applications.length,
          viewToApplicationRate: job.views > 0 ? (applications.length / job.views) * 100 : 0,
          applicationTrends
        },
        candidates: {
          demographics: candidateDemographics,
          qualityScore: this.calculateCandidateQuality(applications),
          sourceAnalytics
        },
        funnel: funnelAnalytics,
        recommendations: this.generateJobRecommendations(job, applications),
        timeRange,
        generatedAt: new Date()
      };

      this.setCachedData(cacheKey, analytics);
      return analytics;

    } catch (error) {
      console.error('Error generating job analytics:', error);
      throw error;
    }
  }

  // Helper methods for data aggregation
  async getTotalRevenue(dateRange) {
    const Payment = require('../models/Payment');
    const result = await Payment.aggregate([
      { $match: { paymentDate: { $gte: dateRange.start }, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    return result[0]?.total || 0;
  }

  async getUserGrowth(dateRange) {
    const User = require('../models/User');
    return User.aggregate([
      { $match: { createdAt: { $gte: dateRange.start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
  }

  async getJobGrowth(dateRange) {
    const Job = require('../models/Job');
    return Job.aggregate([
      { $match: { createdAt: { $gte: dateRange.start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
  }

  async getApplicationGrowth(dateRange) {
    const Application = require('../models/Application');
    return Application.aggregate([
      { $match: { createdAt: { $gte: dateRange.start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
  }

  async getTopCategories(dateRange) {
    const Job = require('../models/Job');
    return Job.aggregate([
      { $match: { createdAt: { $gte: dateRange.start } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
  }

  async getTopLocations(dateRange) {
    const Job = require('../models/Job');
    return Job.aggregate([
      { $match: { createdAt: { $gte: dateRange.start } } },
      { $group: { _id: '$location', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
  }

  async getUserTypeDistribution() {
    const User = require('../models/User');
    return User.aggregate([
      { $group: { _id: '$userType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
  }

  async getConversionRates(dateRange) {
    const Job = require('../models/Job');
    const Application = require('../models/Application');

    const [totalJobs, totalApplications] = await Promise.all([
      Job.countDocuments({ createdAt: { $gte: dateRange.start } }),
      Application.countDocuments({ createdAt: { $gte: dateRange.start } })
    ]);

    return {
      jobToApplication: totalJobs > 0 ? (totalApplications / totalJobs) * 100 : 0,
      applicationToHire: await this.getApplicationToHireRate(dateRange)
    };
  }

  async getApplicationToHireRate(dateRange) {
    const Application = require('../models/Application');
    const result = await Application.aggregate([
      { $match: { createdAt: { $gte: dateRange.start } } },
      { $group: { _id: null, total: { $sum: 1 }, hired: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } } } }
    ]);
    
    const data = result[0];
    return data && data.total > 0 ? (data.hired / data.total) * 100 : 0;
  }

  // Generate custom reports
  async generateCustomReport(reportConfig) {
    const { type, filters, groupBy, timeRange, metrics } = reportConfig;
    
    switch (type) {
      case 'user_activity':
        return this.generateUserActivityReport(filters, groupBy, timeRange, metrics);
      case 'job_performance':
        return this.generateJobPerformanceReport(filters, groupBy, timeRange, metrics);
      case 'revenue_analysis':
        return this.generateRevenueAnalysisReport(filters, groupBy, timeRange, metrics);
      case 'engagement_metrics':
        return this.generateEngagementMetricsReport(filters, groupBy, timeRange, metrics);
      default:
        throw new Error('Unknown report type');
    }
  }

  // Export analytics data
  async exportAnalytics(analyticsData, format = 'json') {
    switch (format) {
      case 'json':
        return JSON.stringify(analyticsData, null, 2);
      case 'csv':
        return this.convertToCSV(analyticsData);
      case 'xlsx':
        return this.convertToExcel(analyticsData);
      default:
        throw new Error('Unsupported export format');
    }
  }

  // Utility methods
  getDateRange(timeRange) {
    const end = new Date();
    const start = new Date();

    switch (timeRange) {
      case '7d':
        start.setDate(end.getDate() - 7);
        break;
      case '30d':
        start.setDate(end.getDate() - 30);
        break;
      case '90d':
        start.setDate(end.getDate() - 90);
        break;
      case '1y':
        start.setFullYear(end.getFullYear() - 1);
        break;
      default:
        start.setDate(end.getDate() - 30);
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  // Additional helper methods would be implemented here...
  calculateResponseRate(messages) {
    const sentMessages = messages.filter(m => m.fromUserId);
    const receivedMessages = messages.filter(m => m.toUserId);
    return sentMessages.length > 0 ? (receivedMessages.length / sentMessages.length) * 100 : 0;
  }

  calculateEngagementScore(user, applications, messages) {
    // Simple engagement score calculation
    let score = 0;
    score += applications.length * 10;
    score += messages.length * 5;
    score += user.profile?.skills?.length * 2;
    return Math.min(score, 100);
  }

  generateJobRecommendations(job, applications) {
    const recommendations = [];
    
    if (applications.length === 0) {
      recommendations.push('Consider promoting this job to increase visibility');
    }
    
    if (job.views < 100) {
      recommendations.push('Job has low views - consider improving title or description');
    }
    
    const approvalRate = applications.filter(a => a.status === 'approved').length / applications.length * 100;
    if (approvalRate < 10) {
      recommendations.push('Low approval rate - consider reviewing job requirements');
    }
    
    return recommendations;
  }

  convertToCSV(data) {
    // CSV conversion implementation
    return 'CSV conversion to be implemented';
  }

  convertToExcel(data) {
    // Excel conversion implementation
    return 'Excel conversion to be implemented';
  }
}

module.exports = new AnalyticsService();
