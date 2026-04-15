const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import User model
const User = require('../models/User');

// Database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/missionhub');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

// Create Super Admin
const createSuperAdmin = async () => {
  try {
    console.log('🔍 Checking for existing super admin...');
    
    // Check if super admin already exists
    const existingAdmin = await User.findOne({ role: 'super_admin' });
    if (existingAdmin) {
      console.log('✅ Super admin already exists:', existingAdmin.email);
      return;
    }

    console.log('👤 Creating super admin account...');

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('Dad43@43', salt);

    // Create super admin
    const superAdmin = new User({
      name: 'Super Admin',
      email: 'nexoratech40@gmail.com',
      password: hashedPassword,
      userType: 'super_admin',
      role: 'super_admin',
      isActive: true,
      emailVerified: true,
      isVerified: true,
      permissions: [
        'manage_users',
        'manage_companies',
        'manage_jobs',
        'manage_applications',
        'manage_exams',
        'manage_activities',
        'manage_payments',
        'system_settings',
        'view_analytics'
      ]
    });

    await superAdmin.save();

    console.log('✅ Super admin created successfully!');
    console.log('📧 Email: nexoratech40@gmail.com');
    console.log('🔑 Password: Dad43@43');
    console.log('🌐 Login URL: http://localhost:3000/admin/login');
    console.log('');
    console.log('🔐 You can now login to the admin dashboard!');

  } catch (error) {
    console.error('❌ Error creating super admin:', error);
  }
};

// Run the script
const runScript = async () => {
  try {
    await connectDB();
    await createSuperAdmin();
    process.exit(0);
  } catch (error) {
    console.error('❌ Script error:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
  process.exit(1);
});

// Run the script
runScript();
