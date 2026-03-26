const { Router } = require('express');
const supabase = require('../../config/supabase');
const auth = require('../../middleware/auth');

const router = Router();
router.use(auth);

// GET /api/profiles  – list only profiles the user has permission for (admin sees all)
router.get('/', async (req, res) => {
  let query;

  if (req.user.role === 'admin') {
    query = supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
  } else {
    query = supabase
      .from('profile_permissions')
      .select('profile_id, profiles(*)')
      .eq('user_id', req.user.id);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const profiles =
    req.user.role === 'admin' ? data : data.map((r) => r.profiles);

  return res.json(profiles);
});

// GET /api/profiles/:id  – get single profile (permission-checked)
router.get('/:id', async (req, res) => {
  if (req.user.role !== 'admin') {
    const { data: perm } = await supabase
      .from('profile_permissions')
      .select('id')
      .eq('profile_id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!perm) return res.status(403).json({ error: 'Access denied' });
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Profile not found' });
  return res.json(data);
});

module.exports = router;
