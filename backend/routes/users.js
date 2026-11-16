const express = require('express');
const router = express.Router();
const User = require('../models/User');

// @route   POST /api/users
// @desc    Create or update the profile tied to a deviceId (upsert). The
//          frontend calls this right after local registration completes, so
//          the name/level the student just typed is also visible server-side.
// @access  Public
router.post('/', async (req, res, next) => {
  try {
    const { deviceId, name, level } = req.body || {};

    if (!deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({ success: false, message: 'deviceId is required.' });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'name is required.' });
    }

    const user = await User.findOneAndUpdate(
      { deviceId },
      {
        deviceId,
        name: name.trim(),
        level: typeof level === 'string' ? level.trim() : undefined,
        lastActiveAt: new Date(),
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// @route   GET /api/users/:deviceId
// @desc    Fetch the profile tied to a deviceId.
// @access  Public
router.get('/:deviceId', async (req, res, next) => {
  try {
    const user = await User.findOne({ deviceId: req.params.deviceId });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No profile found for this device.' });
    }
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
