const { chat } = require('./moonshot');
const supabase = require('../config/supabase');

/**
 * Response types the chat endpoint returns to the frontend.
 *
 *  answer       – Kimi answered using profile context
 *  no_info      – question is profile-related but no info found; ask user to suggest answer
 *  not_related  – question is not related to the profile at all
 *  memory_saved – a user-suggested answer was saved
 */

/**
 * Determine whether a question is related to a given profile using Kimi.
 * @param {string} profileName
 * @param {string} profileDescription
 * @param {string} question
 * @returns {Promise<boolean>}
 */
async function isProfileRelated(profileName, profileDescription, question) {
  const systemPrompt = `You are a strict classifier. A user is chatting with a profile called "${profileName}".
Profile description: ${profileDescription || 'No description provided.'}
Decide if the user's question is relevant to this profile.
Reply with exactly one word: YES or NO.`;

  const reply = await chat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ],
    { max_tokens: 5, temperature: 0 }
  );
  return reply.trim().toUpperCase().startsWith('Y');
}

/**
 * Main chatbot handler.
 * Uses context stuffing: all profile knowledge and memory is loaded and
 * injected directly into the system prompt, leveraging Kimi's 128k context window.
 *
 * @param {object} params
 * @param {string} params.profileId
 * @param {string} params.profileName
 * @param {string} params.profileDescription
 * @param {string} params.message           – the user's question
 * @param {string} [params.suggestedAnswer] – provided when user wants to save a Q&A pair
 * @param {string} params.userId
 * @param {string} params.sessionId
 * @returns {Promise<{type: string, content: string}>}
 */
async function handleChatMessage({
  profileId,
  profileName,
  profileDescription,
  message,
  suggestedAnswer,
  userId,
  sessionId,
}) {
  // ── Case: user is providing a suggested answer to save ──────────────────────
  if (suggestedAnswer) {
    const { error } = await supabase.from('profile_memory').insert({
      profile_id: profileId,
      question: message,
      answer: suggestedAnswer,
      suggested_by: userId,
    });

    if (error) throw error;

    await persistMessages(sessionId, message, `Got it! I've saved that answer and will remember it for next time.`);

    return {
      type: 'memory_saved',
      content: `Got it! I've saved that answer and will remember it for next time.`,
    };
  }

  // ── Persist user message ──────────────────────────────────────────────────────
  await supabase.from('chat_messages').insert({
    session_id: sessionId,
    role: 'user',
    content: message,
  });

  // ── Load all profile knowledge and memory (context stuffing) ─────────────────
  const [{ data: knowledge }, { data: memory }] = await Promise.all([
    supabase.from('profile_knowledge').select('content').eq('profile_id', profileId),
    supabase.from('profile_memory').select('question, answer').eq('profile_id', profileId),
  ]);

  const hasContext = (knowledge?.length > 0) || (memory?.length > 0);

  // ── Build context string ──────────────────────────────────────────────────────
  let contextBlock = '';
  if (hasContext) {
    const parts = [];
    (knowledge || []).forEach((r) => parts.push(`[Knowledge] ${r.content}`));
    (memory || []).forEach((r) => parts.push(`[Memory] Q: ${r.question}\nA: ${r.answer}`));
    contextBlock = parts.join('\n\n');
  }

  // ── If context found → answer using Kimi ─────────────────────────────────────
  if (hasContext) {
    const systemPrompt = `You are a concise AI assistant for the profile "${profileName}".
Answer the user's question ONLY using the context below.
Keep the answer short and direct.
If the context does not cover the question fully, say so briefly.

CONTEXT:
${contextBlock}`;

    const answer = await chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ]);

    await persistMessages(sessionId, null, answer);
    return { type: 'answer', content: answer };
  }

  // ── No context → classify whether the question is related to the profile ──────
  const related = await isProfileRelated(profileName, profileDescription, message);

  if (related) {
    const reply =
      `I don't have information about that yet. Would you like to remember an answer? ` +
      `If so, please provide the answer and I'll save it for future questions.`;
    await persistMessages(sessionId, null, reply);
    return { type: 'no_info', content: reply, askForSuggestion: true };
  }

  // ── Not related ────────────────────────────────────────────────────────────────
  const reply =
    `The question is not related to the profile "${profileName}". ` +
    `Would you like me to store this information in the profile?`;
  await persistMessages(sessionId, null, reply);
  return { type: 'not_related', content: reply, askForSuggestion: true };
}

/**
 * Helper: persist assistant message (and optionally a user message) to chat_messages.
 */
async function persistMessages(sessionId, userContent, assistantContent) {
  const rows = [];
  if (userContent) rows.push({ session_id: sessionId, role: 'user', content: userContent });
  if (assistantContent) rows.push({ session_id: sessionId, role: 'assistant', content: assistantContent });
  if (rows.length) await supabase.from('chat_messages').insert(rows);
}

module.exports = { handleChatMessage };
