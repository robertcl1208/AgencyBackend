const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const supabase = require('../../config/supabase');
const auth = require('../../middleware/auth');
const { handleChatMessage } = require('../../services/chatbot');

const router = Router();
router.use(auth);

/**
 * Ensure the user has permission to access a profile.
 * Admins always pass.
 */
async function checkProfileAccess(profileId, userId, role) {
  if (role === 'admin') return true;
  const { data } = await supabase
    .from('profile_permissions')
    .select('id')
    .eq('profile_id', profileId)
    .eq('user_id', userId)
    .single();
  return !!data;
}

// POST /api/profiles/:id/sessions  – create or reuse a chat session
router.post('/:id/sessions', async (req, res) => {
  const profileId = req.params.id;

  const allowed = await checkProfileAccess(profileId, req.user.id, req.user.role);
  if (!allowed) return res.status(403).json({ error: 'Access denied' });

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({ profile_id: profileId, user_id: req.user.id })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
});

// GET /api/profiles/:id/sessions/:sessionId/messages  – load chat history
router.get('/:id/sessions/:sessionId/messages', async (req, res) => {
  const profileId = req.params.id;

  const allowed = await checkProfileAccess(profileId, req.user.id, req.user.role);
  if (!allowed) return res.status(403).json({ error: 'Access denied' });

  // Verify session belongs to this user & profile
  const { data: session } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('id', req.params.sessionId)
    .eq('profile_id', profileId)
    .eq('user_id', req.user.id)
    .single();

  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', req.params.sessionId)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// POST /api/profiles/:id/chat/message  – send a chat message
router.post(
  '/:id/chat/message',
  [
    body('message').isLength({ min: 1 }).trim(),
    body('session_id').isUUID(),
    body('suggested_answer').optional().isLength({ min: 1 }).trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const profileId = req.params.id;
    const allowed = await checkProfileAccess(profileId, req.user.id, req.user.role);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });

    // Load profile data
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('id, name, description')
      .eq('id', profileId)
      .single();

    if (pErr || !profile) return res.status(404).json({ error: 'Profile not found' });

    const { message, session_id, suggested_answer } = req.body;

    try {
      const result = await handleChatMessage({
        profileId: profile.id,
        profileName: profile.name,
        profileDescription: profile.description,
        message,
        suggestedAnswer: suggested_answer,
        userId: req.user.id,
        sessionId: session_id,
      });
      return res.json(result);
    } catch (err) {
      console.error('Chat error:', err);
      return res.status(500).json({ error: 'Chat service error: ' + err.message });
    }
  }
);

// POST /api/profiles/:id/memory  – user manually saves a Q&A pair
router.post(
  '/:id/memory',
  [
    body('question').isLength({ min: 1 }).trim(),
    body('answer').isLength({ min: 1 }).trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const profileId = req.params.id;
    const allowed = await checkProfileAccess(profileId, req.user.id, req.user.role);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });

    const { question, answer } = req.body;

    const { data, error } = await supabase
      .from('profile_memory')
      .insert({
        profile_id: profileId,
        question,
        answer,
        suggested_by: req.user.id,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }
);

module.exports = router;
