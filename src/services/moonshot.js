const OpenAI = require('openai');

/**
 * Moonshot AI client (OpenAI-compatible API at api.moonshot.cn).
 * Lazy singleton — created on first use so a missing MOONSHOT_API_KEY at
 * module load time does not crash the process before Express starts listening.
 */
let _moonshot = null;
function getMoonshot() {
  if (!_moonshot) {
    if (!process.env.MOONSHOT_API_KEY) {
      throw new Error('MOONSHOT_API_KEY env var is required');
    }
    _moonshot = new OpenAI({
      apiKey: process.env.MOONSHOT_API_KEY,
      baseURL: 'https://api.moonshot.ai/v1',
    });
  }
  return _moonshot;
}

const CHAT_MODEL = 'moonshot-v1-128k';
const EMBED_MODEL = 'moonshot-v1-embedding';

/**
 * Send a chat completion request to Kimi.
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} options – optional overrides (temperature, max_tokens, …)
 * @returns {Promise<string>} assistant reply text
 */
async function chat(messages, options = {}) {
  const response = await getMoonshot().chat.completions.create({
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
  const response = await getMoonshot().embeddings.create({
    model: EMBED_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

module.exports = { chat, embed, CHAT_MODEL, EMBED_MODEL };
