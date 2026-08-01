// Quick script to create super admin - run with Node.js
// Usage: node setup-admin.js
// Creates/updates the super admin account in the database via the local backend.

const http = require('http');

const data = JSON.stringify({
  email: 'reneniyi@gmail.com',
  password: 'Dad43@43',
  name: 'Super Admin'
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/admin/force-create',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(data);
req.end();
