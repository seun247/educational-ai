const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const ChatLog = require('../models/ChatLog');

const MODEL = 'openrouter/free';
const TEMPERATURE = 0.7;
const MAX_TOKENS = 2048;
const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 20000;

// Chat is the expensive, abusable endpoint (it's the one spending the
// shared OpenRouter key's quota), so it gets its own tighter limiter on
// top of the general one in server.js.
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { success: false, error: { message: 'Too many requests. Please wait a few minutes and try again.' } },
  standardHeaders: true,
  legacyHeaders: false,
});

function writeChatLog(entry) {
  // Best-effort, non-blocking — a logging hiccup must never break a chat reply.
  ChatLog.create(entry).catch((err) => console.warn('⚠️  ChatLog write failed:', err.message));
}

// @route   POST /api/chat
// @desc    Proxy a chat completion to OpenRouter using the server-held key,
//          so the key is never shipped to the browser. The frontend already
//          builds the full `messages` array (system prompt + history +
//          question); this endpoint only adds the credential and forwards
//          it — model/temperature/max_tokens are fixed here, not trusted
//          from the client, so a crafted request can't demand an
//          expensive model or an unbounded response.
// @access  Public (rate-limited)
router.post('/', chatLimiter, async (req, res, next) => {
  const { messages, subject, deviceId } = req.body || {};
  const ipAddress = req.ip;

  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ success: false, error: { message: 'messages array is required.' } });
  }
  if (messages.length > MAX_MESSAGES) {
    return res.status(400).json({ success: false, error: { message: 'Too many messages in this request.' } });
  }
  for (const m of messages) {
    if (!m || typeof m.content !== 'string' || !['system', 'user', 'assistant'].includes(m.role)) {
      return res.status(400).json({ success: false, error: { message: 'Malformed message in request.' } });
    }
    if (m.content.length > MAX_MESSAGE_CHARS) {
      return res.status(400).json({ success: false, error: { message: 'A message is too long.' } });
    }
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(503).json({ success: false, error: { message: 'Server is not configured with an OpenRouter API key yet.' } });
  }

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.FRONTEND_URL || 'https://eduai.app',
        'X-Title': 'EduAI',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
      }),
    });

    const data = await upstream.json();

    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    writeChatLog({
      deviceId: typeof deviceId === 'string' ? deviceId.slice(0, 100) : undefined,
      subject: typeof subject === 'string' ? subject.slice(0, 60) : undefined,
      questionLength: lastUserMsg ? lastUserMsg.content.length : 0,
      status: data.error ? 'error' : 'success',
      errorMessage: data.error ? String(data.error.message || '').slice(0, 300) : undefined,
      ipAddress,
    });

    res.status(upstream.status).json(data);
  } catch (err) {
    writeChatLog({
      deviceId: typeof deviceId === 'string' ? deviceId.slice(0, 100) : undefined,
      subject: typeof subject === 'string' ? subject.slice(0, 60) : undefined,
      questionLength: 0,
      status: 'error',
      errorMessage: String(err.message || '').slice(0, 300),
      ipAddress,
    });
    next(err);
  }
});

module.exports = router;
