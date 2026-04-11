// Quick script to create super admin - run with Node.js
// Usage: node setup-admin.js

const https = require('https');

const data = JSON.stringify({
  email: 'nexoratech40@gmail.com',
  password: 'Dad43@43',
  name: 'Super Admin'
});

const options = {
  hostname: 'missionhubbackend.onrender.com',
  port: 443,
  path: '/api/auth/admin/force-create',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Response:', body);
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(data);
req.end();
