// plugins/ai.js — Free AI (no API key): chat + yaadasht, image, voice, summary
// API: Pollinations.ai (text + image). Ek model fail ho to khud doosre model par chala jata hai.
//
// .ai <sawal>            → chat (pichli baatein yaad rakhta hai, 30 min)
// .ai claude <sawal>     → model chuno: gpt, claude, deepseek, llama, mistral
// .ai (kisi message ko reply karke) → us message par sawal/jawab
// .aireset               → is chat ki yaadasht saaf
// .imagine <description> → AI image banao
// .aivoice <sawal>       → AI ka jawab voice note mein
// .summarize [text]      → text ya reply kiye gaye message ka khulasa

const { cmd } = require('../arslan');
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MODELS = { gpt: 'openai', claude: 'claude', deepseek: 'deepseek', llama: 'llama', mistral: 'mistral' };
const FALLBACKS = ['openai', 'mistral', 'llama'];
const SYSTEM = 'You are AMAN-MD, a helpful, friendly WhatsApp assistant. Reply in the same language and script the user writes in (Roman Urdu, Hindi, English, etc). Keep answers clear and concise, in short paragraphs. Never claim to be a human.';
const MAX_TURNS = 8;                 // 8 sawal-jawab yaad
const MEMORY_TTL = 30 * 60 * 1000;   // 30 min
const COOLDOWN_MS = 3000;            // ek user 3 sec mein ek request

const memory = new Map();   // chat -> { turns: [{role, content}], t }
const lastCall = new Map(); // user -> time
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of memory) if (now - v.t > MEMORY_TTL) memory.delete(k);
    for (const [k, t] of lastCall) if (now - t > 60000) lastCall.delete(k);
}, 120000).unref();

function getMem(chat) {
    const m = memory.get(chat);
    if (!m || Date.now() - m.t > MEMORY_TTL) { const fresh = { turns: [], t: Date.now() }; memory.set(chat, fresh); return fresh; }
    return m;
}

function pickText(data) {
    if (data == null) return '';
    if (typeof data === 'string') return data;
    const c = data?.choices?.[0]?.message?.content;
    if (typeof c === 'string') return c;
    if (typeof data.text === 'string') return data.text;
    if (typeof data.response === 'string') return data.response;
    return '';
}
const looksBad = (t) => !t || t.trim().length < 1 || /^\s*<(!doctype|html)/i.test(t);

async function callOnce(messages, model) {
    // 1) POST (history ke saath)
    try {
        const r = await axios.post('https://text.pollinations.ai/', { messages, model }, {
            timeout: 60000, headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' }
        });
        const t = pickText(r.data);
        if (!looksBad(t)) return t.trim();
    } catch (_) { /* GET try karo */ }
    // 2) GET fallback (sirf aakhri sawal + chhota context)
    const sys = messages.find(x => x.role === 'system')?.content || SYSTEM;
    const convo = messages.filter(x => x.role !== 'system').slice(-6)
        .map(x => `${x.role === 'user' ? 'User' : 'Assistant'}: ${x.content}`).join('\n').slice(-1500);
    const url = `https://text.pollinations.ai/${encodeURIComponent(convo)}?model=${model}&system=${encodeURIComponent(sys)}`;
    const r2 = await axios.get(url, { timeout: 60000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const t2 = pickText(r2.data);
    if (looksBad(t2)) throw new Error('empty response');
    return t2.trim();
}

async function askAI(messages, preferred) {
    const order = [preferred, ...FALLBACKS].filter((x, i, a) => x && a.indexOf(x) === i);
    let lastErr;
    for (const model of order) {
        try { return { text: await callOnce(messages, model), model }; }
        catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('AI available nahi');
}

function throttled(user) {
    const now = Date.now();
    if (now - (lastCall.get(user) || 0) < COOLDOWN_MS) return true;
    lastCall.set(user, now);
    return false;
}

const react = (conn, from, mek, e) => conn.sendMessage(from, { react: { text: e, key: mek.key } }).catch(() => {});

// ───────────── .ai ─────────────
cmd({
    pattern: 'ai',
    alias: ['gpt', 'chat', 'ask', 'llm'],
    desc: 'Free AI chat (yaadasht ke saath, no API key)',
    category: 'ai',
    react: '🤖',
    use: '.ai <question>',
    filename: __filename
}, async (conn, mek, m, { args, reply, from, sender }) => {
    let model = 'gpt';
    let rest = args.slice();
    if (MODELS[String(rest[0] || '').toLowerCase()]) { model = rest.shift().toLowerCase(); }
    let prompt = rest.join(' ').trim();
    const quotedText = (m.quoted?.text || '').trim();
    if (!prompt && !quotedText) {
        return reply('🤖 *AMAN-MD AI*\n\n`.ai <sawal>` — chat (baatein yaad rehti hain)\n`.ai claude <sawal>` — model chuno\nModels: gpt, claude, deepseek, llama, mistral\nKisi message ko reply karke `.ai` likho to us par jawab\n\n`.aireset` — yaadasht saaf\n`.imagine <text>` — AI image\n`.aivoice <sawal>` — voice jawab\n`.summarize` — khulasa');
    }
    if (throttled(sender || from)) return reply('⏳ Thora ruko, pehli request chal rahi hai.');
    if (quotedText) prompt = prompt ? `${prompt}\n\n"""${quotedText.slice(0, 3000)}"""` : quotedText.slice(0, 3000);

    const mem = getMem(from);
    const messages = [{ role: 'system', content: SYSTEM }, ...mem.turns, { role: 'user', content: prompt.slice(0, 3500) }];
    await react(conn, from, mek, '⏳');
    try {
        const { text, model: used } = await askAI(messages, MODELS[model]);
        mem.turns.push({ role: 'user', content: prompt.slice(0, 1500) }, { role: 'assistant', content: text.slice(0, 1500) });
        while (mem.turns.length > MAX_TURNS * 2) mem.turns.shift();
        mem.t = Date.now();
        await react(conn, from, mek, '✅');
        const label = Object.keys(MODELS).find(k => MODELS[k] === used) || used;
        return reply(`🤖 *${label.toUpperCase()}*\n\n${text.slice(0, 3500)}`);
    } catch (e) {
        await react(conn, from, mek, '❌');
        return reply(`❌ AI abhi jawab nahi de raha. Thori der baad try karo.\n_${String(e.message).slice(0, 80)}_`);
    }
});

cmd({
    pattern: 'aireset',
    alias: ['aiclear', 'newchat'],
    desc: 'AI chat ki yaadasht saaf karo',
    category: 'ai',
    react: '♻️',
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    memory.delete(from);
    return reply('♻️ AI ki yaadasht saaf. Nayi baat shuru karo.');
});

// ───────────── .imagine ─────────────
async function fetchImage(prompt) {
    const seed = Math.floor(Math.random() * 1e9);
    const base = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
    const tries = [`${base}?width=1024&height=1024&nologo=true&seed=${seed}&model=flux`, `${base}?width=768&height=768&nologo=true&seed=${seed}`];
    let lastErr;
    for (const url of tries) {
        try {
            const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 90000, headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (String(r.headers['content-type'] || '').startsWith('image/') && r.data?.length > 2000) return Buffer.from(r.data);
            lastErr = new Error('image nahi mili');
        } catch (e) { lastErr = e; }
    }
    throw lastErr;
}

cmd({
    pattern: 'aiimg',
    alias: ['imagine', 'aiimage', 'genimg', 'text2img'],
    desc: 'AI se image banao (free)',
    category: 'ai',
    react: '🎨',
    use: '.imagine a lion in a neon city',
    filename: __filename
}, async (conn, mek, m, { args, reply, from, sender }) => {
    const prompt = (args.join(' ').trim() || (m.quoted?.text || '').trim()).slice(0, 500);
    if (!prompt) return reply('🎨 *AI IMAGE*\n\nUsage: `.imagine <description>`\nExample: `.imagine a lion in a neon city`\n_(English description behtar kaam karti hai)_');
    if (throttled(sender || from)) return reply('⏳ Thora ruko, pehli request chal rahi hai.');
    await react(conn, from, mek, '⏳');
    try {
        const img = await fetchImage(prompt);
        await conn.sendMessage(from, { image: img, caption: `🎨 *${prompt.slice(0, 200)}*\n\n_© AMAN-MD AI_` }, { quoted: mek });
        await react(conn, from, mek, '✅');
    } catch (e) {
        await react(conn, from, mek, '❌');
        return reply(`❌ Image nahi ban saki. Thori der baad try karo.\n_${String(e.message).slice(0, 80)}_`);
    }
});

// ───────────── .aivoice ─────────────
function voiceFor(text) {
    if (/[\u0600-\u06FF]/.test(text)) return 'ur-PK-UzmaNeural';      // Urdu/Arabic script
    if (/[\u0900-\u097F]/.test(text)) return 'hi-IN-SwaraNeural';     // Devanagari
    return 'en-IN-NeerjaNeural';                                       // Roman Urdu/English
}

cmd({
    pattern: 'aivoice',
    alias: ['aitalk', 'aispeak'],
    desc: 'AI ka jawab voice note mein',
    category: 'ai',
    react: '🎙️',
    use: '.aivoice <sawal>',
    filename: __filename
}, async (conn, mek, m, { args, reply, from, sender, botNumber }) => {
    const q = (args.join(' ').trim() || (m.quoted?.text || '').trim()).slice(0, 800);
    if (!q) return reply('🎙️ Usage: `.aivoice <sawal>`\nExample: `.aivoice mujhe ek chhoti motivational baat sunao`');
    if (throttled(sender || from)) return reply('⏳ Thora ruko, pehli request chal rahi hai.');
    await react(conn, from, mek, '⏳');
    let tmp;
    try {
        const messages = [
            { role: 'system', content: SYSTEM + ' Answer in at most 3 short sentences, plain text only, no emojis, no markdown, suitable for being read aloud.' },
            { role: 'user', content: q }
        ];
        const { text } = await askAI(messages, 'openai');
        const speak = text.replace(/[*_~`#>]/g, '').replace(/\s+/g, ' ').slice(0, 450);
        const { EdgeTTS } = require('edge-tts-universal');
        const tts = new EdgeTTS(speak, voiceFor(speak));
        const out = await tts.synthesize();
        tmp = path.join(os.tmpdir(), `aivoice_${Date.now()}.mp3`);
        fs.writeFileSync(tmp, Buffer.from(await out.audio.arrayBuffer()));
        const bgm = require('../lib/bgmusic');
        const mixed = (await bgm.isOn(conn, botNumber)) ? await bgm.mixVoice(fs.readFileSync(tmp), conn, botNumber) : null;   // .bgmusic on
        if (mixed) await conn.sendMessage(from, { audio: mixed, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: mek });
        else await conn.sendMessage(from, { audio: fs.readFileSync(tmp), mimetype: 'audio/mpeg', ptt: true }, { quoted: mek });
        await react(conn, from, mek, '✅');
    } catch (e) {
        await react(conn, from, mek, '❌');
        return reply(`❌ AI voice nahi ban saki.\n_${String(e.message).slice(0, 80)}_`);
    } finally {
        if (tmp) { try { fs.unlinkSync(tmp); } catch (_) {} }
    }
});

// ───────────── .summarize ─────────────
cmd({
    pattern: 'summarize',
    alias: ['summary', 'khulasa', 'tldr'],
    desc: 'Text ya reply kiye message ka AI khulasa',
    category: 'ai',
    react: '📝',
    use: '.summarize (message par reply)',
    filename: __filename
}, async (conn, mek, m, { args, reply, from, sender }) => {
    const text = (args.join(' ').trim() || (m.quoted?.text || '').trim()).slice(0, 6000);
    if (text.length < 40) return reply('📝 Lambay message ko reply karke `.summarize` likho, ya `.summarize <text>`.');
    if (throttled(sender || from)) return reply('⏳ Thora ruko, pehli request chal rahi hai.');
    await react(conn, from, mek, '⏳');
    try {
        const messages = [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: `Summarize the following text in the same language it is written in, as 3-5 short bullet points:\n\n"""${text}"""` }
        ];
        const { text: out } = await askAI(messages, 'openai');
        await react(conn, from, mek, '✅');
        return reply(`📝 *KHULASA*\n\n${out.slice(0, 3000)}`);
    } catch (e) {
        await react(conn, from, mek, '❌');
        return reply(`❌ Khulasa nahi ban saka. Thori der baad try karo.\n_${String(e.message).slice(0, 80)}_`);
    }
});

// Doosre plugins (ai-helpers.js, ai-extra.js) is AI engine ko dobara istemal karte hain
module.exports = { askAI, MODELS, throttled, fetchImage };
