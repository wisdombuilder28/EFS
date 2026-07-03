// ============================================================
// VERCEL API FUNCTION: study-ai
// File location: /api/study-ai.js
//
// ENVIRONMENT VARIABLES — set in Vercel/Netlify dashboard:
//   GROQ_API_KEY
//   GEMINI_API_KEY
//   OPENROUTER_API_KEY
//
// Rotates through all 3 providers if one fails or rate-limits.
// ============================================================

const tryGroq = async (messages, model, maxTokens) => {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY not configured');
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Groq HTTP ${res.status}`);
    const choice = data.choices?.[0];
    if (!choice?.message?.content) throw new Error('Groq: empty response');
    return { text: choice.message.content.trim(), finishReason: choice.finish_reason ?? 'stop' };
};

const tryGemini = async (messages, maxTokens) => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY not configured');
    // Extract system prompt and convert messages
    const systemMsg = messages.find(m => m.role === 'system');
    const userMsgs  = messages.filter(m => m.role !== 'system');
    const contents  = userMsgs.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: Array.isArray(m.content)
            ? m.content.map(p => p.type === 'image_url'
                ? { inline_data: { mime_type: p.image_url.url.split(';')[0].replace('data:',''), data: p.image_url.url.split(',')[1] } }
                : { text: p.text })
            : [{ text: m.content }]
    }));
    // Gemini needs first message to be user
    while (contents.length && contents[0].role !== 'user') contents.shift();
    if (!contents.length) throw new Error('Gemini: no user messages');
    const body = {
        contents,
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
    };
    if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Gemini HTTP ${res.status}`);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini: empty response');
    const finishReason = data.candidates?.[0]?.finishReason === 'MAX_TOKENS' ? 'length' : 'stop';
    return { text: text.trim(), finishReason };
};

const tryOpenRouter = async (messages, maxTokens) => {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('OPENROUTER_API_KEY not configured');
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
            'HTTP-Referer': 'https://efs.vercel.app',
            'X-Title': 'Emeakaroha Foundation School Study AI',
        },
        body: JSON.stringify({ model: 'mistralai/mistral-7b-instruct:free', messages, max_tokens: maxTokens }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `OpenRouter HTTP ${res.status}`);
    const choice = data.choices?.[0];
    if (!choice?.message?.content) throw new Error('OpenRouter: empty response');
    return { text: choice.message.content.trim(), finishReason: choice.finish_reason ?? 'stop' };
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

    const { messages, model = 'llama-3.3-70b-versatile', maxTokens = 2500 } = req.body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'No messages provided' });
    }

    const providers = [
        { name: 'Groq',       fn: () => tryGroq(messages, model, maxTokens)  },
        { name: 'Gemini',     fn: () => tryGemini(messages, maxTokens)        },
        { name: 'OpenRouter', fn: () => tryOpenRouter(messages, maxTokens)    },
    ];

    let lastError = null;
    for (const provider of providers) {
        try {
            const { text, finishReason } = await provider.fn();
            return res.status(200).json({ text, finishReason, source: provider.name });
        } catch (err) {
            console.warn(`study-ai: ${provider.name} failed — ${err.message}`);
            lastError = err;
        }
    }

    console.error('study-ai: all providers failed:', lastError?.message);
    return res.status(503).json({ error: 'The Study AI is currently overloaded. Please try again in a moment.' });
}
