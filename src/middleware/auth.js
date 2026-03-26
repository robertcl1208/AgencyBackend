const supabase = require('../config/supabase');

/**
 * Verifies the Bearer JWT from the Authorization header.
 * Attaches { id, email, role } to req.user on success.
 */
module.exports = async function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.replace('Bearer ', '').trim();

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { data: userData, error: userErr } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('id', user.id)
    .single();

  if (userErr || !userData) {
    return res.status(401).json({ error: 'User not found in system' });
  }

  req.user = userData;
  next();
};
