const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const supabase = require('../../config/supabase');
const auth = require('../../middleware/auth');
const adminOnly = require('../../middleware/adminOnly');

const router = Router();
router.use(auth, adminOnly);

// GET /api/admin/users  – list all users
router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, role, created_at')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// POST /api/admin/users  – create a new user
router.post(
  '/',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('role').optional().isIn(['admin', 'user']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, role = 'user' } = req.body;

    // Create in Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authErr) return res.status(400).json({ error: authErr.message });

    // Upsert into public.users with desired role
    const { data: userData, error: userErr } = await supabase
      .from('users')
      .upsert({ id: authData.user.id, email, role })
      .select()
      .single();

    if (userErr) return res.status(500).json({ error: userErr.message });
    return res.status(201).json(userData);
  }
);

// PUT /api/admin/users/:id  – update email or role
router.put(
  '/:id',
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('role').optional().isIn(['admin', 'user']),
    body('password').optional().isLength({ min: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { id } = req.params;
    const { email, role, password } = req.body;

    // Update auth if email or password changed
    if (email || password) {
      const authUpdate = {};
      if (email) authUpdate.email = email;
      if (password) authUpdate.password = password;
      const { error: authErr } = await supabase.auth.admin.updateUserById(id, authUpdate);
      if (authErr) return res.status(400).json({ error: authErr.message });
    }

    // Update public.users
    const updates = {};
    if (email) updates.email = email;
    if (role) updates.role = role;

    if (Object.keys(updates).length === 0) {
      return res.json({ message: 'No public fields to update' });
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
);

// DELETE /api/admin/users/:id  – delete user
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  // Prevent self-deletion
  if (req.user.id === id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ message: 'User deleted' });
});

// GET /api/admin/users/:id/permissions  – list profile permissions for a user
router.get('/:id/permissions', async (req, res) => {
  const { data, error } = await supabase
    .from('profile_permissions')
    .select('profile_id, profiles(id, name, description)')
    .eq('user_id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// PUT /api/admin/users/:id/permissions  – replace full permission set for a user
router.put(
  '/:id/permissions',
  [body('profile_ids').isArray()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { id } = req.params;
    const { profile_ids } = req.body;

    // Delete existing permissions
    await supabase.from('profile_permissions').delete().eq('user_id', id);

    if (profile_ids.length > 0) {
      const rows = profile_ids.map((pid) => ({ user_id: id, profile_id: pid }));
      const { error } = await supabase.from('profile_permissions').insert(rows);
      if (error) return res.status(500).json({ error: error.message });
    }

    return res.json({ message: 'Permissions updated', profile_ids });
  }
);

module.exports = router;
