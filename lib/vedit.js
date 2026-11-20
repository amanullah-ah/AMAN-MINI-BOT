// lib/vedit.js — ffmpeg helpers for the VIDEO EDITING commands (plugins/video-templates.js, plugins/ai-extra.js)
// Sab kuch ffmpeg se hota hai (API key nahi). Dockerfile me ffmpeg + fonts-dejavu-core install hain.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

let FFMPEG = 'ffmpeg';
try { FFMPEG = require('@ffmpeg-installer/ffmpeg').path || 'ffmpeg'; } catch (_) {}

const MAX_INPUT_BYTES = 40 * 1024 * 1024;     // 40 MB se bari file nahi
const MAX_SECONDS = Number(process.env.VEDIT_MAX_SECONDS) || 60;   // output max itni der ka
const JOB_TIMEOUT_MS = 4 * 60 * 1000;

const tmpFile = (ext) => path.join(os.tmpdir(), `vedit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`);
const rm = (...files) => { for (const f of files) { try { if (f) fs.unlinkSync(f); } catch (_) {} } };

function run(args, timeout = JOB_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
        execFile(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { timeout, maxBuffer: 20 * 1024 * 1024 }, (err, _out, stderr) => {
            if (err) return reject(new Error(String(stderr || err.message).trim().split('\n').slice(-2).join(' ').slice(0, 200)));
            resolve();
        });
    });
}

// quoted video/image (ya khud caption wali video/image) ko download karke { buffer, kind } deta hai
async function getMedia(m, opts = {}) {
    const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
    const pick = (mtype) => mtype === 'videoMessage' ? 'video' : mtype === 'imageMessage' ? 'image' : (opts.audio && mtype === 'audioMessage') ? 'audio' : null;
    let kind = null, buffer = null;
    if (m.quoted && !m.quoted.isViewOnce && pick(m.quoted.mtype)) {
        kind = pick(m.quoted.mtype);
        const size = Number(m.quoted.msg?.fileLength || 0);
        if (size > MAX_INPUT_BYTES) throw new Error('File bohat bari hai (max 40MB)');
        buffer = await m.quoted.download();
    } else if (pick(m.mtype)) {
        kind = pick(m.mtype);
        const size = Number(m.msg?.fileLength || 0);
        if (size > MAX_INPUT_BYTES) throw new Error('File bohat bari hai (max 40MB)');
        const stream = await downloadContentFromMessage(m.msg, kind);
        const chunks = [];
        for await (const c of stream) chunks.push(c);
        buffer = Buffer.concat(chunks);
    }
    if (!buffer || !buffer.length) return null;
    if (buffer.length > MAX_INPUT_BYTES) throw new Error('File bohat bari hai (max 40MB)');
    return { buffer, kind };
}

// video ki lambai (seconds); na mile to 0
function probeDuration(file) {
    return new Promise((resolve) => {
        execFile(FFMPEG, ['-hide_banner', '-i', file], { timeout: 30000, maxBuffer: 5 * 1024 * 1024 }, (_err, _out, stderr) => {
            const mm = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(String(stderr || ''));
            resolve(mm ? (+mm[1]) * 3600 + (+mm[2]) * 60 + parseFloat(mm[3]) : 0);
        });
    });
}

// caption ke liye font dhoondo (drawtext ko font file chahiye)
const FONT_CANDIDATES = [
    process.env.VEDIT_FONT,
    path.join(__dirname, '..', 'assets', 'fonts', 'font.ttf'),
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf'
].filter(Boolean);
const findFont = () => FONT_CANDIDATES.find(f => { try { return fs.existsSync(f); } catch (_) { return false; } }) || null;

// lambi caption ko lines me todo (drawtext khud wrap nahi karta)
function wrapText(text, width = 26) {
    const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ');
    const lines = []; let cur = '';
    for (const w of words) {
        if ((cur + ' ' + w).trim().length > width && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
    }
    if (cur) lines.push(cur);
    return lines.slice(0, 4).join('\n');
}

// image ko 720px wali even-size jpeg banao (zoom video ke liye)
async function prepImage(buffer) {
    const sharp = require('sharp');
    const meta = await sharp(buffer).metadata();
    const w0 = meta.width || 720, h0 = meta.height || 720;
    let W = 720, H = Math.round((720 * h0 / w0) / 2) * 2;
    if (H > 1280) { H = 1280; W = Math.round((1280 * w0 / h0) / 2) * 2; }
    if (H < 2) H = 2;
    const out = await sharp(buffer).rotate().resize(W, H, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer();
    return { buffer: out, W, H };
}

module.exports = { FFMPEG, MAX_SECONDS, tmpFile, rm, run, getMedia, probeDuration, findFont, wrapText, prepImage };
