const { embed } = require('./moonshot');

const CHUNK_SIZE = 800;     // characters per chunk
const CHUNK_OVERLAP = 100;  // overlap between consecutive chunks

/**
 * Split long text into overlapping chunks for embedding.
 * @param {string} text
 * @returns {string[]}
 */
function chunkText(text) {
  const cleaned = text.replace(/\r\n/g, '\n').trim();
  if (cleaned.length <= CHUNK_SIZE) return [cleaned];

  const chunks = [];
  let start = 0;
  while (start < cleaned.length) {
    const end = Math.min(start + CHUNK_SIZE, cleaned.length);
    chunks.push(cleaned.slice(start, end));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

/**
 * Generate embedding(s) for a piece of text.
 * For short text returns a single embedding.
 * For long text chunks it and returns an array of { chunk, embedding } objects.
 * @param {string} text
 * @returns {Promise<Array<{chunk: string, embedding: number[]}>>}
 */
async function generateEmbeddings(text) {
  const chunks = chunkText(text);
  const results = [];
  for (const chunk of chunks) {
    const embedding = await embed(chunk);
    results.push({ chunk, embedding });
  }
  return results;
}

/**
 * Generate a single embedding for a query string (no chunking).
 * @param {string} query
 * @returns {Promise<number[]>}
 */
async function generateQueryEmbedding(query) {
  return embed(query);
}

module.exports = { generateEmbeddings, generateQueryEmbedding, chunkText };
