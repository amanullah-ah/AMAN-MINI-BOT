// lib/bgmusic.js — voice ke peeche background music (assets/bgmusic/*.mp3)
// .bgmusic on  -> .tts / .jarvis / .raju / .aivoice ki har voice par music lag jati hai
// Setting botNumber ke hisaab se save hoti hai (config key: BGMUSIC = 'true' / 'false').

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { getUserConfigFromMongoDB, updateUserConfigInMongoDB } = require('./database');

let FFMPEG = 'ffmpeg';
try { FFMPEG = require('@ffmpeg-installer/ffmpeg').path || 'ffmpeg'; } catch (_) {}

const MUSIC_DIR = path.join(__dirname, '..', 'assets', 'bgmusic');
const KEY = 'BGMUSIC';
const VOL_KEY = 'BGMUSIC_VOL';   // 1-10
const DEFAULT_LEVEL = 4;         // 4 = 0.16 (pehle wali awaaz)
const levelToGain = (l) => +(l * 0.04).toFixed(2);   // 1=0.04 ... 5=0.20 ... 10=0.40
const LEAD_IN = 1;           // voice se pehle itne second sirf music
const TAIL = 2.5;            // voice ke baad itne second music, phir fade-out

const num = (n) => String(n || '').replace(/[^0-9]/g, '');
const botNum = (conn, botNumber) => num(botNumber || (conn && conn.user && String(conn.user.id).split(':')[0].split('@')[0]));

async function isOn(conn, botNumber) {
    try {
        const cfg = (await getUserConfigFromMongoDB(botNum(conn, botNumber))) || {};
        return String(cfg[KEY]) === 'true';
    } catch (_) { return false; }
}

async function getLevel(conn, botNumber) {
    try {
        const cfg = (await getUserConfigFromMongoDB(botNum(conn, botNumber))) || {};
        const l = parseInt(cfg[VOL_KEY], 10);
        return l >= 1 && l <= 10 ? l : DEFAULT_LEVEL;
    } catch (_) { return DEFAULT_LEVEL; }
}

async function setLevel(conn, botNumber, level) {
    const n = botNum(conn, botNumber);
    let cfg = {};
    try { cfg = (await getUserConfigFromMongoDB(n)) || {}; } catch (_) {}
    return updateUserConfigInMongoDB(n, { ...cfg, [VOL_KEY]: String(level) });
}

async function setOn(conn, botNumber, on) {
    const n = botNum(conn, botNumber);
    let cfg = {};
    try { cfg = (await getUserConfigFromMongoDB(n)) || {}; } catch (_) {}
    return updateUserConfigInMongoDB(n, { ...cfg, [KEY]: on ? 'true' : 'false' });
}

function tracks() {
    try { return fs.readdirSync(MUSIC_DIR).filter(f => /\.(mp3|m4a|ogg|wav)$/i.test(f)).sort(); }
    catch (_) { return []; }
}

function run(args, timeout = 60000) {
    return new Promise((resolve, reject) => {
        execFile(FFMPEG, args, { timeout, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) { err.stderr = stderr; return reject(err); }
            resolve(String(stderr || ''));
        });
    });
}

// voice file ki length (second) — ffprobe ki zaroorat nahi, ffmpeg ke output se
async function duration(file) {
    try { await run(['-i', file, '-f', 'null', '-'], 30000); } catch (e) {
        const m = /Duration: (\d+):(\d+):(\d+\.?\d*)/.exec(String(e.stderr || ''));
        if (m) return (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]);
    }
    return 0;
}

// voice (mp3/ogg Buffer) + random music  ->  OGG/Opus Buffer (WhatsApp voice note).
// Kuch bhi gadbad ho to null deta hai (caller bina music ke bhej deta hai).
async function mixVoice(voiceBuf, conn, botNumber) {
    const list = tracks();
    if (!list.length || !voiceBuf || !voiceBuf.length) return null;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aman-bgm-'));
    const vIn = path.join(dir, 'voice.mp3');
    const out = path.join(dir, 'mixed.ogg');
    try {
        fs.writeFileSync(vIn, voiceBuf);
        const music = path.join(MUSIC_DIR, list[Math.floor(Math.random() * list.length)]);
        const gain = levelToGain(await getLevel(conn, botNumber));
        const len = await duration(vIn);
        const total = len > 0 ? len + LEAD_IN + TAIL : 0;
        const fadeOut = total > 0 ? `,afade=t=out:st=${Math.max(0, total - TAIL).toFixed(2)}:d=${TAIL}` : '';
        const ms = Math.round(LEAD_IN * 1000);
        // amix ka "normalize" option purane ffmpeg (4.1) mein nahi hota, isliye volume=2 + limiter
        const filter =
            `[0:a]aresample=48000,aformat=channel_layouts=mono,adelay=${ms},apad=pad_dur=${TAIL}[v];` +
            `[1:a]aresample=48000,aformat=channel_layouts=mono,volume=${gain},afade=t=in:d=1[m];` +
            `[v][m]amix=inputs=2:duration=first:dropout_transition=0,volume=2,alimiter=limit=0.95${fadeOut}[a]`;
        await run([
            '-hide_banner', '-loglevel', 'error', '-y',
            '-i', vIn,
            '-stream_loop', '-1', '-i', music,
            '-filter_complex', filter, '-map', '[a]',
            ...(total > 0 ? ['-t', total.toFixed(2)] : []),
            '-c:a', 'libopus', '-b:a', '48k', '-ar', '48000', '-ac', '1', '-application', 'voip', '-f', 'ogg', out
        ], 90000);
        const ogg = fs.readFileSync(out);
        if (ogg.length < 1000 || ogg.toString('ascii', 0, 4) !== 'OggS') return null;
        return ogg;
    } catch (e) {
        console.error('[bgmusic] mix fail:', (e && e.stderr) || (e && e.message) || e);
        return null;
    } finally {
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
    }
}

module.exports = { isOn, setOn, getLevel, setLevel, mixVoice, tracks };
