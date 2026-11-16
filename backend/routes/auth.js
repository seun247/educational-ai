const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const requireAuth = require('../middleware/auth');

const EMAIL_RE = /^\S+@\S+\.\S+$/;

// Auth endpoints are brute-force targets, so they get their own tight limiter
// separate from the general API one.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many attempts. Please wait a few minutes and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function signToken(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

function publicUser(user) {
  return { id: user._id, name: user.name, level: user.level, email: user.email };
}

// @route   POST /api/auth/register
// @access  Public
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { name, level, email, password } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Name is required.' });
    }
    if (!email || !EMAIL_RE.test(String(email))) {
      return res.status(400).json({ success: false, message: 'A valid email is required.' });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }

    const user = await User.create({
      name: String(name).trim(),
      level: typeof level === 'string' ? level.trim() : undefined,
      email: normalizedEmail,
      password: String(password),
    });

    res.status(201).json({ success: true, token: signToken(user), data: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// @route   POST /api/auth/login
// @access  Public
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user || !user.password) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const match = await user.comparePassword(String(password));
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    user.lastActiveAt = new Date();
    await user.save();

    res.status(200).json({ success: true, token: signToken(user), data: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// @route   GET /api/auth/me
// @desc    Return the logged-in user's profile (used to restore a session
//          from a stored token on page load).
// @access  Private
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.status(200).json({ success: true, data: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// @route   PUT /api/auth/me
// @desc    Update the logged-in user's name/level.
// @access  Private
router.put('/me', requireAuth, async (req, res, next) => {
  try {
    const { name, level } = req.body || {};
    const update = { lastActiveAt: new Date() };
    if (typeof name === 'string' && name.trim()) update.name = name.trim();
    if (typeof level === 'string') update.level = level.trim();

    const user = await User.findByIdAndUpdate(req.userId, update, { new: true, runValidators: true });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.status(200).json({ success: true, data: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
