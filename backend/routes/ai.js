'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { chat, status } = require('../controllers/aiController');
const { authenticate } = require('../middleware/auth');
const { detectIntent } = require('../services/localAssistantService');

const router = express.Router();

const limitReached = (message) => (req, res) =>
  res.status(429).json({ success: false, code: 'RATE_LIMITED', message });

// Keyed by the authenticated admin (not IP), so it also works behind proxies.
// In-memory store: counters reset when the server restarts and are per server instance.
const byAdmin = (req) => `admin:${req.admin.admin_id}`;

const perMinute = rateLimit({
  windowMs: 60 * 1000,
  limit: parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE, 10) || 10,
  keyGenerator: byAdmin,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: limitReached('You are sending questions too quickly. Please wait a moment and try again.'),
});

const perDay = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: parseInt(process.env.AI_RATE_LIMIT_PER_DAY, 10) || 200,
  keyGenerator: byAdmin,
  standardHeaders: false,
  legacyHeaders: false,
  handler: limitReached('The daily AI question limit has been reached. Please try again tomorrow.'),
});

// Authentication first: every AI route requires a valid librarian JWT.
router.use(authenticate);

router.get('/status', status);
const applyAiLimits = (req, res, next) => {
  if (detectIntent(req.body && req.body.message)) return next();
  return perMinute(req, res, (minuteError) => {
    if (minuteError) return next(minuteError);
    return perDay(req, res, next);
  });
};

router.post('/chat', applyAiLimits, chat);

module.exports = router;
