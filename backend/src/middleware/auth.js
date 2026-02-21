const jwt = require('jsonwebtoken');
const { Employee } = require('../models');
const { JWT_EXPIRATION_HOURS } = require('../config/constants');

const JWT_SECRET = process.env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex');

const createToken = (employee) => {
  const payload = {
    sub: employee.id,
    employee_id: employee.employee_id,
    role: employee.role,
    care_home_id: employee.care_home_id,
    exp: Math.floor(Date.now() / 1000) + (JWT_EXPIRATION_HOURS * 60 * 60)
  };
  return jwt.sign(payload, JWT_SECRET);
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw { status: 401, message: 'Token expired' };
    }
    throw { status: 401, message: 'Invalid token' };
  }
};

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ detail: 'Not authenticated' });
    }
    
    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    
    const employee = await Employee.findOne({ id: payload.sub }).lean();
    if (!employee) {
      return res.status(401).json({ detail: 'User not found' });
    }
    
    // Remove sensitive fields
    delete employee.pin_hash;
    delete employee.totp_secret;
    delete employee._id;
    delete employee.__v;
    
    req.user = employee;
    next();
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ detail: error.message });
    }
    return res.status(401).json({ detail: 'Authentication failed' });
  }
};

const requireRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ detail: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ detail: 'Not authorized' });
    }
    next();
  };
};

module.exports = {
  JWT_SECRET,
  createToken,
  verifyToken,
  authMiddleware,
  requireRoles
};
