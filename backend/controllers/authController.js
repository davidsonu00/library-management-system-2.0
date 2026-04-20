const jwt = require('jsonwebtoken');
const { Admin } = require('../models');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const admin = await Admin.findOne({ where: { email } });
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    await admin.update({ last_login: new Date() });

    const token = generateToken(admin.admin_id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        admin: {
          id: admin.admin_id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          last_login: admin.last_login
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.admin.admin_id,
      name: req.admin.name,
      email: req.admin.email,
      role: req.admin.role,
      last_login: req.admin.last_login
    }
  });
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const admin = await Admin.findByPk(req.admin.admin_id);

    const isValid = await admin.comparePassword(currentPassword);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    await admin.update({ password: newPassword });
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { login, getProfile, changePassword };
