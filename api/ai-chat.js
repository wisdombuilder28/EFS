// ============================================================
// VERCEL API FUNCTION: ai-chat
// File location: /api/ai-chat.js
//
// ENVIRONMENT VARIABLES — set in Vercel dashboard:
//   GROQ_API_KEY
//   GEMINI_API_KEY
//   OPENROUTER_API_KEY
// ============================================================

const answerCache  = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

const getCached = (key) => {
    const entry = answerCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) { answerCache.delete(key); return null; }
    return entry.value;
};

const setCache = (key, value) => {
    if (answerCache.size >= 500) answerCache.delete(answerCache.keys().next().value);
    answerCache.set(key, { value, timestamp: Date.now() });
};

const rateLimitMap = new Map();
const isRateLimited = (ip) => {
    const now   = Date.now();
    const entry = rateLimitMap.get(ip) || { count: 0, windowStart: now };
    if (now - entry.windowStart > 60000) { entry.count = 0; entry.windowStart = now; }
    entry.count++;
    rateLimitMap.set(ip, entry);
    return entry.count > 20;
};

const SCHOOL_CONTEXT = `
You are the official AI assistant for Emeakaroha Foundation School.
Be friendly, professional, and use emojis where appropriate.
Answer any question of any kind and any kind and type if question that is given to you.

JOB 1 — ACADEMIC TUTOR:
Answer ALL general knowledge, academic, science, math, history, or study questions
fully and helpfully. Never refuse an academic question.

JOB 2 — SCHOOL RECEPTIONIST:
For questions specifically about Emeakaroha Foundation School use ONLY these facts:
- Fees: User should ask the school management/staff and/or check the news section 
- Resumption: User should ask the school management/staff and/or check the news section 
- Midterm Break: User should ask the school management/staff and/or check the news section 
- Location: Ikpenwafor, Ikperejere, Ihitte/Uboma LGA, Imo State, Nigeria
- Principal: Mr. Livinus Chukwuebeuka Okpodike.
- Founder: Rev.Fr Emeka Emakaroha.
- Developers: UGOCHUKWU WISDOM.E. (+2347 0633 76182) and OGOKE TOCHUKWU.E (+2348 03373 2253)

If a school-specific question is not covered above, apologize and direct the user
to contact the school administration. This rule does NOT apply to academic questions.
`.trim();

const tryGroq = async (messages) => {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY not configured');
    const res  = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'system', content: SCHOOL_CONTEXT }, ...messages], max_tokens: 800, temperature: 0.7 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Groq HTTP ${res.status}`);
    if (!data.choices?.[0]?.message?.content) throw new Error('Groq: empty response');
    return data.choices[0].message.content.trim();
};

const tryGemini = async (messages) => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY not configured');
    const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    while (contents.length && contents[0].role !== 'user') contents.shift();
    if (!contents.length) throw new Error('Gemini: no user messages');
    const res  = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: SCHOOL_CONTEXT }] }, contents, generationConfig: { maxOutputTokens: 800, temperature: 0.7 } }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Gemini HTTP ${res.status}`);
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error('Gemini: empty response');
    return data.candidates[0].content.parts[0].text.replace(/\*\*(.*?)\*\*/g, '$1').trim();
};

const tryOpenRouter = async (messages) => {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('OPENROUTER_API_KEY not configured');
    const res  = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`, 'HTTP-Referer': 'https://efs.vercel.app', 'X-Title': 'Emeakaroha Foundation School AI' },
        body: JSON.stringify({ model: 'mistralai/mistral-7b-instruct:free', messages: [{ role: 'system', content: SCHOOL_CONTEXT }, ...messages], max_tokens: 800, temperature: 0.7 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `OpenRouter HTTP ${res.status}`);
    if (!data.choices?.[0]?.message?.content) throw new Error('OpenRouter: empty response');
    return data.choices[0].message.content.trim();
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

    const studentIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    if (isRateLimited(studentIP)) return res.status(429).json({ error: 'Too many questions. Please wait a minute.' });

    const { messages } = req.body || {};
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'No messages provided' });
    }

    const lastUserMsg  = [...messages].reverse().find(m => m.role === 'user');
    const cacheKey     = lastUserMsg?.content?.toLowerCase().trim() || '';
    const cachedAnswer = cacheKey ? getCached(cacheKey) : null;

    if (cachedAnswer) return res.status(200).json({ reply: cachedAnswer, source: 'cache' });

    const providers = [
        { name: 'Groq',       fn: () => tryGroq(messages)       },
        { name: 'Gemini',     fn: () => tryGemini(messages)     },
        { name: 'OpenRouter', fn: () => tryOpenRouter(messages) },
    ];

    let lastError = null;
    for (const provider of providers) {
        try {
            const reply = await provider.fn();
            if (cacheKey) setCache(cacheKey, reply);
            return res.status(200).json({ reply, source: provider.name });
        } catch (err) {
            lastError = err;
        }
    }

    return res.status(503).json({ error: 'The AI is currently overloaded. Please try again in a moment.' });
}
