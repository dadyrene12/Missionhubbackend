// AI-Powered Job Matching Service
class AIMatchingService {
  constructor() {
    // Skill weights for different industries
    this.skillWeights = {
      'technology': {
        'JavaScript': 1.2, 'React': 1.3, 'Node.js': 1.2, 'TypeScript': 1.4,
        'Python': 1.1, 'Java': 1.0, 'SQL': 0.9, 'MongoDB': 0.9,
        'AWS': 1.1, 'Docker': 1.0, 'Kubernetes': 1.2, 'GraphQL': 1.1,
        'Vue.js': 1.1, 'Angular': 1.0, 'Next.js': 1.2, 'Express.js': 1.0
      },
      'marketing': {
        'SEO': 1.3, 'SEM': 1.2, 'Content Marketing': 1.2, 'Social Media': 1.1,
        'Email Marketing': 1.0, 'Analytics': 1.2, 'Copywriting': 1.1,
        'Brand Management': 1.1, 'PPC': 1.1, 'Marketing Automation': 1.2
      },
      'finance': {
        'Financial Analysis': 1.3, 'Excel': 1.1, 'Financial Modeling': 1.2,
        'Risk Management': 1.1, 'Investment Banking': 1.2, 'Accounting': 1.0,
        'Budget Management': 1.0, 'Financial Reporting': 1.1, 'Audit': 1.0
      },
      'design': {
        'UI Design': 1.3, 'UX Design': 1.3, 'Figma': 1.2, 'Adobe Creative Suite': 1.1,
        'Sketch': 1.1, 'Prototyping': 1.1, 'Wireframing': 1.0, 'Design Systems': 1.2,
        'Photoshop': 1.0, 'Illustrator': 1.0, 'InDesign': 0.9
      },
      'sales': {
        'Sales Strategy': 1.2, 'CRM': 1.1, 'Negotiation': 1.2, 'Lead Generation': 1.1,
        'Account Management': 1.1, 'Sales Forecasting': 1.0, 'Business Development': 1.1,
        'Customer Relations': 1.0, 'Product Knowledge': 1.0
      }
    };

    // Experience level mapping
    this.experienceLevels = {
      'entry': 1, 'junior': 2, 'mid': 3, 'senior': 4, 'lead': 5, 'principal': 6, 'executive': 7
    };

    // Location preferences weight
    this.locationWeights = {
      'same_city': 1.0,
      'same_country': 0.8,
      'remote': 0.9,
      'different_country': 0.5
    };

    // Education level weights
    this.educationWeights = {
      'high_school': 0.5,
      'associate': 0.7,
      'bachelor': 1.0,
      'master': 1.2,
      'phd': 1.4,
      'bootcamp': 0.8,
      'certification': 0.6
    };
  }

  // Calculate comprehensive match score between candidate and job
  calculateMatchScore(candidate, job) {
    let totalScore = 0;
    let maxScore = 0;
    let breakdown = {};

    // 1. Skills matching (35% of total score)
    const skillsScore = this.calculateSkillsMatch(candidate.profile?.skills || [], job.skills || [], job.category);
    breakdown.skills = { score: skillsScore, weight: 35, achieved: skillsScore * 0.35 };
    totalScore += breakdown.skills.achieved;
    maxScore += 35;

    // 2. Experience level matching (20% of total score)
    const experienceScore = this.calculateExperienceMatch(candidate.profile?.experience, job.experience);
    breakdown.experience = { score: experienceScore, weight: 20, achieved: experienceScore * 0.20 };
    totalScore += breakdown.experience.achieved;
    maxScore += 20;

    // 3. Education matching (15% of total score)
    const educationScore = this.calculateEducationMatch(candidate.profile?.educationLevel, job.education);
    breakdown.education = { score: educationScore, weight: 15, achieved: educationScore * 0.15 };
    totalScore += breakdown.education.achieved;
    maxScore += 15;

    // 4. Location matching (15% of total score)
    const locationScore = this.calculateLocationMatch(candidate.profile?.location, job.location, job.remote);
    breakdown.location = { score: locationScore, weight: 15, achieved: locationScore * 0.15 };
    totalScore += breakdown.location.achieved;
    maxScore += 15;

    // 5. Salary expectations matching (10% of total score)
    const salaryScore = this.calculateSalaryMatch(candidate.profile?.salaryExpectation, job.salaryMin, job.salaryMax);
    breakdown.salary = { score: salaryScore, weight: 10, achieved: salaryScore * 0.10 };
    totalScore += breakdown.salary.achieved;
    maxScore += 10;

    // 6. Job type preference (5% of total score)
    const jobTypeScore = this.calculateJobTypeMatch(candidate.profile?.preferredJobType, job.type);
    breakdown.jobType = { score: jobTypeScore, weight: 5, achieved: jobTypeScore * 0.05 };
    totalScore += breakdown.jobType.achieved;
    maxScore += 5;

    const overallScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

    return {
      overallScore: Math.round(overallScore),
      breakdown,
      recommendation: this.getRecommendationLevel(overallScore),
      strengths: this.identifyStrengths(breakdown),
      gaps: this.identifyGaps(breakdown)
    };
  }

  // Calculate skills match with industry-specific weights
  calculateSkillsMatch(candidateSkills, jobSkills, jobCategory = 'technology') {
    if (!candidateSkills.length || !jobSkills.length) return 0;

    const weights = this.skillWeights[jobCategory] || this.skillWeights.technology;
    let candidateScore = 0;
    let jobScore = 0;

    // Score candidate skills
    candidateSkills.forEach(skill => {
      const weight = weights[skill] || 0.5; // Default weight for unknown skills
      candidateScore += weight;
    });

    // Score required job skills
    jobSkills.forEach(skill => {
      const weight = weights[skill] || 0.8; // Higher default for job requirements
      jobScore += weight;
    });

    // Calculate matching skills
    const matchingSkills = candidateSkills.filter(skill => jobSkills.includes(skill));
    let matchingScore = 0;
    matchingSkills.forEach(skill => {
      const weight = weights[skill] || 0.5;
      matchingScore += weight;
    });

    // Bonus for exact matches
    const exactMatchBonus = matchingSkills.length === jobSkills.length ? 1.2 : 1.0;

    return jobScore > 0 ? Math.min((matchingScore / jobScore) * exactMatchBonus, 1) : 0;
  }

  // Calculate experience level match
  calculateExperienceMatch(candidateExperience, jobExperience) {
    if (!candidateExperience || !jobExperience) return 0.5;

    const candidateLevel = this.experienceLevels[candidateExperience] || 3;
    const requiredLevel = this.experienceLevels[jobExperience] || 3;

    // Perfect match
    if (candidateLevel === requiredLevel) return 1.0;

    // Overqualified (slight penalty but still good)
    if (candidateLevel > requiredLevel) {
      const diff = candidateLevel - requiredLevel;
      return Math.max(0.7, 1.0 - (diff * 0.1));
    }

    // Underqualified (bigger penalty)
    const diff = requiredLevel - candidateLevel;
    return Math.max(0.2, 1.0 - (diff * 0.2));
  }

  // Calculate education match
  calculateEducationMatch(candidateEducation, jobEducation) {
    if (!candidateEducation) return 0.3;

    const candidateWeight = this.educationWeights[candidateEducation.toLowerCase()] || 0.5;
    
    if (!jobEducation || jobEducation === 'any') return 1.0;

    const requiredWeight = this.educationWeights[jobEducation.toLowerCase()] || 1.0;

    return Math.min(candidateWeight / requiredWeight, 1.0);
  }

  // Calculate location match
  calculateLocationMatch(candidateLocation, jobLocation, isRemote) {
    if (isRemote) return 0.9; // High score for remote jobs

    if (!candidateLocation || !jobLocation) return 0.5;

    // Normalize locations for comparison
    const candidateCity = candidateLocation.toLowerCase().split(',')[0].trim();
    const jobCity = jobLocation.toLowerCase().split(',')[0].trim();

    if (candidateCity === jobCity) return 1.0;

    // Check if same country (simplified)
    const candidateCountry = candidateLocation.toLowerCase().split(',').pop().trim();
    const jobCountry = jobLocation.toLowerCase().split(',').pop().trim();

    if (candidateCountry === jobCountry) return 0.8;

    return 0.3;
  }

  // Calculate salary expectation match
  calculateSalaryMatch(candidateSalary, jobMin, jobMax) {
    if (!candidateSalary || (!jobMin && !jobMax)) return 0.7;

    // If job has salary range
    if (jobMin && jobMax) {
      if (candidateSalary >= jobMin && candidateSalary <= jobMax) return 1.0;
      if (candidateSalary < jobMin) return 0.8; // Willing to accept less
      if (candidateSalary > jobMax) return Math.max(0.3, 1.0 - ((candidateSalary - jobMax) / jobMax));
    }

    // If only minimum salary
    if (jobMin && candidateSalary >= jobMin) return 1.0;
    if (jobMin && candidateSalary < jobMin) return 0.8;

    return 0.7;
  }

  // Calculate job type preference match
  calculateJobTypeMatch(candidatePreference, jobType) {
    if (!candidatePreference) return 0.6;
    if (candidatePreference === jobType) return 1.0;
    
    // Some compatibility between types
    const compatibleTypes = {
      'full-time': ['full-time', 'contract'],
      'part-time': ['part-time', 'contract'],
      'contract': ['contract', 'full-time'],
      'remote': ['remote', 'full-time', 'part-time', 'contract'],
      'internship': ['internship', 'part-time']
    };

    return compatibleTypes[candidatePreference]?.includes(jobType) ? 0.8 : 0.4;
  }

  // Get recommendation level based on score
  getRecommendationLevel(score) {
    if (score >= 85) return 'excellent_match';
    if (score >= 70) return 'strong_match';
    if (score >= 55) return 'good_match';
    if (score >= 40) return 'potential_match';
    return 'weak_match';
  }

  // Identify strengths from match breakdown
  identifyStrengths(breakdown) {
    const strengths = [];
    
    Object.entries(breakdown).forEach(([key, data]) => {
      if (data.score >= 0.8) {
        strengths.push({
          area: key,
          score: data.score,
          description: this.getStrengthDescription(key, data.score)
        });
      }
    });

    return strengths;
  }

  // Identify gaps from match breakdown
  identifyGaps(breakdown) {
    const gaps = [];
    
    Object.entries(breakdown).forEach(([key, data]) => {
      if (data.score < 0.6) {
        gaps.push({
          area: key,
          score: data.score,
          description: this.getGapDescription(key, data.score),
          suggestions: this.getSuggestions(key)
        });
      }
    });

    return gaps;
  }

  // Get strength description
  getStrengthDescription(area, score) {
    const descriptions = {
      skills: `Strong skills alignment with job requirements`,
      experience: `Experience level matches perfectly`,
      education: `Educational background exceeds requirements`,
      location: `Excellent location compatibility`,
      salary: `Salary expectations align well with offer`,
      jobType: `Preferred job type matches perfectly`
    };
    return descriptions[area] || `Strong match in ${area}`;
  }

  // Get gap description
  getGapDescription(area, score) {
    const descriptions = {
      skills: `Skills gap with job requirements`,
      experience: `Experience level may not match requirements`,
      education: `Educational background below requirements`,
      location: `Location may not be ideal`,
      salary: `Salary expectations may not align`,
      jobType: `Job type preference mismatch`
    };
    return descriptions[area] || `Gap in ${area}`;
  }

  // Get suggestions for improvement
  getSuggestions(area) {
    const suggestions = {
      skills: [
        'Consider taking courses in missing technologies',
        'Highlight transferable skills in your resume',
        'Work on personal projects to gain experience'
      ],
      experience: [
        'Emphasize relevant project experience',
        'Consider junior or entry-level positions',
        'Highlight leadership and mentorship experience'
      ],
      education: [
        'Consider relevant certifications',
        'Highlight practical experience and achievements',
        'Show continuous learning through courses'
      ],
      location: [
        'Consider relocation possibilities',
        'Highlight remote work experience',
        'Emphasize willingness to travel'
      ],
      salary: [
        'Research industry salary standards',
        'Consider total compensation package',
        'Be flexible about negotiation'
      ],
      jobType: [
        'Be open to different work arrangements',
        'Highlight adaptability and flexibility',
        'Consider contract-to-hire opportunities'
      ]
    };
    return suggestions[area] || ['Review and update your profile'];
  }

  // Find best matching jobs for a candidate
  async findBestMatches(candidate, availableJobs, limit = 10) {
    const jobsWithScores = availableJobs.map(job => ({
      job,
      match: this.calculateMatchScore(candidate, job)
    }));

    // Sort by match score (highest first)
    jobsWithScores.sort((a, b) => b.match.overallScore - a.match.overallScore);

    return jobsWithScores.slice(0, limit);
  }

  // Find best matching candidates for a job
  async findBestCandidates(job, candidates, limit = 10) {
    const candidatesWithScores = candidates.map(candidate => ({
      candidate,
      match: this.calculateMatchScore(candidate, job)
    }));

    // Sort by match score (highest first)
    candidatesWithScores.sort((a, b) => b.match.overallScore - a.match.overallScore);

    return candidatesWithScores.slice(0, limit);
  }

  // Generate personalized recommendations
  generateRecommendations(matchResult) {
    const recommendations = [];

    if (matchResult.overallScore >= 70) {
      recommendations.push({
        type: 'application',
        priority: 'high',
        message: 'Strong match! We highly recommend applying for this position.',
        action: 'Apply Now'
      });
    } else if (matchResult.overallScore >= 55) {
      recommendations.push({
        type: 'application',
        priority: 'medium',
        message: 'Good match worth considering. Highlight your relevant experience.',
        action: 'Consider Applying'
      });
    } else {
      recommendations.push({
        type: 'improvement',
        priority: 'medium',
        message: 'Consider improving your profile before applying.',
        action: 'Update Profile'
      });
    }

    // Add specific recommendations based on gaps
    matchResult.gaps.forEach(gap => {
      if (gap.suggestions.length > 0) {
        recommendations.push({
          type: 'skill_development',
          priority: 'low',
          message: gap.suggestions[0],
          action: 'Learn More'
        });
      }
    });

    return recommendations;
  }
}

module.exports = new AIMatchingService();
