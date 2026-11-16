require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const chatRoutes = require('./routes/chat');
const userRoutes = require('./routes/users');

connectDB();

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*',
  })
);
app.use(express.json({ limit: '200kb' }));

// General-purpose limiter for the whole API; /api/chat layers a tighter
// limiter of its own on top (see routes/chat.js) since that's the endpoint
// that actually spends the shared OpenRouter key's quota.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', generalLimiter);

app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'EduAI backend is running.' });
});

app.use('/api/chat', chatRoutes);
app.use('/api/users', userRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 EduAI backend running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});
