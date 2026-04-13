const cron = require('node-cron');
const User = require('../models/User');
const Job = require('../models/Job');
const Notification = require('../models/Notification');
const aiMatchingService = require('./aiMatchingService');

class AIMatchingScheduler {
  constructor() {
    this.isRunning = false;
    this.lastRunTime = null;
    this.matchHistory = new Map();
  }

  async sendNotification(userId, notification) {
    try {
      await Notification.create({
        userId,
        ...notification,
        read: false
      });
      return true;
    } catch (error) {
      console.error('Error sending AI match notification:', error.message);
      return false;
    }
  }

  async sendEmailNotification(email, subject, html) {
    try {
      const emailService = require('./emailService');
      await emailService.sendEmail({ email, subject, message: html });
      return true;
    } catch (error) {
      console.error('Error sending AI match email:', error.message);
      return false;
    }
  }

  async notifyUserAboutJob(user, job, matchScore, matchingSkills, matchingExperience) {
    const notificationKey = `${user._id}-${job._id}`;
    const lastNotified = this.matchHistory.get(notificationKey);
    
    if (lastNotified && Date.now() - lastNotified < 7 * 24 * 60 * 60 * 1000) {
      return false;
    }

    const title = matchScore >= 70 
      ? `Perfect Match: ${job.title}` 
      : `New Job Match: ${job.title}`;
    
    const message = this.buildUserNotificationMessage(job, matchScore, matchingSkills, matchingExperience);
    const priority = matchScore >= 80 ? 'high' : matchScore >= 60 ? 'normal' : 'low';

    await this.sendNotification(user._id, {
      type: 'ai_job_match',
      title,
      message,
      priority,
      senderType: 'system',
      jobDetails: {
        jobId: job._id,
        title: job.title,
        company: job.company,
        location: job.location,
        type: job.type,
        salary: job.salary,
        experience: job.experience,
        skills: job.skills,
        matchScore: matchScore,
        matchingSkills: matchingSkills,
        matchingExperience: matchingExperience
      },
      relatedId: job._id,
      relatedType: 'job'
    });

    if (user.aiNotifications?.emailAlerts && user.email) {
      await this.sendJobMatchEmail(user, job, matchScore, matchingSkills, matchingExperience);
    }

    this.matchHistory.set(notificationKey, Date.now());
    return true;
  }

  async notifyCompanyAboutCandidate(company, candidate, job, matchScore, matchingSkills, matchingExperience) {
    const notificationKey = `company-${company._id}-${candidate._id}-${job._id}`;
    const lastNotified = this.matchHistory.get(notificationKey);
    
    if (lastNotified && Date.now() - lastNotified < 7 * 24 * 60 * 60 * 1000) {
      return false;
    }

    const candidateName = candidate.name || 'Anonymous Candidate';
    const title = matchScore >= 70 
      ? `Strong Candidate Match: ${candidateName}` 
      : `New Candidate Match for ${job.title}`;
    
    const message = this.buildCompanyNotificationMessage(candidate, job, matchScore, matchingSkills, matchingExperience);
    const priority = matchScore >= 80 ? 'high' : matchScore >= 60 ? 'normal' : 'low';

    await this.sendNotification(company._id, {
      type: 'ai_candidate_match',
      title,
      message,
      priority,
      senderType: 'system',
      jobDetails: {
        jobId: job._id,
        title: job.title,
        matchScore: matchScore,
        matchingSkills: matchingSkills,
        matchingExperience: matchingExperience
      },
      applicationDetails: {
        candidateId: candidate._id,
        candidateName: candidateName,
        candidateEmail: candidate.email,
        candidateTitle: candidate.profile?.title,
        candidateSkills: candidate.profile?.skills,
        candidateExperience: candidate.profile?.experience
      },
      relatedId: candidate._id,
      relatedType: 'candidate'
    });

    if (company.companyAiNotifications?.emailAlerts && company.email) {
      await this.sendCandidateMatchEmail(company, candidate, job, matchScore, matchingSkills, matchingExperience);
    }

    this.matchHistory.set(notificationKey, Date.now());
    return true;
  }

  buildUserNotificationMessage(job, matchScore, matchingSkills, matchingExperience) {
    let message = `Our AI found a ${matchScore}% match for you! `;
    
    if (matchingSkills.length > 0) {
      message += `Your skills (${matchingSkills.slice(0, 3).join(', ')}) match this job. `;
    }
    
    if (matchingExperience) {
      message += `Your experience level aligns well. `;
    }
    
    message += `${job.company ? `This position is at ${job.company}. ` : ''}`;
    message += job.location ? `Location: ${job.location}. ` : '';
    message += job.salary ? `Salary: ${job.salary}. ` : '';
    message += `Apply now to take advantage of this opportunity!`;
    
    return message;
  }

  buildCompanyNotificationMessage(candidate, job, matchScore, matchingSkills, matchingExperience) {
    const candidateName = candidate.name || 'This candidate';
    let message = `Our AI found a ${matchScore}% match for your job "${job.title}"! `;
    
    if (matchingSkills.length > 0) {
      message += `This candidate has matching skills: ${matchingSkills.slice(0, 3).join(', ')}. `;
    }
    
    if (matchingExperience) {
      message += `Their experience level matches your requirements. `;
    }
    
    message += candidate.profile?.title ? `Title: ${candidate.profile.title}. ` : '';
    message += candidate.profile?.yearsOfExperience ? `Experience: ${candidate.profile.yearsOfExperience} years. ` : '';
    message += `Review their profile to learn more!`;
    
    return message;
  }

  async sendJobMatchEmail(user, job, matchScore, matchingSkills, matchingExperience) {
    const skillsText = matchingSkills.length > 0 
      ? `<p><strong>Matching Skills:</strong> ${matchingSkills.slice(0, 5).join(', ')}</p>` 
      : '';
    
    const html = `
      <h2 style="color: #1F2937; margin-bottom: 16px;">AI-Powered Job Match Found!</h2>
      <p style="color: #6B7280; margin-bottom: 24px;">
        Our AI has analyzed your profile and found a <strong style="color: #4F46E5;">${matchScore}% match</strong> 
        for the following position:
      </p>
      
      <div style="background: #F3F4F6; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h3 style="color: #1F2937; margin: 0 0 12px 0;">${job.title}</h3>
        <p style="color: #6B7280; margin: 0 0 8px 0;">
          ${job.company ? `<strong>Company:</strong> ${job.company}<br>` : ''}
          ${job.location ? `<strong>Location:</strong> ${job.location}<br>` : ''}
          ${job.salary ? `<strong>Salary:</strong> ${job.salary}<br>` : ''}
          ${job.type ? `<strong>Type:</strong> ${job.type}<br>` : ''}
          ${job.experience ? `<strong>Experience:</strong> ${job.experience}` : ''}
        </p>
      </div>
      
      ${skillsText}
      
      <div style="background: linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(124, 58, 237, 0.1) 100%); border-left: 4px solid #4F46E5; padding: 16px; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
        <p style="margin: 0; color: #1F2937; font-size: 14px;">
          <strong>Match Score:</strong> ${matchScore}%<br>
          <strong>Match Type:</strong> ${matchScore >= 80 ? 'Excellent Match' : matchScore >= 60 ? 'Good Match' : 'Potential Match'}
        </p>
      </div>
      
      <p style="color: #6B7280; font-size: 14px; margin-bottom: 24px;">
        Don't miss this opportunity! Apply today to connect with ${job.company || 'this company'}.
      </p>
    `;

    await this.sendEmailNotification(
      user.email,
      `AI Match: ${job.title} at ${job.company || 'New Company'} - ${matchScore}% Match`,
      html
    );
  }

  async sendCandidateMatchEmail(company, candidate, job, matchScore, matchingSkills, matchingExperience) {
    const candidateName = candidate.name || 'This candidate';
    const skillsText = matchingSkills.length > 0 
      ? `<p><strong>Matching Skills:</strong> ${matchingSkills.slice(0, 5).join(', ')}</p>` 
      : '';
    
    const html = `
      <h2 style="color: #1F2937; margin-bottom: 16px;">AI-Powered Candidate Match Found!</h2>
      <p style="color: #6B7280; margin-bottom: 24px;">
        Our AI has analyzed your job posting and found a <strong style="color: #4F46E5;">${matchScore}% match</strong>!
      </p>
      
      <div style="background: #F3F4F6; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h3 style="color: #1F2937; margin: 0 0 12px 0;">${candidateName}</h3>
        <p style="color: #6B7280; margin: 0 0 8px 0;">
          ${candidate.profile?.title ? `<strong>Title:</strong> ${candidate.profile.title}<br>` : ''}
          ${candidate.profile?.yearsOfExperience ? `<strong>Experience:</strong> ${candidate.profile.yearsOfExperience} years<br>` : ''}
          ${candidate.profile?.location ? `<strong>Location:</strong> ${candidate.profile.location}<br>` : ''}
          ${candidate.profile?.expectedSalary ? `<strong>Expected Salary:</strong> ${candidate.profile.expectedSalary}<br>` : ''}
        </p>
      </div>
      
      <div style="background: #F3F4F6; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <p style="color: #6B7280; margin: 0 0 8px 0;">
          <strong>For Job:</strong> ${job.title}
        </p>
      </div>
      
      ${skillsText}
      
      <div style="background: linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(124, 58, 237, 0.1) 100%); border-left: 4px solid #4F46E5; padding: 16px; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
        <p style="margin: 0; color: #1F2937; font-size: 14px;">
          <strong>Match Score:</strong> ${matchScore}%<br>
          <strong>Match Type:</strong> ${matchScore >= 80 ? 'Excellent Match' : matchScore >= 60 ? 'Good Match' : 'Potential Match'}
        </p>
      </div>
      
      <p style="color: #6B7280; font-size: 14px; margin-bottom: 24px;">
        Review this candidate's profile and reach out to start the hiring process!
      </p>
    `;

    await this.sendEmailNotification(
      company.email,
      `AI Match: ${candidateName} for ${job.title} - ${matchScore}% Match`,
      html
    );
  }

  async matchJobsForUsers() {
    const users = await User.find({
      userType: 'jobSeeker',
      isActive: true,
      'aiNotifications.enabled': true,
      'profile.skills': { $exists: true, $ne: [] }
    });

    const activeJobs = await Job.find({ 
      status: 'active',
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }).lean();

    if (activeJobs.length === 0) {
      console.log('No active jobs found for matching');
      return;
    }

    let matchCount = 0;
    let notificationCount = 0;

    for (const user of users) {
      if (!user.profile?.skills || user.profile.skills.length === 0) continue;
      if (!user.profile?.experience && user.aiNotifications?.matchedExperienceOnly) continue;

      const userSkills = user.profile.skills.map(s => s.toLowerCase());
      const userExperience = user.profile.experience || user.profile.yearsOfExperience;

      for (const job of activeJobs) {
        const jobSkills = (job.skills || []).map(s => s.toLowerCase());
        
        const matchingSkills = userSkills.filter(skill => jobSkills.includes(skill));
        const hasMatchingExperience = this.checkExperienceMatch(userExperience, job.experience);
        const hasAnyMatch = matchingSkills.length > 0 || hasMatchingExperience;

        if (user.aiNotifications?.matchedSkillsOnly && matchingSkills.length === 0) continue;
        if (user.aiNotifications?.matchedExperienceOnly && !hasMatchingExperience) continue;

        const matchScore = aiMatchingService.calculateMatchScore(user, job);
        
        if (matchScore.overallScore >= (user.aiNotifications?.minMatchScore || 50)) {
          if (matchingSkills.length > 0 || hasMatchingExperience) {
            const notified = await this.notifyUserAboutJob(
              user, 
              job, 
              matchScore.overallScore,
              matchingSkills.map(s => s.charAt(0).toUpperCase() + s.slice(1)),
              hasMatchingExperience
            );
            
            if (notified) {
              notificationCount++;
            }
            matchCount++;
          }
        }
      }

      await User.findByIdAndUpdate(user._id, { lastAiMatchCheck: new Date() });
    }

    console.log(`[AI Matching] Jobs for Users: Found ${matchCount} matches, sent ${notificationCount} notifications`);
    return { matches: matchCount, notifications: notificationCount };
  }

  async matchCandidatesForCompanies() {
    const companies = await User.find({
      userType: 'company',
      isActive: true,
      'companyAiNotifications.enabled': true
    });

    const candidates = await User.find({
      userType: 'jobSeeker',
      isActive: true,
      isVerified: true,
      'profile.skills': { $exists: true, $ne: [] }
    }).lean();

    const activeJobs = await Job.find({ 
      status: 'active',
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }).lean();

    if (candidates.length === 0 || activeJobs.length === 0) {
      console.log('No candidates or jobs found for company matching');
      return;
    }

    let matchCount = 0;
    let notificationCount = 0;

    for (const company of companies) {
      const companyJobs = activeJobs.filter(job => 
        job.postedBy?.toString() === company._id.toString() ||
        job.companyId?.toString() === company._id.toString()
      );

      if (companyJobs.length === 0) {
        const companyJobIds = activeJobs;
        for (const job of companyJobIds) {
          for (const candidate of candidates) {
            if (!candidate.profile?.skills || candidate.profile.skills.length === 0) continue;

            const candidateSkills = candidate.profile.skills.map(s => s.toLowerCase());
            const jobSkills = (job.skills || []).map(s => s.toLowerCase());
            
            const matchingSkills = candidateSkills.filter(skill => jobSkills.includes(skill));
            const candidateExperience = candidate.profile.experience || candidate.profile.yearsOfExperience;
            const hasMatchingExperience = this.checkExperienceMatch(candidateExperience, job.experience);

            const minScore = company.companyAiNotifications?.minMatchScore || 50;
            const matchScore = aiMatchingService.calculateMatchScore(candidate, job);
            
            if (matchScore.overallScore >= minScore && matchingSkills.length > 0) {
              const notified = await this.notifyCompanyAboutCandidate(
                company,
                candidate,
                job,
                matchScore.overallScore,
                matchingSkills.map(s => s.charAt(0).toUpperCase() + s.slice(1)),
                hasMatchingExperience
              );
              
              if (notified) {
                notificationCount++;
              }
              matchCount++;
            }
          }
        }
      }
    }

    console.log(`[AI Matching] Candidates for Companies: Found ${matchCount} matches, sent ${notificationCount} notifications`);
    return { matches: matchCount, notifications: notificationCount };
  }

  checkExperienceMatch(candidateExp, jobExp) {
    if (!candidateExp || !jobExp) return false;
    
    const levels = { 'entry': 1, 'junior': 2, 'mid': 3, 'senior': 4, 'lead': 5, 'principal': 6, 'executive': 7 };
    
    const candidateLevel = typeof candidateExp === 'string' 
      ? levels[candidateExp.toLowerCase()] || 3 
      : candidateExp;
    const jobLevel = levels[jobExp.toLowerCase()] || 3;
    
    return Math.abs(candidateLevel - jobLevel) <= 1;
  }

  async runMatching() {
    if (this.isRunning) {
      console.log('[AI Matching] Already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('[AI Matching] Starting automatic matching process...');

    try {
      const startTime = Date.now();
      
      const [userResults, companyResults] = await Promise.all([
        this.matchJobsForUsers(),
        this.matchCandidatesForCompanies()
      ]);

      const duration = Date.now() - startTime;
      this.lastRunTime = new Date();

      console.log(`[AI Matching] Completed in ${duration}ms`);
      console.log(`[AI Matching] Total: User matches: ${userResults?.matches || 0}, Company matches: ${companyResults?.matches || 0}`);

      return {
        success: true,
        duration,
        userMatches: userResults?.matches || 0,
        userNotifications: userResults?.notifications || 0,
        companyMatches: companyResults?.matches || 0,
        companyNotifications: companyResults?.notifications || 0
      };
    } catch (error) {
      console.error('[AI Matching] Error during matching:', error);
      return { success: false, error: error.message };
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    console.log('[AI Matching] Initializing scheduler...');
    
    this.runMatching().catch(console.error);

    cron.schedule('*/15 * * * *', async () => {
      console.log('[AI Matching] Running scheduled match check (15 min interval)...');
      await this.runMatching();
    });

    cron.schedule('0 8 * * *', async () => {
      console.log('[AI Matching] Running daily deep matching...');
      await this.runMatching();
    });

    console.log('[AI Matching] Scheduler started successfully');
  }

  async triggerManualRun() {
    console.log('[AI Matching] Manual run triggered');
    return await this.runMatching();
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      matchHistorySize: this.matchHistory.size
    };
  }
}

module.exports = new AIMatchingScheduler();
