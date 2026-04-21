const axios = require('axios');

class AIScreeningService {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.baseUrl = 'https://api.anthropic.com/v1';
    this.model = 'claude-3-5-sonnet-20241022';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000;

    console.log('[AI Screening] Service initialized');
  }

  setApiKey(apiKey) {
    if (apiKey) {
      this.apiKey = apiKey;
      console.log('[AI Screening] Custom API key set');
    }
  }

  setProvider(provider) {
    this.provider = provider;
    console.log('[AI Screening] Provider set to:', provider);
  }

  getCacheKey(candidateId, jobId) {
    return `${candidateId}_${jobId}`;
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async callClaudeAI(messages, temperature = 0.3) {
    if (!this.apiKey) {
      console.warn('[AI Screening] No Claude API key available');
      return null;
    }
    try {
      console.log('[AI Screening] Calling Claude API...');

      const systemMessage = messages.find(m => m.role === 'system')?.content || '';
      const userMessages = messages.filter(m => m.role === 'user');
      const userContent = userMessages.map(m => m.content).join('\n\n');

      const response = await axios.post(
        `${this.baseUrl}/messages`,
        {
          model: this.model,
          system: systemMessage,
          messages: [{ role: 'user', content: userContent }],
          temperature,
          max_tokens: 2000
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          },
          timeout: 30000
        }
      );

      return response.data.content[0].text;
    } catch (error) {
      console.error('[AI Screening] Claude API Error:', error.message);
      return null;
    }
  }

  async callGeminiAI(prompt, temperature = 0.3, customApiKey = null) {
    const apiKey = customApiKey || this.geminiApiKey || this.apiKey;
    if (!apiKey) {
      console.error('[AI Screening] No Gemini API key available');
      return null;
    }
    if (apiKey.length < 20) {
      console.error('[AI Screening] Invalid API key length:', apiKey.length);
      return null;
    }
    try {
      console.log('[AI Screening] Calling Gemini API with key:', apiKey.substring(0, 10) + '...');
      
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8t:generateContent?key=${apiKey}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: temperature || 0.3,
            maxOutputTokens: 2048,
            topP: 0.95,
            topK: 40
          }
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 45000
        }
      );

      console.log('[AI Screening] Gemini response received, status:', response.status);
      if (!response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.error('[AI Screening] No content in response:', response.data);
        return null;
      }
      return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('[AI Screening] Gemini API Error:', error.message);
      if (error.response) {
        console.error('[AI Screening] Response status:', error.response.status);
        console.error('[AI Screening] Response data:', JSON.stringify(error.response.data).substring(0, 500));
      }
      return null;
    }
  }

  async screenCandidate(candidate, job, provider = 'gemini', customApiKey = null) {
    const cacheKey = this.getCacheKey(
      candidate._id?.toString() || candidate.userId?._id?.toString(),
      job._id?.toString()
    );

    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const userProfile = candidate.userId?.profile || {};
    
    const candidateInfo = {
      name: candidate.userId?.name || candidate.name || candidate.applicantName || 'Unknown',
      email: candidate.userId?.email || candidate.email || candidate.applicantEmail || '',
      skills: userProfile.skills || candidate.skills || [],
      experience: userProfile.experience || candidate.experience || '',
      education: userProfile.education || candidate.education || '',
      title: userProfile.title || candidate.title || '',
      bio: userProfile.bio || candidate.bio || '',
      resume: typeof (candidate.resume || candidate.coverLetter || '') === 'string'
        ? (candidate.resume || candidate.coverLetter || '').substring(0, 1000)
        : '',
      experienceDetails: userProfile.experienceDetails || []
    };

    const jobInfo = {
      title: job.title || '',
      description: job.description || '',
      requirements: job.requirements || '',
      responsibilities: job.responsibilities || '',
      skills: job.skills || [],
      experience: job.experience || '',
      education: job.education || '',
      salaryMin: job.salaryMin || 0,
      salaryMax: job.salaryMax || 0,
      location: job.location || '',
      type: job.type || '',
      benefits: job.benefits || ''
    };

    const prompt = `You are an expert HR recruitment assistant. Analyze the following candidate for the job position and provide a detailed screening result in JSON format.

SCORING CRITERIA:
- Skills Match: 40%
- Experience: 30%
- Projects/Achievements: 20%
- Education: 10%

CANDIDATE:
- Name: ${candidateInfo.name}
- Email: ${candidateInfo.email}
- Skills: ${candidateInfo.skills.join(', ')}
- Experience: ${candidateInfo.experience}
- Education: ${candidateInfo.education}
- Current Title: ${candidateInfo.title}
- Bio: ${candidateInfo.bio}
- Resume: ${candidateInfo.resume}

JOB:
- Title: ${jobInfo.title}
- Description: ${jobInfo.description}
- Requirements: ${jobInfo.requirements}
- Responsibilities: ${jobInfo.responsibilities}
- Required Skills: ${jobInfo.skills.join(', ')}
- Experience Required: ${jobInfo.experience}
- Education Required: ${jobInfo.education}
- Location: ${jobInfo.location}
- Type: ${jobInfo.type}
- Benefits: ${jobInfo.benefits}

Provide a JSON response with these exact fields (scores should be weighted: Skills 40%, Experience 30%, Projects 20%, Education 10%):
{
  "overallScore": (0-100 weighted score),
  "skillsMatch": {
    "score": (0-100),
    "weightedScore": (score × 0.40),
    "matchedSkills": ["list of matched skills"],
    "missingSkills": ["list of missing skills"]
  },
  "experienceMatch": {
    "score": (0-100),
    "weightedScore": (score × 0.30),
    "yearsMatch": "years of experience match",
    "details": "brief explanation"
  },
  "projectsMatch": {
    "score": (0-100),
    "weightedScore": (score × 0.20),
    "relevantProjects": ["list of relevant projects"],
    "achievements": ["list of achievements"]
  },
  "educationMatch": {
    "score": (0-100),
    "weightedScore": (score × 0.10),
    "details": "education details"
  },
  "strengths": ["list of key candidate strengths (3-5)"],
  "weaknesses": ["list of weaknesses or gaps (if any)"],
  "selectionReason": "detailed reason why this candidate should be selected",
  "interviewQuestions": ["3-5 recommended interview questions"],
  "recommendation": "brief final recommendation"
}`;

    let result = null;
    
    if (provider === 'gemini') {
      result = await this.callGeminiAI(prompt, 0.3, customApiKey);
    } else {
      result = await this.callClaudeAI([
        { role: 'system', content: 'You are a professional HR screening assistant. Always respond with valid JSON.' },
        { role: 'user', content: prompt }
      ]);
    }

    if (!result) {
      const fallback = this.generateFallbackAnalysis(candidateInfo, jobInfo);
      return { ...fallback, isFallback: true };
    }

    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      const parsedResult = jsonMatch ? JSON.parse(jsonMatch[0]) : this.generateFallbackAnalysis(candidateInfo, jobInfo);

      const screeningResult = {
        ...parsedResult,
        provider: provider,
        candidateId: candidateInfo.name,
        candidateEmail: candidateInfo.email,
        jobId: jobInfo.title,
        screenedAt: new Date().toISOString()
      };

      this.setCache(cacheKey, screeningResult);
      return screeningResult;
    } catch (parseError) {
      console.error('[AI Screening] JSON parse error:', parseError.message);
      const fallback = this.generateFallbackAnalysis(candidateInfo, jobInfo);
      return { ...fallback, isFallback: true, screenedAt: new Date().toISOString() };
    }
  }

  generateFallbackAnalysis(candidateInfo, jobInfo) {
    const candidateSkills = (candidateInfo.skills || []).map(s => s.toLowerCase());
    const jobSkills = (jobInfo.skills || []).map(s => s.toLowerCase());
    
    const matchedSkills = jobSkills.filter(s => candidateSkills.some(cs => cs.includes(s) || s.includes(cs)));
    const missingSkills = jobSkills.filter(s => !candidateSkills.some(cs => cs.includes(s) || s.includes(cs)));
    
    const skillsScore = jobSkills.length > 0 ? Math.round((matchedSkills.length / jobSkills.length) * 100) : 50;
    const skillsWeighted = Math.round(skillsScore * 0.40);
    
    let experienceScore = 50;
    if (candidateInfo.experience && jobInfo.experience) {
      const expMatch = candidateInfo.experience.toLowerCase().includes(jobInfo.experience.toLowerCase()) ||
        jobInfo.experience.toLowerCase().includes(candidateInfo.experience.toLowerCase());
      experienceScore = expMatch ? 80 : 50;
    }
    const experienceWeighted = Math.round(experienceScore * 0.30);
    
    const projectsScore = candidateInfo.resume ? 75 : 40;
    const projectsWeighted = Math.round(projectsScore * 0.20);
    
    const educationScore = candidateInfo.education ? 75 : 40;
    const educationWeighted = Math.round(educationScore * 0.10);
    
    const overallScore = skillsWeighted + experienceWeighted + projectsWeighted + educationWeighted;
    
    const strengths = matchedSkills.length > 0 
      ? ['Skills match job requirements', 'Relevant experience', 'Strong background']
      : ['Eager to learn', 'Potential for growth'];
    
    const weaknesses = missingSkills.length > 0 
      ? ['Missing some key skills: ' + missingSkills.slice(0, 3).join(', ')]
      : [];
    
    const selectionReason = overallScore >= 70 
      ? `This candidate scored ${overallScore}/100 with strong skills match (${skillsScore}%) and relevant experience. Recommended for interview.`
      : `This candidate scored ${overallScore}/100. Consider for interview based on availability and specific requirements.`;
    
    return {
      overallScore,
      skillsMatch: {
        score: skillsScore,
        weightedScore: skillsWeighted,
        matchedSkills,
        missingSkills: missingSkills.slice(0, 3)
      },
      experienceMatch: {
        score: experienceScore,
        weightedScore: experienceWeighted,
        yearsMatch: candidateInfo.experience || 'Not specified',
        details: 'Based on available information'
      },
      projectsMatch: {
        score: projectsScore,
        weightedScore: projectsWeighted,
        relevantProjects: [],
        achievements: candidateInfo.resume ? ['Resume provided'] : []
      },
      educationMatch: {
        score: educationScore,
        weightedScore: educationWeighted,
        details: candidateInfo.education || 'Not specified'
      },
      strengths,
      weaknesses,
      selectionReason,
      interviewQuestions: [
        'Tell me about your experience with ' + (jobSkills[0] || 'the required skills'),
        'Describe a relevant project you worked on',
        'How do you handle challenging situations?',
        'Why are you interested in this role?',
        'What are your career goals for the next 2-3 years?'
      ],
      recommendation: overallScore >= 70 ? 'Strong candidate - recommend interview' : 'Consider for interview based on availability'
    };
  }
}

module.exports = new AIScreeningService();