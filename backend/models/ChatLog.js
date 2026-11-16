const mongoose = require('mongoose');

// Lightweight usage metadata only — deliberately NOT storing the full
// question/answer text. Students may be minors, and this log exists for
// rate-limiting/abuse visibility (which device is sending how many
// requests, for which subjects, how often errors happen), not for
// building a transcript of what anyone asked.
const ChatLogSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      index: true,
    },
    subject: {
      type: String,
      trim: true,
    },
    questionLength: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['success', 'error'],
      default: 'success',
    },
    errorMessage: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
  },
  { timestamps: true }
);

ChatLogSchema.index({ deviceId: 1, createdAt: -1 });
// Auto-expire after 90 days so this stays a rolling usage window, not an
// ever-growing store.
ChatLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.model('ChatLog', ChatLogSchema);
