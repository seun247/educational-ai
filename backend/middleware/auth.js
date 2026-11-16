const jwt = require('jsonwebtoken');

// Verifies the "Authorization: Bearer <token>" header and attaches the
// decoded user id to req.userId. Stateless — logout just means the
// frontend deletes its stored token, nothing to invalidate server-side.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Not authorized, invalid or expired token.' });
  }
}

module.exports = requireAuth;
