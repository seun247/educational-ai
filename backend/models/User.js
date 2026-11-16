const mongoose = require('mongoose');

// EduAI has no password-based login — the frontend generates a random
// deviceId (crypto.randomUUID) on first visit and stores it in
// localStorage, then syncs the student's name/level here keyed by that
// id. This lets the registration the student already sees (name once,
// remembered after) also live server-side for basic usage visibility —
// it is still tied to one browser/device, not a portable account.
const UserSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    level: {
      type: String,
      trim: true,
      maxlength: [60, 'Level cannot exceed 60 characters'],
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
