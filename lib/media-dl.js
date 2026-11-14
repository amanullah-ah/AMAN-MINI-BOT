// lib/media-dl.js
// API-FREE media downloader.
//   1) yt-dlp (local binary, auto-downloaded once from GitHub if missing)
//   2) @distube/ytdl-core / ytdl-core  (pure node, YouTube only)
// No third-party "converter" websites involved.
//
// Optional env:
//   YTDLP_PATH        full path of a yt-dlp binary you already have
//   YTDLP_COOKIES     path to cookies.txt (helps when YouTube shows "confirm you're not a bot")
//   YTDLP_EXTRA_ARGS  extra args, space separated

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const { spawn, spawnSync } = require('child_process');

const BIN_DIR = path.join(__dirname, 'bin');
const IS_WIN = process.platform === 'win32';
const BIN_NAME = IS_WIN ? 'yt-dlp.exe' : 'yt-dlp';
const MAX_BYTES = 100 * 1024 * 1024;

function ffmpegLocation() {
    try { return require('@ffmpeg-installer/ffmpeg').path; } catch (_) {}
    return 'ffmpeg';
}

// ─────────────── yt-dlp binary ───────────────
let ytdlpPromise = null;

function works(bin) {
    try {
        const r = spawnSync(bin, ['--version'], { timeout: 15000 });
        return r.status === 0;
    } catch (_) { return false; }
}

async function downloadYtDlp(dest) {
    let asset = 'yt-dlp_linux';
    if (IS_WIN) asset = 'yt-dlp.exe';
    else if (process.platform === 'darwin') asset = 'yt-dlp_macos';
    else if (process.arch === 'arm64') asset = 'yt-dlp_linux_aarch64';

    const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;
    console.log(`[MEDIA-DL] Downloading yt-dlp (${asset}) ...`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const tmp = dest + '.part';
    const res = await axios.get(url, { responseType: 'stream', timeout: 120000, maxRedirects: 10 });
    await new Promise((resolve, reject) => {
        const w = fs.createWriteStream(tmp);
        res.data.pipe(w);
        w.on('finish', resolve);
        w.on('error', reject);
        res.data.on('error', reject);
    });
    fs.renameSync(tmp, dest);
    if (!IS_WIN) fs.chmodSync(dest, 0o755);
}

// Naye yt-dlp ko YouTube ke liye ek JavaScript runtime chahiye (warna formats nahi milte).
// Bot Node.js par chalta hai, isliye wahi runtime yt-dlp ko de dete hain.
let JS_RUNTIME_ARGS = [];
function detectJsRuntime(bin) {
    try {
        const r = spawnSync(bin, ['--help'], { timeout: 15000, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
        if (/--js-runtimes/.test(String(r.stdout || ''))) {
            JS_RUNTIME_ARGS = ['--js-runtimes', 'node:' + process.execPath];
            return;
        }
    } catch (_) {}
    JS_RUNTIME_ARGS = [];
}

function ensureYtDlp() {
    if (ytdlpPromise) return ytdlpPromise;
    ytdlpPromise = (async () => {
        const candidates = [process.env.YTDLP_PATH, path.join(BIN_DIR, BIN_NAME), 'yt-dlp', 'yt-dlp_linux'].filter(Boolean);
        for (const c of candidates) if (works(c)) { detectJsRuntime(c); return c; }

        const dest = path.join(BIN_DIR, BIN_NAME);
        await downloadYtDlp(dest);
        if (works(dest)) { detectJsRuntime(dest); return dest; }
        throw new Error('YTDLP_UNAVAILABLE');
    })().catch(err => { ytdlpPromise = null; throw err; });
    return ytdlpPromise;
}

// Railway par file upload mushkil hoti hai, isliye cookies env variable se bhi le sakte hain:
//   YTDLP_COOKIES_B64  = cookies.txt ka base64      (ya)   YTDLP_COOKIES_TEXT = cookies.txt ka poora text
let cookiesTmp = null;
function cookiesFile() {
    if (process.env.YTDLP_COOKIES && fs.existsSync(process.env.YTDLP_COOKIES)) return process.env.YTDLP_COOKIES;
    if (cookiesTmp && fs.existsSync(cookiesTmp)) return cookiesTmp;
    let raw = '';
    if (process.env.YTDLP_COOKIES_B64) {
        try { raw = Buffer.from(process.env.YTDLP_COOKIES_B64.trim(), 'base64').toString('utf8'); } catch (_) {}
    } else if (process.env.YTDLP_COOKIES_TEXT) {
        raw = String(process.env.YTDLP_COOKIES_TEXT).replace(/\\n/g, '\n');
    }
    if (!raw.trim()) return null;
    try {
        const f = path.join(os.tmpdir(), 'aman-yt-cookies.txt');
        fs.writeFileSync(f, raw, { mode: 0o600 });
        cookiesTmp = f;
        return f;
    } catch (_) { return null; }
}

// keep the binary fresh (YouTube changes often) — called at most once per 12h on failure
let lastUpdate = 0;
async function tryUpdateYtDlp() {
    if (Date.now() - lastUpdate < 12 * 3600 * 1000) return false;
    lastUpdate = Date.now();
    try {
        const bin = await ensureYtDlp();
        const r = await run(bin, ['-U'], 90000);
        const updated = /updated yt-dlp|updating to/i.test(String(r.out) + String(r.err));
        if (updated) console.log('[MEDIA-DL] yt-dlp updated');
        return updated;
    } catch (_) { return false; }
}

// Fail hone par yt-dlp update karke ek baar dobara try (YouTube aksar badalta rehta hai)
async function withUpdateRetry(fn) {
    try { return await fn(); }
    catch (e) {
        if (/TOO_BIG|YTDLP_UNAVAILABLE/.test(e.message + JSON.stringify(e.details || []))) throw e;
        if (await tryUpdateYtDlp()) return await fn();
        throw e;
    }
}

// yt-dlp badi file par download chhod deta hai (exit 0, file nahi) — usay saaf error banao
async function runDl(bin, args, timeoutMs) {
    const r = await run(bin, args, timeoutMs);
    if (/larger than max-filesize/i.test(String(r.out) + String(r.err))) throw new Error('TOO_BIG');
    return r;
}

function run(bin, args, timeoutMs) {
    return new Promise((resolve, reject) => {
        const p = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '', err = '';
        const timer = setTimeout(() => { try { p.kill('SIGKILL'); } catch (_) {} reject(new Error('TIMEOUT')); }, timeoutMs);
        p.stdout.on('data', d => { out += d; if (out.length > 200000) out = out.slice(-100000); });
        p.stderr.on('data', d => { err += d; if (err.length > 200000) err = err.slice(-100000); });
        p.on('error', e => { clearTimeout(timer); reject(e); });
        p.on('close', code => {
            clearTimeout(timer);
            if (code === 0) resolve({ out, err });
            else reject(Object.assign(new Error(`yt-dlp exit ${code}: ${err.trim().split('\n').pop() || ''}`), { stderr: err }));
        });
    });
}

function baseArgs() {
    const args = [
        '--no-playlist', '--no-warnings', '--no-progress',
        '--socket-timeout', '20', '--retries', '3',
        '--max-filesize', String(MAX_BYTES),
        '--ffmpeg-location', ffmpegLocation(),
        ...JS_RUNTIME_ARGS
    ];
    const ck = cookiesFile();
    if (ck) args.push('--cookies', ck);
    if (process.env.YTDLP_EXTRA_ARGS) args.push(...process.env.YTDLP_EXTRA_ARGS.split(/\s+/).filter(Boolean));
    return args;
}

async function withTmpDir(fn) {
    const dir = path.join(os.tmpdir(), 'aman-dl-' + crypto.randomBytes(6).toString('hex'));
    fs.mkdirSync(dir, { recursive: true });
    try { return await fn(dir); }
    finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} }
}

function pickOutput(dir, exts) {
    const files = fs.readdirSync(dir)
        .filter(f => exts.some(e => f.toLowerCase().endsWith(e)))
        .map(f => ({ f, s: fs.statSync(path.join(dir, f)).size }))
        .sort((a, b) => b.s - a.s);
    return files[0] ? path.join(dir, files[0].f) : null;
}

// ─────────────── YouTube client ladder ───────────────
// Datacenter IPs are often refused by the default YouTube client ("confirm you're not a bot").
// Other player clients frequently still work without cookies, so we try them one by one.
const YT_CLIENTS = [null, 'android_vr', 'tv', 'web_safari', 'mweb', 'ios'];

function isYoutubeUrl(u) { return /(?:youtube\.com|youtu\.be|music\.youtube\.com)/i.test(String(u || '')); }

async function tryClients(url, fn) {
    const list = isYoutubeUrl(url) ? YT_CLIENTS : [null];
    const errors = [];
    for (const c of list) {
        try {
            return await fn(c ? ['--extractor-args', `youtube:player_client=${c}`] : []);
        } catch (e) {
            errors.push(`${c || 'default'}: ${String(e.message).slice(0, 200)}`);
            console.warn(`[MEDIA-DL] client ${c || 'default'} failed:`, String(e.message).slice(0, 160));
            if (/TIMEOUT|TOO_BIG|larger than max-filesize|YTDLP_UNAVAILABLE/i.test(e.message)) break;
        }
    }
    const err = new Error(errors[errors.length - 1] || 'yt-dlp failed');
    err.details = errors;
    throw err;
}

// ─────────────── yt-dlp: audio / video ───────────────
async function ytdlpAudio(url) {
    const bin = await ensureYtDlp();
    return tryClients(url, extra => withTmpDir(async dir => {
        await runDl(bin, [
            ...baseArgs(), ...extra,
            '-f', 'bestaudio/best',
            '-x', '--audio-format', 'mp3', '--audio-quality', '0',
            '-o', path.join(dir, 'audio.%(ext)s'),
            url
        ], 120000);
        const file = pickOutput(dir, ['.mp3', '.m4a', '.opus', '.ogg', '.webm']);
        if (!file) throw new Error('NO_OUTPUT_FILE');
        return { buffer: fs.readFileSync(file), ext: path.extname(file).slice(1) };
    }));
}

async function ytdlpVideo(url, maxHeight = 720) {
    const bin = await ensureYtDlp();
    return tryClients(url, extra => withTmpDir(async dir => {
        await runDl(bin, [
            ...baseArgs(), ...extra,
            '-f', `bv*[height<=${maxHeight}][ext=mp4]+ba[ext=m4a]/b[height<=${maxHeight}][ext=mp4]/b[height<=${maxHeight}]/b`,
            '--merge-output-format', 'mp4',
            '-o', path.join(dir, 'video.%(ext)s'),
            url
        ], 240000);
        const file = pickOutput(dir, ['.mp4', '.mkv', '.webm', '.mov']);
        if (!file) throw new Error('NO_OUTPUT_FILE');
        return { buffer: fs.readFileSync(file), ext: path.extname(file).slice(1) };
    }));
}

// ─────────────── ytdl-core fallback (YouTube only) ───────────────
function loadYtdlCore() {
    for (const name of ['@distube/ytdl-core', 'ytdl-core']) {
        try { return require(name); } catch (_) {}
    }
    return null;
}

async function ytdlCoreAudio(url) {
    const ytdl = loadYtdlCore();
    if (!ytdl) throw new Error('YTDL_CORE_MISSING');
    const ffmpeg = require('fluent-ffmpeg');
    ffmpeg.setFfmpegPath(ffmpegLocation());

    return withTmpDir(async dir => {
        const out = path.join(dir, 'audio.mp3');
        await new Promise((resolve, reject) => {
            const stream = ytdl(url, { filter: 'audioonly', quality: 'highestaudio', highWaterMark: 1 << 25 });
            stream.on('error', reject);
            ffmpeg(stream)
                .audioBitrate(192)
                .format('mp3')
                .on('error', reject)
                .on('end', resolve)
                .save(out);
        });
        const buffer = fs.readFileSync(out);
        if (buffer.length < 5000) throw new Error('TOO_SMALL');
        return { buffer, ext: 'mp3' };
    });
}

// ─────────────── public API ───────────────
async function soundcloudAudio(query) {
    const bin = await ensureYtDlp();
    return withTmpDir(async dir => {
        await runDl(bin, [
            ...baseArgs(),
            '-f', 'bestaudio/best',
            '-x', '--audio-format', 'mp3', '--audio-quality', '0',
            '-o', path.join(dir, 'audio.%(ext)s'),
            `scsearch1:${query}`
        ], 120000);
        const file = pickOutput(dir, ['.mp3', '.m4a', '.opus', '.ogg', '.webm']);
        if (!file) throw new Error('NO_OUTPUT_FILE');
        return { buffer: fs.readFileSync(file), ext: path.extname(file).slice(1), source: 'soundcloud' };
    });
}

async function downloadAudio(url, opts = {}) {
    const errors = [];
    try { return await withUpdateRetry(() => ytdlpAudio(url)); }
    catch (e) { errors.push(...(e.details || ['yt-dlp: ' + e.message])); console.warn('[MEDIA-DL] yt-dlp audio failed:', e.message); }

    try { return await ytdlCoreAudio(url); }
    catch (e) { errors.push('ytdl-core: ' + e.message); console.warn('[MEDIA-DL] ytdl-core audio failed:', e.message); }

    if (opts.fallbackQuery) {
        try { return await soundcloudAudio(opts.fallbackQuery); }
        catch (e) { errors.push('soundcloud: ' + e.message); console.warn('[MEDIA-DL] soundcloud failed:', e.message); }
    }

    const err = new Error('LOCAL_DOWNLOAD_FAILED');
    err.details = errors;
    throw err;
}

async function downloadVideo(url, maxHeight) {
    // badi file ho to quality kam karke dobara (720 -> 480 -> 360 -> 240)
    const ladder = [maxHeight || 720, 480, 360, 240].filter((h, i, a) => h <= (maxHeight || 720) && a.indexOf(h) === i);
    let last;
    for (const h of ladder) {
        try { return await withUpdateRetry(() => ytdlpVideo(url, h)); }
        catch (e) {
            last = e;
            console.warn(`[MEDIA-DL] yt-dlp video ${h}p failed:`, e.message);
            if (!/TOO_BIG/.test(e.message + JSON.stringify(e.details || []))) break;
        }
    }
    const err = new Error('LOCAL_DOWNLOAD_FAILED');
    err.details = (last && last.details) || [last ? last.message : 'unknown'];
    throw err;
}

// Fail ki wajah ko chat ke liye asaan Roman Urdu hint mein badalta hai
function explainError(e) {
    const why = String((e && e.message) || '') + ' ' + JSON.stringify((e && e.details) || []);
    // asli error ki aakhri line (screenshot bhej kar wajah pata chal sake)
    const lastRaw = String(((e && e.details && e.details[e.details.length - 1]) || (e && e.message) || ''))
        .replace(/\s+/g, ' ').replace(/https?:\/\/\S+/g, '<link>').trim().slice(0, 170);
    const tail = lastRaw ? '\n📋 ' + lastRaw : '';

    if (/TOO_BIG|larger than max-filesize/i.test(why)) return 'Video bohat bari hai (WhatsApp limit).';
    if (/YTDLP_UNAVAILABLE/i.test(why)) return 'yt-dlp server par install nahi hua (shayad GitHub khul nahi raha). .dltest chalao.' + tail;
    if (/sign in to confirm|not a bot|login required|cookies|HTTP Error 4(03|29)|rate-limit|too many requests|requested content is not available/i.test(why)) return 'YouTube ne server ka IP block kiya hai. Browser se cookies.txt export karke YTDLP_COOKIES_B64 env mein daalo.' + tail;
    if (/n challenge|nsig|js runtime|javascript runtime|ejs|Signature solving/i.test(why)) return 'yt-dlp purana hai ya JS runtime nahi mila. Bot redeploy karo (yt-dlp update ho jayega).' + tail;
    if (/Private video|members-only|Video unavailable|has been removed|not available in your country/i.test(why)) return 'Video private/removed/region-blocked hai.' + tail;
    if (/ffmpeg|ffprobe/i.test(why)) return 'ffmpeg missing hai. .dltest chalao.' + tail;
    if (/NO_OUTPUT_FILE/i.test(why)) return 'Download se file nahi bani (link ya format support nahi). .dltest chalao.' + tail;
    if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|getaddrinfo|Temporary failure in name resolution|Name or service not known|timed out|TIMEOUT/i.test(why)) return 'Server se internet/site nahi khul rahi (network ya timeout). .dltest chalao.' + tail;
    return (tail ? 'Wajah:' + tail : '') + '\n.dltest chalao.';
}

// .dltest: yt-dlp / ffmpeg / JS runtime / cookies ki haalat + ek asli test (download kiye bina)
async function diagnose(url) {
    const out = [];
    let bin = null;
    try { bin = await ensureYtDlp(); out.push('✅ yt-dlp: ' + bin); }
    catch (e) { out.push('❌ yt-dlp nahi mila/install nahi hua: ' + String(e.message).slice(0, 120)); }
    if (bin) {
        try {
            const v = spawnSync(bin, ['--version'], { encoding: 'utf8', timeout: 15000 });
            out.push('   version: ' + String(v.stdout || v.stderr || '?').trim().slice(0, 40));
        } catch (_) {}
        out.push(JS_RUNTIME_ARGS.length ? '✅ JS runtime: node' : '⚠️ JS runtime: yt-dlp ko --js-runtimes nahi mila (purana yt-dlp?)');
    }
    try {
        const f = ffmpegLocation();
        const r = spawnSync(f, ['-version'], { encoding: 'utf8', timeout: 10000 });
        out.push(r.status === 0 ? '✅ ffmpeg theek' : '❌ ffmpeg nahi chala');
    } catch (_) { out.push('❌ ffmpeg nahi mila'); }
    out.push(cookiesFile() ? '✅ cookies: lagi hui hain' : 'ℹ️ cookies: nahi (YouTube block kare to zaroori)');
    if (bin && url) {
        try {
            const r = await run(bin, [...baseArgs(), '--simulate', '-f', 'bestaudio/best', '--no-playlist', url], 60000);
            out.push('✅ YouTube test: video info mil gayi (download chal sakta hai)');
        } catch (e) {
            const tail = String(e.message || e).replace(/\s+/g, ' ').replace(/https?:\/\/\S+/g, '<link>').slice(-300);
            out.push('❌ YouTube test fail:\n' + tail);
        }
    }
    return out.join('\n');
}

// ─────────────── FULL-LENGTH video to a FILE (no RAM buffer, quality ladder) ───────────────
// Tries 480p -> 360p -> 240p -> 144p until the file fits `maxBytes`.
// Never uses any "converter" website, so you always get the real, full video.
function baseArgsFile(maxBytes) {
    return baseArgs().map((a, i, arr) => (arr[i - 1] === '--max-filesize' ? String(maxBytes) : a));
}

function probeDuration(file) {
    try {
        const r = spawnSync(ffmpegLocation(), ['-i', file], { encoding: 'utf8', timeout: 30000 });
        const m = String((r.stderr || '') + (r.stdout || '')).match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
        if (!m) return 0;
        return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    } catch (_) { return 0; }
}

async function downloadFullVideoFile(url, opts = {}) {
    const maxBytes = opts.maxBytes || 250 * 1024 * 1024;
    const ladder = opts.heights || [480, 360, 240, 144];
    const bin = await ensureYtDlp();
    const dir = path.join(os.tmpdir(), 'aman-full-' + crypto.randomBytes(6).toString('hex'));
    fs.mkdirSync(dir, { recursive: true });
    const cleanup = () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} };
    const errors = [];
    for (const h of ladder) {
        try {
            for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { force: true });
            await tryClients(url, extra => runDl(bin, [
                ...baseArgsFile(maxBytes), ...extra,
                '-f', `bv*[height<=${h}][ext=mp4]+ba[ext=m4a]/b[height<=${h}][ext=mp4]/b[height<=${h}]/b`,
                '--merge-output-format', 'mp4',
                '-o', path.join(dir, 'video.%(ext)s'),
                url
            ], opts.timeoutMs || 20 * 60 * 1000));
            const file = pickOutput(dir, ['.mp4', '.mkv', '.webm', '.mov']);
            if (!file) throw new Error('NO_OUTPUT_FILE');
            const size = fs.statSync(file).size;
            if (size > maxBytes) throw new Error('TOO_BIG');
            return { path: file, size, height: h, duration: probeDuration(file), cleanup };
        } catch (e) {
            errors.push(`${h}p: ${e.message}`);
            console.warn(`[MEDIA-DL] full video ${h}p failed:`, e.message);
        }
    }
    cleanup();
    tryUpdateYtDlp();
    const err = new Error('LOCAL_DOWNLOAD_FAILED');
    err.details = errors;
    throw err;
}

// Any site yt-dlp supports (Instagram, Facebook, TikTok, X, ...) — returns mp4
async function downloadAnyVideo(url) {
    return downloadVideo(url, 720);
}

module.exports = { diagnose, explainError, ensureYtDlp, ffmpegLocation, isYoutubeUrl, downloadAudio, downloadVideo, downloadAnyVideo, downloadFullVideoFile, probeDuration, MAX_BYTES };
