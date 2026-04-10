const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Exam = require('../models/Exam');
const Activity = require('../models/Activity');
const User = require('../models/User');

const seedData = async () => {
  try {
    // Connect to DB
    await mongoose.connect('mongodb://127.0.0.1:27017/mission_hub');
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await Job.deleteMany({});
    await Application.deleteMany({});
    await Exam.deleteMany({});
    await Activity.deleteMany({});
    
    console.log('🧹 Cleared existing data');

    // Create test company user
    const companyPassword = await bcrypt.hash('company123', 10);
    const companyUser = await User.findOneAndUpdate(
      { email: 'testcompany@missionhub.com' },
      {
        name: 'Test Company Inc',
        email: 'testcompany@missionhub.com',
        password: companyPassword,
        userType: 'company',
        isVerified: true,
        profile: {
          phone: '+1 555 123 4567',
          location: 'San Francisco, CA',
          bio: 'Leading tech company seeking top talent',
          title: 'HR Manager',
          industry: 'Technology',
          company: 'Test Company Inc',
          yearsOfExperience: 10
        }
      },
      { upsert: true, new: true }
    );
    console.log('✅ Created company user:', companyUser.email);

    // Create test jobs
    const testJobs = await Job.insertMany([
      {
        title: 'Senior React Developer',
        company: 'Test Company Inc',
        location: 'San Francisco, CA',
        type: 'full-time',
        category: 'technology',
        experience: 'senior',
        salary: '$120k - $160k',
        salaryMin: 120000,
        salaryMax: 160000,
        description: 'Build scalable React applications...',
        skills: ['React', 'JavaScript', 'TypeScript', 'Node.js'],
        postedBy: companyUser._id,
        companyId: companyUser._id
      },
      {
        title: 'Frontend Engineer',
        company: 'Test Company Inc',
        location: 'Remote',
        type: 'remote',
        category: 'technology',
        experience: 'mid',
        salary: '$90k - $120k',
        salaryMin: 90000,
        salaryMax: 120000,
        description: 'Develop responsive UIs...',
        skills: ['React', 'Vue', 'CSS', 'Tailwind'],
        remote: true,
        postedBy: companyUser._id,
        companyId: companyUser._id
      }
    ]);
    console.log('✅ Created', testJobs.length, 'test jobs');

    // Create test applications
    await Application.insertMany([
      {
        jobId: testJobs[0]._id,
        userId: new mongoose.Types.ObjectId(),
        jobTitle: 'Senior React Developer',
        company: 'Test Company Inc',
        applicantName: 'John Doe',
        applicantEmail: 'john.doe@email.com',
        status: 'pending',
        companyId: companyUser._id
      },
      {
        jobId: testJobs[0]._id,
        userId: new mongoose.Types.ObjectId(),
        jobTitle: 'Senior React Developer',
        company: 'Test Company Inc',
        applicantName: 'Jane Smith',
        applicantEmail: 'jane.smith@email.com',
        status: 'approved',
        companyId: companyUser._id
      },
      {
        jobId: testJobs[1]._id,
        userId: new mongoose.Types.ObjectId(),
        jobTitle: 'Frontend Engineer',
        company: 'Test Company Inc',
        applicantName: 'Bob Johnson',
        applicantEmail: 'bob.johnson@email.com',
        status: 'reviewed',
        companyId: companyUser._id
      }
    ]);
    console.log('✅ Created test applications');

    // Create test exam
    await Exam.create({
      title: 'React Technical Assessment',
      description: '60-minute coding test',
      jobId: testJobs[0]._id,
      jobTitle: 'Senior React Developer',
      companyId: companyUser._id,
      type: 'coding',
      duration: 60,
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      time: '10:00 AM',
      instructions: 'Complete the coding challenges',
      candidates: { registered: 2, completed: 0 },
      status: 'published',
      postedBy: companyUser._id
    });
    console.log('✅ Created test exam');

    // Create test activity
    await Activity.create({
      title: 'Tech Hiring Workshop',
      description: 'Learn about our hiring process',
      location: 'Virtual',
      date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      time: '2:00 PM',
      type: 'webinar',
      tags: ['hiring', 'tech', 'react'],
      companyId: companyUser._id,
      postedBy: companyUser._id,
      maxAttendees: 50
    });
    console.log('✅ Created test activity');

    console.log('\n🎉 SEED COMPLETE!');
    console.log('📧 Company login: testcompany@missionhub.com / company123');
    console.log('🔗 Test endpoints:');
    console.log('   GET /api/jobs/company');
    console.log('   GET /api/applications/company');
    console.log('💡 Frontend will now load real data!');

  } catch (error) {
    console.error('❌ Seed error:', error);
  } finally {
    mongoose.connection.close();
  }
};

seedData();

