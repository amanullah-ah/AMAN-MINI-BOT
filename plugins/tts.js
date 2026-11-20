// plugins/tts.js
// AMAN HELL-MD — Text to Speech with multiple voices

const { cmd } = require('../arslan');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const bgmusic = require('../lib/bgmusic');

// ═══════════════════════════════════════════
//  VOICE OPTIONS — edge-tts-universal
// ═══════════════════════════════════════════
const VOICES = {
    // English
    'en-us-female': 'en-US-JennyNeural',
    'en-us-male': 'en-US-GuyNeural',
    'en-uk-female': 'en-GB-SoniaNeural',
    'en-uk-male': 'en-GB-RyanNeural',
    'en-au-female': 'en-AU-NatashaNeural',
    'en-in-female': 'en-IN-NeerjaNeural',
    'en-in-male': 'en-IN-PrabhatNeural',

    // Hindi
    'hi-female': 'hi-IN-SwaraNeural',
    'hi-male': 'hi-IN-MadhurNeural',

    // Urdu
    'ur-female': 'ur-PK-UzmaNeural',
    'ur-male': 'ur-PK-AsadNeural',

    // Arabic
    'ar-female': 'ar-SA-ZariyahNeural',
    'ar-male': 'ar-SA-HamedNeural',

    // Japanese
    'ja-female': 'ja-JP-NanamiNeural',
    'ja-male': 'ja-JP-KeitaNeural',

    // Korean
    'ko-female': 'ko-KR-SunHiNeural',
    'ko-male': 'ko-KR-InJoonNeural',

    // Chinese
    'zh-female': 'zh-CN-XiaoxiaoNeural',
    'zh-male': 'zh-CN-YunxiNeural',

    // Spanish
    'es-female': 'es-ES-ElviraNeural',
    'es-male': 'es-ES-AlvaroNeural',

    // French
    'fr-female': 'fr-FR-DeniseNeural',
    'fr-male': 'fr-FR-HenriNeural',

    // Russian
    'ru-female': 'ru-RU-SvetlanaNeural',
    'ru-male': 'ru-RU-DmitryNeural'
};

// ═══════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════
let FFMPEG = 'ffmpeg';
try { FFMPEG = require('@ffmpeg-installer/ffmpeg').path || 'ffmpeg'; } catch (_) {}

// chhote naam: .tts ur Assalam o alaikum
const LANG_SHORT = {
    en: 'en-us-female', us: 'en-us-female', uk: 'en-uk-female', in: 'en-in-female',
    hi: 'hi-female', hindi: 'hi-female', ur: 'ur-female', urdu: 'ur-female',
    ar: 'ar-female', arabic: 'ar-female', ja: 'ja-female', ko: 'ko-female', zh: 'zh-female',
    es: 'es-female', fr: 'fr-female', ru: 'ru-female'
};

// voice na likhi ho to text ki script se andaza
function autoVoice(text) {
    if (/[\u0600-\u06FF\u0750-\u077F]/.test(text)) return 'ur-female';   // Urdu / Arabic script
    if (/[\u0900-\u097F]/.test(text)) return 'hi-female';                // Devanagari
    if (/[\uAC00-\uD7AF]/.test(text)) return 'ko-female';
    if (/[\u3040-\u30FF]/.test(text)) return 'ja-female';
    if (/[\u4E00-\u9FFF]/.test(text)) return 'zh-female';
    if (/[\u0400-\u04FF]/.test(text)) return 'ru-female';
    return 'en-us-female';
}

// .tts [voice] <text>  ->  { voiceKey, text }
function resolveVoice(q, quotedText) {
    const raw = String(q || '').trim();
    const first = (raw.split(/\s+/)[0] || '').toLowerCase();
    let voiceKey = null, text = raw;
    if (first && VOICES[first]) { voiceKey = first; text = raw.slice(first.length).trim(); }
    else if (first && LANG_SHORT[first]) { voiceKey = LANG_SHORT[first]; text = raw.slice(first.length).trim(); }
    if (!text) text = String(quotedText || '').trim();            // reply kiye message ka text
    text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/\s+/g, ' ').trim();
    return { voiceKey: voiceKey || autoVoice(text), text, auto: !voiceKey };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function synthesize(text, voiceName) {
    const { EdgeTTS } = require('edge-tts-universal');
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {              // Edge server kabhi kabhi pehli baar fail hota hai
        try {
            const tts = new EdgeTTS(text, voiceName);
            const res = await Promise.race([
                tts.synthesize(),
                new Promise((_, rej) => setTimeout(() => rej(new Error('Edge TTS server ne jawab nahi diya (timeout)')), 25000))
            ]);
            const buf = Buffer.from(await res.audio.arrayBuffer());
            if (buf.length < 800) throw new Error('Khali audio mili');
            return buf;
        } catch (e) {
            lastErr = e;
            if (attempt < 3) await sleep(700 * attempt);
        }
    }
    throw lastErr;
}

// mp3 -> ogg/opus (WhatsApp voice-note format). Na bane to null.
function toOpus(src, out) {
    return new Promise(resolve => {
        execFile(FFMPEG, ['-y', '-i', src, '-vn', '-map_metadata', '-1', '-c:a', 'libopus', '-b:a', '48k', '-ar', '48000', '-ac', '1', '-application', 'voip', '-f', 'ogg', out],
            { timeout: 60000 }, err => {
                if (err || !fs.existsSync(out) || fs.statSync(out).size < 800) return resolve(null);
                resolve(out);
            });
    });
}

// ═══════════════════════════════════════════
//  .tts — Text to speech
// ═══════════════════════════════════════════
cmd({
    pattern: 'tts',
    alias: ['voice', 'speak', 'say', 'bolo'],
    desc: 'Convert text to speech audio',
    category: 'tools',
    react: '🎤',
    use: '.tts <voice> <text>',
    filename: __filename
}, async (conn, mek, m, { q, reply, from, botNumber }) => {
    const files = [];
    try {
        const { voiceKey, text, auto } = resolveVoice(q, m.quoted && m.quoted.text);

        if (!text) {
            return reply(
`🎤 *TEXT TO SPEECH*

📌 *Usage:*
.tts <text>
.tts <voice> <text>
Ya kisi message par reply karke *.tts*

📖 *Examples:*
.tts Hello world
.tts ur-male السلام علیکم
.tts hi-female नमस्ते दोस्तों
.tts ur Assalam o alaikum

💡 Voice na likho to text ki zaban se khud chun leta hai.
🎙️ Poori list: *.voices*`);
        }
        if (text.length > 500) return reply('❌ *Text bahut lamba hai.* 500 characters tak.');

        const voiceName = VOICES[voiceKey];
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }).catch(() => {});

        const mp3 = await synthesize(text, voiceName);
        const id = `${Date.now()}_${Math.floor(Math.random() * 1e4)}`;
        const mp3Path = path.join(os.tmpdir(), `tts_${id}.mp3`);
        const oggPath = path.join(os.tmpdir(), `tts_${id}.ogg`);
        files.push(mp3Path, oggPath);
        fs.writeFileSync(mp3Path, mp3);

        // .bgmusic on ho to voice ke peeche music mix karo (na bane to bina music ke chalega)
        let mixed = null;
        if (await bgmusic.isOn(conn, botNumber)) mixed = await bgmusic.mixVoice(mp3, conn, botNumber);
        if (mixed) {
            await conn.sendMessage(from, { audio: mixed, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: mek });
        } else if (await toOpus(mp3Path, oggPath)) {
            // asli voice-note (mp3 + ptt:true WhatsApp par "audio nahi chal raha" deta hai)
            await conn.sendMessage(from, { audio: fs.readFileSync(oggPath), mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: mek });
        } else {
            // ffmpeg na chale to normal audio file ki tarah bhej do
            await conn.sendMessage(from, { audio: mp3, mimetype: 'audio/mpeg', ptt: false, fileName: `tts_${voiceKey}.mp3` }, { quoted: mek });
        }
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});
        if (auto && /^en-/.test(voiceKey) && /[a-z]/i.test(text) && /\b(kia|kya|hai|nahi|aap|mein|main|tum|bhai|salam|assalam|kaise)\b/i.test(text)) {
            await reply('💡 Roman Urdu/Hindi English voice mein ajeeb lagti hai. Urdu script mein likho ya *.tts ur-male <text>* try karo.');
        }
    } catch (err) {
        console.error('[tts] ERROR:', err && err.stack || err);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }).catch(() => {});
        return reply(`❌ *TTS nahi ban saka.*\n_${String((err && err.message) || err).slice(0, 120)}_\n\nThori der baad dobara try karo.`);
    } finally {
        for (const f of files) { try { fs.unlinkSync(f); } catch (_) {} }
    }
});

// ═══════════════════════════════════════════
//  .voices — list all voices
// ═══════════════════════════════════════════
cmd({
    pattern: 'voices',
    alias: ['voicelist', 'ttsvoices'],
    desc: 'Show all TTS voices',
    category: 'tools',
    react: '🎙️',
    filename: __filename
}, async (conn, mek, m, { reply }) => {
    const groups = {
        English: Object.keys(VOICES).filter(v => v.startsWith('en-')),
        Hindi: Object.keys(VOICES).filter(v => v.startsWith('hi-')),
        Urdu: Object.keys(VOICES).filter(v => v.startsWith('ur-')),
        Arabic: Object.keys(VOICES).filter(v => v.startsWith('ar-')),
        Japanese: Object.keys(VOICES).filter(v => v.startsWith('ja-')),
        Korean: Object.keys(VOICES).filter(v => v.startsWith('ko-')),
        Chinese: Object.keys(VOICES).filter(v => v.startsWith('zh-')),
        Spanish: Object.keys(VOICES).filter(v => v.startsWith('es-')),
        French: Object.keys(VOICES).filter(v => v.startsWith('fr-')),
        Russian: Object.keys(VOICES).filter(v => v.startsWith('ru-'))
    };

    let out = '🎙️ *TTS VOICES*\n\n';
    for (const [lang, list] of Object.entries(groups)) {
        if (list.length) {
            out += `*${lang}:*\n${list.map(v => `• \`${v}\``).join('\n')}\n\n`;
        }
    }
    return reply(out.slice(0, 4000));
});

console.log('[AMAN HELL-MD] TTS commands loaded');