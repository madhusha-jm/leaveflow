const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');
const httpError = require('../lib/httpError');

// 401 = "I don't know who you are". On success, req.user = { id, role }.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(httpError(401, 'NO_TOKEN', 'log in first'));
  try {
    const { id, role } = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    req.user = { id, role };
    next();
  } catch {
    next(httpError(401, 'BAD_TOKEN', 'invalid or expired token — log in again'));
  }
}

// 403 = "I know who you are, and no". Use after requireAuth.
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role)
    ? next()
    : next(httpError(403, 'FORBIDDEN', 'your role cannot do this'));

module.exports = { requireAuth, requireRole };
