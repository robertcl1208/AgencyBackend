const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const supabase = require('../config/supabase');
const { supabaseAuth } = require('../config/supabase');
const auth = require('../middleware/auth');

const router = Router();

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 1 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;

    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });

    const { data: userData, error: userFetchErr } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', data.user.id)
      .single();

    if (userFetchErr || !userData) {
      return res.status(401).json({
        error: 'User account is not fully set up. Please run the database schema and seed script, then try again.',
      });
    }

    return res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: userData,
    });
  }
);

// POST /api/auth/logout
router.post('/logout', auth, async (req, res) => {
  const token = req.headers.authorization.replace('Bearer ', '').trim();
  await supabase.auth.admin.signOut(token);
  return res.json({ message: 'Logged out' });
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  return res.json({ user: req.user });
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' });

  const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token });
  if (error) return res.status(401).json({ error: error.message });

  return res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
});

module.exports = router;
