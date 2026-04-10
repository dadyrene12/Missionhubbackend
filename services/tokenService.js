const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-missionhub-admin';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '365d';

const createToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, {
    expiresIn: JWT_EXPIRE
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

module.exports = { createToken, verifyToken, JWT_SECRET };
