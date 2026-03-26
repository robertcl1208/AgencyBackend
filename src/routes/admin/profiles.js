const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const supabase = require('../../config/supabase');
const auth = require('../../middleware/auth');
const adminOnly = require('../../middleware/adminOnly');

const router = Router();
router.use(auth, adminOnly);

// GET /api/admin/profiles  – list all profiles
router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// POST /api/admin/profiles  – create profile
router.post(
  '/',
  [
    body('name').isLength({ min: 1 }).trim(),
    body('description').optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, description } = req.body;

    const { data, error } = await supabase
      .from('profiles')
      .insert({ name, description })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }
);

// PUT /api/admin/profiles/:id  – update profile
router.put(
  '/:id',
  [
    body('name').optional().isLength({ min: 1 }).trim(),
    body('description').optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const updates = {};
    ['name', 'description'].forEach((k) => {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    });

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
);

// DELETE /api/admin/profiles/:id  – delete profile (cascades knowledge/memory/sessions)
router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('profiles').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ message: 'Profile deleted' });
});

// ── Knowledge endpoints ──────────────────────────────────────────────────────

// GET /api/admin/profiles/:id/knowledge  – list knowledge items
router.get('/:id/knowledge', async (req, res) => {
  const { data, error } = await supabase
    .from('profile_knowledge')
    .select('id, content, metadata, created_at')
    .eq('profile_id', req.params.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// POST /api/admin/profiles/:id/knowledge  – add knowledge (AI analyzes & embeds)
router.post(
  '/:id/knowledge',
  [body('content').isLength({ min: 1 }).trim()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { content, metadata = {} } = req.body;
    const profileId = req.params.id;

    // Verify profile exists
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', profileId)
      .single();

    if (pErr || !profile) return res.status(404).json({ error: 'Profile not found' });

    const { data: inserted, error: insertErr } = await supabase
      .from('profile_knowledge')
      .insert({ profile_id: profileId, content, metadata })
      .select('id, content, metadata, created_at');

    if (insertErr) return res.status(500).json({ error: insertErr.message });
    return res.status(201).json(inserted);
  }
);

// DELETE /api/admin/profiles/:id/knowledge/:kid  – delete a knowledge item
router.delete('/:id/knowledge/:kid', async (req, res) => {
  const { error } = await supabase
    .from('profile_knowledge')
    .delete()
    .eq('id', req.params.kid)
    .eq('profile_id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ message: 'Knowledge item deleted' });
});

// ── Memory endpoints ─────────────────────────────────────────────────────────

// GET /api/admin/profiles/:id/memory  – list memory items
router.get('/:id/memory', async (req, res) => {
  const { data, error } = await supabase
    .from('profile_memory')
    .select('id, question, answer, suggested_by, created_at')
    .eq('profile_id', req.params.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// DELETE /api/admin/profiles/:id/memory/:mid  – delete a memory item
router.delete('/:id/memory/:mid', async (req, res) => {
  const { error } = await supabase
    .from('profile_memory')
    .delete()
    .eq('id', req.params.mid)
    .eq('profile_id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ message: 'Memory item deleted' });
});

// GET /api/admin/profiles/:id/users  – list users who can access this profile
router.get('/:id/users', async (req, res) => {
  const { data, error } = await supabase
    .from('profile_permissions')
    .select('user_id, users(id, email, role)')
    .eq('profile_id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

module.exports = router;
