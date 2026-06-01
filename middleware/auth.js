const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'eventease_secret_key_2024';

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token mungon. Ju lutemi hyni në sistem.' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token i pavlefshëm ose i skaduar. Hyni përsëri.' });
  }
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.roli)) {
      return res.status(403).json({ error: 'Nuk keni leje për këtë veprim.' });
    }
    next();
  };
}

module.exports = { authMiddleware, requireRole };
