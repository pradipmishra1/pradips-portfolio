// ═══════════════════════════════════════════════════════════════
// AI ROUTES — all browser AI requests come here, server calls Groq.
// Consolidates what used to be TWO separate widgets (brief generator
// in index.html + full assistant in chat.js) into one set of
// endpoints, each rate-limited to control cost/abuse. System prompt
// now pulls real services/pricing/portfolio data from the database
// instead of hardcoded text, so answers stay accurate as you edit
// content through the admin panel.
// ═══════════════════════════════════════════════════════════════
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { callGroq } = require('./groq');
const db = require('./db');

// Generous enough for real visitors, tight enough to block scripted abuse
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests — please wait a few minutes and try again.' },
});
router.use(aiLimiter);

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM site_settings').all();
  const s = {};
  rows.forEach(r => s[r.key] = r.value);
  return s;
}

function buildSystemPrompt() {
  const s = getSettings();

  const services = db.prepare('SELECT title, description FROM services ORDER BY sort_order ASC, id ASC').all();
  const plans = db.prepare('SELECT name, price, tagline FROM pricing_plans ORDER BY sort_order ASC, id ASC').all();
  const projectCount = db.prepare('SELECT COUNT(*) c FROM projects').get().c;
  const categories = db.prepare('SELECT DISTINCT category FROM projects').all().map(r => r.category);

  const servicesText = services.length
    ? services.map(sv => `- ${sv.title}${sv.description ? ': ' + sv.description : ''}`).join('\n')
    : '- Currently being updated — direct the client to ask Pradip directly for current offerings.';

  const pricingText = plans.length
    ? plans.map(p => `- ${p.name}: ${p.price}${p.tagline ? ' (' + p.tagline + ')' : ''}`).join('\n')
    : '- Pricing is being updated — direct the client to ask Pradip directly for a quote.';

  const portfolioText = projectCount > 0
    ? `Pradip has ${projectCount} project(s) in his portfolio, covering: ${categories.join(', ') || 'various categories'}.`
    : `Pradip's portfolio is being freshly stocked right now — invite the client to check back soon or ask to see examples directly.`;

  return `You are Pradip Mishra's smart AI assistant, embedded on his portfolio website. IMPORTANT: Always reply in English only, regardless of what language the user writes in.

You help potential clients learn about Pradip's services and guide them to hire him. Base your answers about services, pricing, and portfolio ONLY on the real data below — it reflects what's currently live on the site, so never invent prices or services not listed here.

ABOUT PRADIP MISHRA:
- Graphic Designer & Web Developer from Nepal
- BCA Student, freelance experience
- Email: ${s.email || 'business.tetsuo@gmail.com'} | WhatsApp: +${s.whatsapp || '9779843122166'}
- Responds within 24 hours

CURRENT SERVICES:
${servicesText}

CURRENT PRICING:
${pricingText}

PORTFOLIO:
${portfolioText}

LEAD CAPTURE: If the conversation suggests genuine interest in hiring (the client describes a project, asks about availability, or says something like "I want to hire him"), naturally ask for their name and a way to reach them (WhatsApp number or email) so Pradip can follow up — but only ask once per conversation, and don't be pushy about it if they decline.

PERSONALITY: Warm, friendly, professional. Use emojis occasionally. Keep responses 3-5 sentences. Always end with a WhatsApp/email call to action when relevant. Speak about Pradip in third person.`;
}

// ── General chat (the floating assistant widget) ──
router.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }
    // Cap history length sent to the model to control token cost
    const trimmed = messages.slice(-14);
    const reply = await callGroq({
      messages: [{ role: 'system', content: buildSystemPrompt() }, ...trimmed],
      max_tokens: 450,
    });
    res.json({ reply });
  } catch (e) {
    console.error('AI chat error:', e.message);
    res.status(503).json({ error: 'AI is temporarily unavailable. Please WhatsApp Pradip directly.' });
  }
});

// ── Project brief generator ──
router.post('/brief', async (req, res) => {
  try {
    const { name, email, service, budget, deadline, description } = req.body;
    if (!name || !service || !description) {
      return res.status(400).json({ error: 'Name, service, and description are required' });
    }
    const reply = await callGroq({
      messages: [
        { role: 'system', content: 'You are a professional project brief writer for Pradip Mishra. Write structured briefs with these exact section headers in ALL CAPS: PROJECT OVERVIEW, DELIVERABLES, TIMELINE & BUDGET, STYLE NOTES, NEXT STEPS. 2-3 sentences each. No markdown.' },
        { role: 'user', content: `Write a brief.\nClient: ${name}\nEmail: ${email || 'Not provided'}\nService: ${service}\nBudget: ${budget || 'Not specified'}\nDeadline: ${deadline || 'Not specified'}\nProject: ${description}` },
      ],
      max_tokens: 700,
    });
    res.json({ reply });
  } catch (e) {
    console.error('AI brief error:', e.message);
    res.status(503).json({ error: 'AI is temporarily unavailable. Please try again shortly.' });
  }
});

// ── Logo concept generator ──
router.post('/logo-concept', async (req, res) => {
  try {
    const { brand, industry, style, values } = req.body;
    if (!brand || !industry) return res.status(400).json({ error: 'Brand and industry are required' });
    const reply = await callGroq({
      messages: [{ role: 'user', content: `Create a detailed logo design brief for:\nBrand: ${brand}\nIndustry: ${industry}\nStyle: ${style || 'modern and minimal'}\nValues: ${values || 'not specified'}\n\nProvide:\n1. Logo concept description (shape, icon idea)\n2. Color palette (3 colors with hex codes)\n3. Typography recommendation (font style)\n4. Symbol/icon suggestion\n5. Overall mood and feeling\n\nBe specific and creative. Format clearly.` }],
      max_tokens: 550,
    });
    res.json({ reply });
  } catch (e) {
    res.status(503).json({ error: 'AI temporarily unavailable.' });
  }
});

// ── Brand name generator ──
router.post('/brand-name', async (req, res) => {
  try {
    const { desc, audience, vibe } = req.body;
    if (!desc) return res.status(400).json({ error: 'Business description is required' });
    const reply = await callGroq({
      messages: [{ role: 'user', content: `Generate 5 creative brand names for this business:\nBusiness: ${desc}\nTarget audience: ${audience || 'general'}\nVibe: ${vibe || 'modern and catchy'}\n\nFor each name:\n1. The brand name\n2. Why it works (1 sentence)\n3. Domain availability tip\n\nMake them unique, memorable and available as .com domains. Number 1-5.` }],
      max_tokens: 500,
    });
    res.json({ reply });
  } catch (e) {
    res.status(503).json({ error: 'AI temporarily unavailable.' });
  }
});

// ── Color palette generator ──
router.post('/palette', async (req, res) => {
  try {
    const { brand, mood, industry } = req.body;
    if (!brand) return res.status(400).json({ error: 'Brand description is required' });
    const reply = await callGroq({
      messages: [{ role: 'user', content: `Create 3 color palette options for:\nBrand: ${brand}\nMood: ${mood || 'energetic and bold'}\nIndustry: ${industry || 'general'}\n\nFor EACH palette provide:\n- Palette name\n- Primary color: name + exact hex code\n- Secondary color: name + exact hex code\n- Accent color: name + exact hex code\n- Background color: name + exact hex code\n- Why this palette works for this brand\n\nFormat clearly with palette numbers 1, 2, 3.` }],
      max_tokens: 600,
    });
    res.json({ reply });
  } catch (e) {
    res.status(503).json({ error: 'AI temporarily unavailable.' });
  }
});

// ── Cold pitch writer ──
router.post('/pitch', async (req, res) => {
  try {
    const { target, service, note } = req.body;
    if (!target) return res.status(400).json({ error: 'Target name is required' });
    const s = getSettings();
    const reply = await callGroq({
      messages: [{ role: 'user', content: `Write a professional cold outreach message from Pradip Mishra (graphic designer from Nepal) to ${target}.\nService offering: ${service || 'design services'}\nExtra note: ${note || 'none'}\n\nPradip's WhatsApp: +${s.whatsapp || '9779843122166'}\n\nWrite a short, personalized, non-spammy outreach message (150-200 words). Make it feel genuine. Include:\n- Personalized opening mentioning their work\n- Brief introduction of Pradip\n- Specific value proposition\n- Call to action\n- Professional closing\n\nFormat as a ready-to-send message.` }],
      max_tokens: 500,
    });
    res.json({ reply });
  } catch (e) {
    res.status(503).json({ error: 'AI temporarily unavailable.' });
  }
});

// ── Design critique ──
router.post('/critique', async (req, res) => {
  try {
    const { type, desc, goal } = req.body;
    if (!desc) return res.status(400).json({ error: 'Design description is required' });
    const reply = await callGroq({
      messages: [{ role: 'user', content: `You are a professional design critic. Critique this ${type || 'design'}:\nDescription: ${desc}\nPurpose: ${goal || 'not specified'}\n\nProvide:\n1. Overall score (X/10) with reasoning\n2. What's working well (2-3 points)\n3. What needs improvement (3-4 specific issues)\n4. Quick fixes Pradip could do\n5. One major redesign recommendation\n\nBe honest, specific, and constructive. Reference design principles.` }],
      max_tokens: 600,
    });
    res.json({ reply });
  } catch (e) {
    res.status(503).json({ error: 'AI temporarily unavailable.' });
  }
});

// ── Contract generator ──
router.post('/contract', async (req, res) => {
  try {
    const { client, service, price, deadline, revisions } = req.body;
    if (!client || !price || !deadline) return res.status(400).json({ error: 'Client, price, and deadline are required' });
    const s = getSettings();
    const reply = await callGroq({
      messages: [{ role: 'user', content: `Generate a simple freelance project agreement between:\nDesigner: Pradip Mishra (${s.email || ''}, +${s.whatsapp || ''})\nClient: ${client}\nService: ${service || 'Design Services'}\nPrice: ${price}\nDelivery: ${deadline}\nRevisions: ${revisions || '2'}\nDate: ${new Date().toLocaleDateString()}\n\nInclude sections: Project Scope, Payment Terms, Delivery Timeline, Revision Policy, Ownership Rights, Cancellation Policy. Keep it simple and clear. Professional but easy to understand.` }],
      max_tokens: 700,
    });
    res.json({ reply });
  } catch (e) {
    res.status(503).json({ error: 'AI temporarily unavailable.' });
  }
});

// ── Recommendation engine ──
router.post('/recommend', async (req, res) => {
  try {
    const { goal, budget } = req.body;
    if (!goal || !budget) return res.status(400).json({ error: 'Goal and budget are required' });
    const plans = db.prepare('SELECT name, price, tagline FROM pricing_plans ORDER BY sort_order ASC, id ASC').all();
    const pricingText = plans.length
      ? plans.map(p => `${p.name} (${p.price}${p.tagline ? ', ' + p.tagline : ''})`).join('; ')
      : 'pricing available on request';
    const reply = await callGroq({
      messages: [{ role: 'user', content: `Client goal: "${goal}". Budget: "${budget}". Available packages: ${pricingText}. Recommend ONE specific package from the list that best fits. Be specific in 3-4 sentences. Start with the package name. End with "WhatsApp Pradip to get started!"` }],
      max_tokens: 300,
    });
    res.json({ reply });
  } catch (e) {
    res.status(503).json({ error: 'AI temporarily unavailable.' });
  }
});

// ── Availability confirmation message ──
router.post('/availability', async (req, res) => {
  try {
    const { date, service } = req.body;
    if (!date || !service) return res.status(400).json({ error: 'Date and service are required' });
    const reply = await callGroq({
      messages: [{ role: 'user', content: `A client wants to start a "${service}" project on ${date}. Write a friendly availability confirmation message from Pradip Mishra. Include: confirmation that he's available on that date, estimated completion date based on the service timeline, what to do next (WhatsApp him). Keep it short and warm (3-4 sentences).` }],
      max_tokens: 250,
    });
    res.json({ reply });
  } catch (e) {
    res.status(503).json({ error: 'AI temporarily unavailable.' });
  }
});

module.exports = router;