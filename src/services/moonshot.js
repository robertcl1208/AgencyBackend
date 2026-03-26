const OpenAI = require('openai');

/**
 * Moonshot AI client (OpenAI-compatible API at api.moonshot.cn).
 * Used for both chat completions and embeddings.
 */
const moonshot = new OpenAI({
  apiKey: process.env.MOONSHOT_API_KEY,
  baseURL: 'https://api.moonshot.ai/v1',
});

const CHAT_MODEL = 'moonshot-v1-128k';
const EMBED_MODEL = 'moonshot-v1-embedding';

/**
 * Send a chat completion request to Kimi.
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} options – optional overrides (temperature, max_tokens, …)
 * @returns {Promise<string>} assistant reply text
 */
async function chat(messages, options = {}) {
  const response = await moonshot.chat.completions.create({
    model: CHAT_MODEL,
    messages,
    temperature: 0.3,
    max_tokens: 1024,
    ...options,
  });
  return response.choices[0].message.content;
}

/**
 * Generate a text embedding vector.
 * @param {string} text
 * @returns {Promise<number[]>} embedding array
 */
async function embed(text) {
  const response = await moonshot.embeddings.create({
    model: EMBED_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

module.exports = { chat, embed, CHAT_MODEL, EMBED_MODEL };
