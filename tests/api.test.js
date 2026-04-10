const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Test configuration
const API_URL = process.env.TEST_API_URL || 'http://localhost:5000/api';
let authToken = '';
let testUserId = '';
let testJobId = '';

describe('MissionHub API Tests', () => {
  const testUser = {
    name: 'Test User',
    email: `test${Date.now()}@example.com`,
    password: 'TestPass123!',
    userType: 'jobSeeker'
  };

  const testCompany = {
    name: 'Test Company',
    email: `company${Date.now()}@example.com`,
    password: 'TestPass123!',
    userType: 'company'
  };

  describe('Authentication', () => {
    test('POST /auth/register - Register new job seeker', async () => {
      const response = await request(API_URL)
        .post('/auth/register')
        .send(testUser);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toHaveProperty('email', testUser.email);
    });

    test('POST /auth/register - Register new company', async () => {
      const response = await request(API_URL)
        .post('/auth/register')
        .send(testCompany);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.user.userType).toBe('company');
    });

    test('POST /auth/register - Invalid email', async () => {
      const response = await request(API_URL)
        .post('/auth/register')
        .send({
          ...testUser,
          email: 'invalid-email'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('POST /auth/register - Short password', async () => {
      const response = await request(API_URL)
        .post('/auth/register')
        .send({
          ...testUser,
          password: 'short'
        });

      expect(response.status).toBe(400);
    });

    test('POST /auth/login - Successful login', async () => {
      const response = await request(API_URL)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('token');
      
      authToken = response.body.token;
      testUserId = response.body.user.id;
    });

    test('POST /auth/login - Invalid credentials', async () => {
      const response = await request(API_URL)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Jobs', () => {
    let companyToken = '';
    let companyUserId = '';

    beforeAll(async () => {
      const loginResponse = await request(API_URL)
        .post('/auth/login')
        .send({
          email: testCompany.email,
          password: testCompany.password
        });
      
      companyToken = loginResponse.body.token;
      companyUserId = loginResponse.body.user.id;
    });

    test('GET /jobs - List all jobs (public)', async () => {
      const response = await request(API_URL)
        .get('/jobs');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('jobs');
    });

    test('GET /jobs - Filter by category', async () => {
      const response = await request(API_URL)
        .get('/jobs?category=technology');

      expect(response.status).toBe(200);
    });

    test('GET /jobs - Filter by location', async () => {
      const response = await request(API_URL)
        .get('/jobs?location=Remote');

      expect(response.status).toBe(200);
    });

    test('POST /jobs - Create job (company only)', async () => {
      const response = await request(API_URL)
        .post('/jobs')
        .set('Authorization', `Bearer ${companyToken}`)
        .send({
          title: 'Software Engineer',
          company: 'Test Company',
          location: 'Remote',
          type: 'full-time',
          category: 'technology',
          experience: 'mid',
          description: 'Great opportunity for a skilled developer'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.job).toHaveProperty('title', 'Software Engineer');
      
      testJobId = response.body.job._id;
    });

    test('POST /jobs - Unauthorized (no token)', async () => {
      const response = await request(API_URL)
        .post('/jobs')
        .send({
          title: 'Test Job',
          company: 'Test Company',
          location: 'Test Location',
          description: 'Test description'
        });

      expect(response.status).toBe(401);
    });

    test('POST /jobs - Forbidden (job seeker)', async () => {
      const response = await request(API_URL)
        .post('/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Job',
          company: 'Test Company',
          location: 'Test Location',
          description: 'Test description'
        });

      expect(response.status).toBe(403);
    });

    test('GET /jobs/:id - Get single job', async () => {
      const response = await request(API_URL)
        .get(`/jobs/${testJobId}`);

      expect(response.status).toBe(200);
      expect(response.body.job).toHaveProperty('title');
    });

    test('PUT /jobs/:id - Update job (owner only)', async () => {
      const response = await request(API_URL)
        .put(`/jobs/${testJobId}`)
        .set('Authorization', `Bearer ${companyToken}`)
        .send({
          title: 'Senior Software Engineer',
          description: 'Updated description'
        });

      expect(response.status).toBe(200);
      expect(response.body.job.title).toBe('Senior Software Engineer');
    });

    test('DELETE /jobs/:id - Delete job (owner only)', async () => {
      const response = await request(API_URL)
        .delete(`/jobs/${testJobId}`)
        .set('Authorization', `Bearer ${companyToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('Applications', () => {
    let companyToken = '';
    let testJobId = '';

    beforeAll(async () => {
      const loginResponse = await request(API_URL)
        .post('/auth/login')
        .send({
          email: testCompany.email,
          password: testCompany.password
        });
      
      companyToken = loginResponse.body.token;

      const jobResponse = await request(API_URL)
        .post('/jobs')
        .set('Authorization', `Bearer ${companyToken}`)
        .send({
          title: 'Test Position',
          company: 'Test Company',
          location: 'Remote',
          type: 'full-time',
          category: 'technology',
          experience: 'mid',
          description: 'Test job for applications'
        });
      
      testJobId = jobResponse.body.job._id;
    });

    test('POST /applications - Apply for job', async () => {
      const response = await request(API_URL)
        .post('/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          jobId: testJobId,
          coverLetter: 'I am interested in this position'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.application).toHaveProperty('status', 'pending');
    });

    test('POST /applications - Duplicate application', async () => {
      const response = await request(API_URL)
        .post('/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          jobId: testJobId,
          coverLetter: 'Second application'
        });

      expect(response.status).toBe(400);
    });

    test('GET /applications/my-applications - Get user applications', async () => {
      const response = await request(API_URL)
        .get('/applications/my-applications')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.applications)).toBe(true);
    });

    test('GET /applications/for-my-jobs - Get job applications (company)', async () => {
      const response = await request(API_URL)
        .get('/applications/for-my-jobs')
        .set('Authorization', `Bearer ${companyToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Messages', () => {
    let companyToken = '';
    let companyUserId = '';
    let jobSeekerToken = '';
    let jobSeekerUserId = '';

    beforeAll(async () => {
      const companyLogin = await request(API_URL)
        .post('/auth/login')
        .send({
          email: testCompany.email,
          password: testCompany.password
        });
      companyToken = companyLogin.body.token;
      companyUserId = companyLogin.body.user.id;

      const seekerLogin = await request(API_URL)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      jobSeekerToken = seekerLogin.body.token;
      jobSeekerUserId = seekerLogin.body.user.id;
    });

    test('POST /messages - Send message', async () => {
      const response = await request(API_URL)
        .post('/messages')
        .set('Authorization', `Bearer ${jobSeekerToken}`)
        .send({
          toUserId: companyUserId,
          subject: 'Inquiry about position',
          body: 'I would like to know more about this opportunity'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    test('GET /messages - Get user messages', async () => {
      const response = await request(API_URL)
        .get('/messages')
        .set('Authorization', `Bearer ${companyToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    test('GET /messages/unread-count - Get unread count', async () => {
      const response = await request(API_URL)
        .get('/messages/unread-count')
        .set('Authorization', `Bearer ${companyToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('unreadCount');
    });
  });
});