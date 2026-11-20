// plugins/audio-effects.js
// 🎧 AUDIO category — kisi voice/audio/video par reply karke effect lagao
// Commands: bass deep smooth fat tupai blown radio robot chipmunk nightcore earrape reverse slow fast baby demon tomp3 toptt
// Use: audio (ya video) par reply karke  .bass   |  .nightcore  |  .tomp3  |  .toptt

const { cmd } = require('../arslan');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const MAX_INPUT_BYTES = 40 * 1024 * 1024;    // 40 MB se bari file nahi
const MAX_SECONDS = 600;                      // 10 minute se lambi nahi
const SR = 44100;

// pitch badalna (tempo waisa hi): asetrate se pitch, atempo se tempo wapas theek
const pitch = (f) => `aresample=${SR},asetrate=${Math.round(SR * f)},aresample=${SR},atempo=${(1 / f).toFixed(4)}`;

// effect -> ffmpeg audio filter
const EFFECTS = {
    bass:      { icon: '🔊', desc: 'Bass boost',            af: 'equalizer=f=54:width_type=o:width=2:g=20,alimiter=limit=0.95' },
    deep:      { icon: '🌑', desc: 'Gehri awaaz',           af: `aresample=${SR},asetrate=${Math.round(SR * 2 / 3)},aresample=${SR}` },
    smooth:    { icon: '🍃', desc: 'Naram / smooth awaaz',  af: 'lowpass=f=3800,acompressor=threshold=-20dB:ratio=3:attack=20:release=250,volume=1.2' },
    fat:       { icon: '🍔', desc: 'Moti bhari awaaz',      af: `aresample=${SR},asetrate=22100,aresample=${SR},atempo=1.6` },
    tupai:     { icon: '🐿️', desc: 'Gilehri ki awaaz',      af: `aresample=${SR},asetrate=65100,aresample=${SR},atempo=0.5` },
    blown:     { icon: '💥', desc: 'Phati hui / crushed',   af: 'acrusher=level_in=8:level_out=18:bits=8:mode=log:aa=1' },
    radio:     { icon: '📻', desc: 'Purane radio jaisi',    af: 'highpass=f=400,lowpass=f=3400,acrusher=level_in=2:level_out=2:bits=12:mode=lin:aa=1,volume=1.6' },
    robot:     { icon: '🤖', desc: 'Robot awaaz',           af: "afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75" },
    chipmunk:  { icon: '🐭', desc: 'Chipmunk (patli awaaz)', af: pitch(1.6) },
    nightcore: { icon: '🌙', desc: 'Nightcore (tez + unchi)', af: `aresample=${SR},asetrate=${Math.round(SR * 1.25)},aresample=${SR}` },
    earrape:   { icon: '📢', desc: 'Bohat tez awaaz ⚠️',    af: 'volume=12,alimiter=limit=0.98' },
    reverse:   { icon: '⏪', desc: 'Ulta chalao',           af: 'areverse' },
    slow:      { icon: '🐢', desc: 'Dheemi speed',          af: 'atempo=0.7' },
    fast:      { icon: '⚡', desc: 'Tez speed',             af: 'atempo=1.6' },
    baby:      { icon: '👶', desc: 'Bachon jaisi awaaz',    af: pitch(1.35) },
    demon:     { icon: '😈', desc: 'Shaitani awaaz',        af: `${pitch(0.62)},aecho=0.8:0.85:55:0.35,volume=1.3` },
};

const P = () => { try { return require('../config').PREFIX || '.'; } catch (_) { return '.'; } };

// ── ffmpeg ──
function ffmpegPath() {
    try { return require('@ffmpeg-installer/ffmpeg').path; } catch (_) {}
    return 'ffmpeg';
}
function runFfmpeg(args, timeoutMs = 120000) {
    return new Promise((resolve, reject) => {
        const p = spawn(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
        let err = '';
        const timer = setTimeout(() => { try { p.kill('SIGKILL'); } catch (_) {} reject(new Error('timeout')); }, timeoutMs);
        p.stderr.on('data', (d) => { err += d.toString(); if (err.length > 4000) err = err.slice(-4000); });
        p.on('error', (e) => { clearTimeout(timer); reject(e); });
        p.on('close', (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(err.trim().split('\n').pop() || `ffmpeg exit ${code}`)); });
    });
}

// ── quoted audio/video nikalo ──
function getQuotedMedia(mek) {
    const msg = mek && mek.message;
    if (!msg) return null;
    const inner = (msg.ephemeralMessage && msg.ephemeralMessage.message) || (msg.viewOnceMessage && msg.viewOnceMessage.message) || msg;
    const ci = inner.extendedTextMessage && inner.extendedTextMessage.contextInfo;
    let qm = ci && ci.quotedMessage;
    if (!qm) return null;
    qm = (qm.ephemeralMessage && qm.ephemeralMessage.message) || (qm.viewOnceMessage && qm.viewOnceMessage.message) || (qm.viewOnceMessageV2 && qm.viewOnceMessageV2.message) || qm;
    if (qm.audioMessage) return { media: qm.audioMessage, kind: 'audio' };
    if (qm.videoMessage) return { media: qm.videoMessage, kind: 'video' };
    if (qm.documentMessage && /audio|video/i.test(qm.documentMessage.mimetype || '')) return { media: qm.documentMessage, kind: 'document' };
    return null;
}

async function downloadBuffer(media, kind) {
    const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
    const stream = await downloadContentFromMessage(media, kind);
    const chunks = [];
    let size = 0;
    for await (const c of stream) {
        size += c.length;
        if (size > MAX_INPUT_BYTES) throw new Error('too_big');
        chunks.push(c);
    }
    return Buffer.concat(chunks);
}

// ── ek hi processing function sab commands ke liye ──
async function processAudio(conn, mek, from, reply, name) {
    const q = getQuotedMedia(mek);
    if (!q) return reply(`🎧 Kisi *audio / voice / video* par reply karke likho:\n${P()}${name}`);
    const secs = Number(q.media.seconds || 0);
    if (secs > MAX_SECONDS) return reply(`❌ Audio bohat lambi hai (max ${Math.round(MAX_SECONDS / 60)} minute).`);

    const tmp = path.join(os.tmpdir(), `afx-${crypto.randomBytes(6).toString('hex')}`);
    const inFile = `${tmp}-in.bin`;
    const outFile = `${tmp}-out.${name === 'tomp3' ? 'mp3' : 'ogg'}`;
    try {
        try { await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } }); } catch (_) {}
        fs.writeFileSync(inFile, await downloadBuffer(q.media, q.kind === 'document' ? 'document' : q.kind));

        if (name === 'tomp3') {
            await runFfmpeg(['-i', inFile, '-vn', '-c:a', 'libmp3lame', '-b:a', '128k', outFile]);
            await conn.sendMessage(from, { audio: fs.readFileSync(outFile), mimetype: 'audio/mpeg', ptt: false }, { quoted: mek });
        } else if (name === 'toptt') {
            await runFfmpeg(['-i', inFile, '-vn', '-c:a', 'libopus', '-b:a', '48k', '-ar', '48000', '-ac', '1', '-f', 'ogg', outFile]);
            await conn.sendMessage(from, { audio: fs.readFileSync(outFile), mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: mek });
        } else {
            const fx = EFFECTS[name];
            await runFfmpeg(['-i', inFile, '-vn', '-af', fx.af, '-c:a', 'libopus', '-b:a', '64k', '-ar', '48000', '-ac', '1', '-f', 'ogg', outFile]);
            // jo audio voice note thi wo voice note rahe, baqi normal audio
            const asVoice = q.kind === 'audio' ? !!q.media.ptt : false;
            await conn.sendMessage(from, { audio: fs.readFileSync(outFile), mimetype: 'audio/ogg; codecs=opus', ptt: asVoice }, { quoted: mek });
        }
        try { await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }); } catch (_) {}
    } catch (e) {
        console.error(`audio-effects (${name}):`, e && e.message);
        try { await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }); } catch (_) {}
        if (e && e.message === 'too_big') return reply('❌ File bohat bari hai (max 40 MB).');
        return reply(`❌ ${name} nahi ho saka. Koi doosri audio try karo.`);
    } finally {
        for (const f of [inFile, outFile]) { try { fs.unlinkSync(f); } catch (_) {} }
    }
}

// ── effect commands ──
for (const [name, fx] of Object.entries(EFFECTS)) {
    cmd({
        pattern: name, desc: `${fx.icon} ${fx.desc} (audio par reply karo)`, use: `.${name} (audio par reply)`,
        category: 'audio', react: fx.icon, filename: __filename
    }, async (conn, mek, m, { from, reply, q }) => {
        // .reverse sirf text ke saath likha ho (audio par reply nahi) to purana text-reverse chale
        if (name === 'reverse' && !getQuotedMedia(mek) && String(q || '').trim()) {
            return reply(`🔁 *REVERSED TEXT*\n\n${Array.from(String(q)).reverse().join('')}`);
        }
        return processAudio(conn, mek, from, reply, name);
    });
}

// ── converters ──
cmd({
    pattern: 'tomp3', desc: '🎵 Video / voice ko MP3 audio me badlo (reply karo)', use: '.tomp3 (audio/video par reply)',
    category: 'audio', react: '🎵', filename: __filename
}, async (conn, mek, m, { from, reply }) => processAudio(conn, mek, from, reply, 'tomp3'));

cmd({
    pattern: 'toptt', desc: '🎙️ Audio / video ko voice note (PTT) me badlo (reply karo)', use: '.toptt (audio/video par reply)',
    category: 'audio', react: '🎙️', filename: __filename
}, async (conn, mek, m, { from, reply }) => processAudio(conn, mek, from, reply, 'toptt'));

module.exports = { EFFECTS };
