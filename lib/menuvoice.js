// lib/menuvoice.js — menu voice fix
// Masla: mp3 ko "audio/mp4" + ptt:true bhejne se WhatsApp bolta hai "something is wrong with the audio file".
// Hal: mp3 ko ffmpeg se OGG/Opus me badlo (voice-note format), cache karo, aur sahi mimetype se bhejo.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

let FFMPEG = 'ffmpeg';
try { FFMPEG = require('@ffmpeg-installer/ffmpeg').path || 'ffmpeg'; } catch (_) {}

const DIR = path.join(__dirname, '..', 'data', 'menu-voice');
const CACHE = path.join(os.tmpdir(), 'aman-menu-voice');

function toOpus(src) {
    return new Promise((resolve) => {
        try {
            fs.mkdirSync(CACHE, { recursive: true });
            const out = path.join(CACHE, path.basename(src).replace(/\.[^.]+$/, '') + '.ogg');
            if (fs.existsSync(out) && fs.statSync(out).size > 1000) return resolve(out);
            execFile(FFMPEG, ['-y', '-i', src, '-vn', '-map_metadata', '-1', '-c:a', 'libopus', '-b:a', '48k', '-ar', '48000', '-ac', '1', '-application', 'voip', out],
                { timeout: 60000 }, (err) => {
                    if (err || !fs.existsSync(out) || fs.statSync(out).size < 1000) return resolve(null);
                    resolve(out);
                });
        } catch (_) { resolve(null); }
    });
}

async function sendMenuVoice(conn, from, quoted) {
    try {
        if (!fs.existsSync(DIR)) return;
        const files = fs.readdirSync(DIR).filter(f => /\.(mp3|ogg|opus)$/i.test(f));
        if (!files.length) return;
        const src = path.join(DIR, files[Math.floor(Math.random() * files.length)]);
        const ogg = /\.(ogg|opus)$/i.test(src) ? src : await toOpus(src);
        if (ogg) {
            return await conn.sendMessage(from, { audio: fs.readFileSync(ogg), mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted });
        }
        // ffmpeg na chale to mp3 ko normal audio ki tarah bhejo (voice-note nahi)
        return await conn.sendMessage(from, { audio: fs.readFileSync(src), mimetype: 'audio/mpeg', ptt: false }, { quoted });
    } catch (err) { console.log('Menu audio error:', err && err.message); }
}

// startup par saari mp3 pehle se OGG me badal do (pehli .menu bhi fast)
async function warm() {
    try {
        if (!fs.existsSync(DIR)) return;
        for (const f of fs.readdirSync(DIR).filter(f => /\.mp3$/i.test(f))) await toOpus(path.join(DIR, f));
    } catch (_) {}
}

module.exports = { sendMenuVoice, warm };
