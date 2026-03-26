/**
 * Must be used after the auth middleware.
 * Allows only users with role === 'admin'.
 */
module.exports = function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};
