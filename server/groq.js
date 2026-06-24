// ═══════════════════════════════════════════════════════════════
// AI PROXY — the ONLY place the Groq API key is used.
// The browser calls our own /api/ai/* routes; this file calls Groq.
// The key never leaves the server. Rate-limited to prevent abuse.
// ═══════════════════════════════════════════════════════════════
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';

async function callGroq({ messages, max_tokens = 500, temperature = 0.75 }) {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error('GROQ_API_KEY is not set on the server. AI features are disabled until it is configured in .env.');
  }

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model: MODEL, max_tokens, temperature, messages }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Groq API error ${res.status}: ${errBody.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq returned no content');
  return content.trim();
}

module.exports = { callGroq };
