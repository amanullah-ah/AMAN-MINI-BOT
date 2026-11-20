// plugins/ai-extra.js — AI category ke naye commands (free, no API key; engine plugins/ai.js ka hi hai)
//
//   .aicode <kaam>            → AI se code likhwao        (.aicode python | fibonacci ka program)
//   .aimenu                   → AI + Video Editing commands ki list
//   .aivideo <description>    → AI images (Pollinations) se zoom-animation wali chhoti video
//
// Note: .aivideo asal text-to-video model nahi hai. Ye 4 AI images banata hai aur ffmpeg se
// unhe zoom-animation + music ke saath ek video me jodta hai (free aur API key ke bagair).

const fs = require('fs');
const path = require('path');
const { cmd, commands } = require('../arslan');
const config = require('../config');
const V = require('../lib/vedit');
const { askAI, MODELS, throttled, fetchImage } = require('./ai');

const P = () => config.PREFIX || '.';
const react = (conn, from, mek, e) => conn.sendMessage(from, { react: { text: e, key: mek.key } }).catch(() => {});

// ───────────── .aicode ─────────────
const CODE_SYSTEM = 'You are a senior programmer. Write correct, clean, working code for the request. ' +
    'Reply with ONE fenced code block (with the language name after the three backticks), then at most 3 short lines on how to run it. ' +
    'Explain in the same language/script the user writes in (Roman Urdu, Hindi or English). No long introductions.';
const EXT = { javascript: 'js', js: 'js', node: 'js', nodejs: 'js', typescript: 'ts', ts: 'ts', python: 'py', py: 'py', html: 'html', css: 'css', php: 'php', java: 'java',
    c: 'c', cpp: 'cpp', 'c++': 'cpp', csharp: 'cs', 'c#': 'cs', go: 'go', rust: 'rs', kotlin: 'kt', swift: 'swift', ruby: 'rb', bash: 'sh', sh: 'sh', sql: 'sql', json: 'json', dart: 'dart', lua: 'lua' };

cmd({
    pattern: 'aicode',
    alias: ['codeai', 'aicoder', 'gencode'],
    desc: 'AI se code likhwao',
    category: 'ai',
    react: '💻',
    use: '.aicode <kaam>',
    filename: __filename
}, async (conn, mek, m, { args, reply, from, sender }) => {
    const task = (args.join(' ').trim() || (m.quoted?.text || '').trim()).slice(0, 1500);
    if (!task) return reply(`💻 *AI CODE*\n\nUsage: \`${P()}aicode <kaam>\`\nMisal:\n\`${P()}aicode python | calculator banao\`\n\`${P()}aicode html login page with dark theme\`\n\nYa kisi message par reply karke \`${P()}aicode\` likho.`);
    if (throttled(sender || from)) return reply('⏳ Thora ruko, pehli request chal rahi hai.');
    await react(conn, from, mek, '⏳');
    try {
        const { text } = await askAI([{ role: 'system', content: CODE_SYSTEM }, { role: 'user', content: task }], MODELS.gpt);
        const out = text.trim();
        if (out.length <= 3800) {
            await react(conn, from, mek, '✅');
            return reply(out);
        }
        // lamba code: file bana kar bhejo
        const fence = /```([\w+#-]*)\n([\s\S]*?)```/.exec(out);
        const lang = fence ? fence[1].toLowerCase() : '';
        const code = fence ? fence[2] : out;
        const ext = EXT[lang] || 'txt';
        await conn.sendMessage(from, { document: Buffer.from(code, 'utf8'), mimetype: 'text/plain', fileName: `aicode.${ext}`, caption: '💻 *AI CODE*\n_Code lamba tha, is liye file me bheja._' }, { quoted: mek });
        await react(conn, from, mek, '✅');
    } catch (e) {
        await react(conn, from, mek, '❌');
        return reply(`❌ AI abhi code nahi likh saka. Thori der baad try karo.\n_${String(e.message).slice(0, 80)}_`);
    }
});

// ───────────── .aimenu ─────────────
cmd({
    pattern: 'aimenu',
    alias: ['aihelp', 'aicommands'],
    desc: 'AI aur Video Editing commands ki list',
    category: 'ai',
    react: '🤖',
    use: '.aimenu',
    filename: __filename
}, async (conn, mek, m, { reply }) => {
    const p = P();
    const seen = new Set();
    const lines = (cat) => commands
        .filter(c => c.pattern && c.category === cat && !c.dontAddCommandList && !seen.has(cat + c.pattern) && seen.add(cat + c.pattern))
        .map(c => c.pattern).sort()
        .map(n => `┃ ➜ ${p}${n}`).join('\n');
    return reply(
        `╭━━〔 🤖 *AI* 〕━━┈⊷\n${lines('ai')}\n╰━━━━━━━━━━━━┈⊷\n\n` +
        `╭━━〔 🎬 *VIDEO EDITING* 〕━━┈⊷\n${lines('videoediting')}\n╰━━━━━━━━━━━━┈⊷\n\n` +
        `_Detail: ${p}menu ai  |  ${p}menu videoediting  |  ${p}vtemplate_`
    );
});

// ───────────── .aivideo ─────────────
const SCENES = ['wide establishing shot', 'detailed close-up', 'dramatic cinematic lighting', 'epic final shot'];
const SECONDS_PER_SCENE = 3;
const FPS = 25;
const aiVideoBusy = new Set();
const aiVideoLast = new Map();
const COOLDOWN_MS = 90 * 1000;

function pickMusic() {
    try {
        const dir = path.join(__dirname, '..', 'assets', 'bgmusic');
        const files = fs.readdirSync(dir).filter(f => /\.(mp3|m4a|ogg|wav)$/i.test(f));
        return files.length ? path.join(dir, files[Math.floor(Math.random() * files.length)]) : null;
    } catch (_) { return null; }
}

// images (Buffer[]) -> mp4 Buffer (zoom animation + optional music)
async function slideshowVideo(images, music) {
    const files = [], out = V.tmpFile('mp4');
    try {
        const size = 720;
        const d = SECONDS_PER_SCENE * FPS;
        for (const img of images) {
            const f = V.tmpFile('jpg');
            const prep = await require('sharp')(img).rotate().resize(size, size, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer();
            fs.writeFileSync(f, prep);
            files.push(f);
        }
        const n = files.length;
        const total = n * SECONDS_PER_SCENE;
        const parts = files.map((_, i) => {
            const zoomIn = i % 2 === 0;
            const z = zoomIn ? "min(zoom+0.0012,1.22)" : "if(eq(on,0),1.22,max(zoom-0.0012,1.0))";
            return `[${i}:v]zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d}:s=${size}x${size}:fps=${FPS},setsar=1[v${i}]`;
        });
        const concat = `${files.map((_, i) => `[v${i}]`).join('')}concat=n=${n}:v=1:a=0,format=yuv420p[v]`;
        const base = [];
        for (const f of files) base.push('-i', f);
        const build = (withMusic) => {
            const args = [...base];
            if (withMusic) args.push('-i', music);
            args.push('-filter_complex', `${parts.join(';')};${concat}`, '-map', '[v]');
            if (withMusic) args.push('-map', `${n}:a:0`, '-af', `afade=t=in:d=1,afade=t=out:st=${total - 2}:d=2`, '-c:a', 'aac', '-b:a', '128k');
            args.push('-t', String(total), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out);
            return args;
        };
        if (music) {
            try { await V.run(build(true), 5 * 60 * 1000); return fs.readFileSync(out); }
            catch (_) { /* music ke bina dobara */ }
        }
        await V.run(build(false), 5 * 60 * 1000);
        return fs.readFileSync(out);
    } finally { V.rm(out, ...files); }
}

cmd({
    pattern: 'aivideo',
    alias: ['genvideo', 'text2video', 'aivid'],
    desc: 'AI images se zoom-animation wali chhoti video',
    category: 'ai',
    react: '🎥',
    use: '.aivideo <description>',
    filename: __filename
}, async (conn, mek, m, { args, reply, from, sender }) => {
    const prompt = (args.join(' ').trim() || (m.quoted?.text || '').trim()).slice(0, 300);
    if (!prompt) return reply(`🎥 *AI VIDEO*\n\nUsage: \`${P()}aivideo <description>\`\nMisal: \`${P()}aivideo a lion walking in a neon city\`\n_(English description behtar kaam karti hai. Video 12 second ki banti hai, 1-2 minute lagte hain.)_`);
    const who = sender || from;
    if (aiVideoBusy.has(who)) return reply('⏳ Aap ki pehli AI video abhi ban rahi hai, thora ruko.');
    const wait = COOLDOWN_MS - (Date.now() - (aiVideoLast.get(who) || 0));
    if (wait > 0) return reply(`⏳ ${Math.ceil(wait / 1000)} second baad dobara try karo.`);
    aiVideoBusy.add(who);
    aiVideoLast.set(who, Date.now());
    await react(conn, from, mek, '⏳');
    try {
        await reply('🎥 AI video ban rahi hai... 1-2 minute lagenge ⏳');
        const images = [];
        for (let i = 0; i < SCENES.length; i += 2) {
            const batch = await Promise.allSettled(SCENES.slice(i, i + 2).map(s => fetchImage(`${prompt}, ${s}`)));
            for (const r of batch) if (r.status === 'fulfilled') images.push(r.value);
        }
        if (images.length < 2) throw new Error('AI images nahi ban saki');
        const video = await slideshowVideo(images, pickMusic());
        await conn.sendMessage(from, { video, mimetype: 'video/mp4', caption: `🎥 *${prompt.slice(0, 150)}*\n_AI images + zoom animation_` }, { quoted: mek });
        await react(conn, from, mek, '✅');
    } catch (e) {
        aiVideoLast.delete(who);
        await react(conn, from, mek, '❌');
        return reply(`❌ AI video nahi ban saki. Thori der baad try karo.\n_${String(e.message).slice(0, 100)}_`);
    } finally { aiVideoBusy.delete(who); }
});

module.exports = { slideshowVideo };
