// lib/botpic.js — per-session bot picture (menu / alive / connected message)
// Stored in data/botpics/<session-number>.jpg, falls back to config.IMAGE_PATH.

const fs = require('fs');
const path = require('path');
const config = require('../config');

const DIR = path.join(__dirname, '..', 'data', 'botpics');
const numberOf = conn => String(conn?.user?.id || '').split(':')[0].split('@')[0];
const fileFor = conn => path.join(DIR, numberOf(conn) + '.jpg');

// ---- SPEED FIX: remote image (postimg) har baar download hoti thi -> ab ek baar download karke memory me cache ----
const remoteCache = new Map();
const pending = new Set();
function getCachedImage(url) {
    if (!/^https?:\/\//i.test(String(url || ''))) return null;
    if (remoteCache.has(url)) return remoteCache.get(url);
    if (!pending.has(url)) {
        pending.add(url);
        require('axios').get(url, { responseType: 'arraybuffer', timeout: 15000, maxContentLength: 15 * 1024 * 1024, headers: { 'User-Agent': 'Mozilla/5.0' } })
            .then(r => { if (/^image\//i.test(String(r.headers['content-type'] || ''))) remoteCache.set(url, Buffer.from(r.data)); })
            .catch(() => {})
            .finally(() => pending.delete(url));
    }
    return null;   // pehli baar: abhi download ho rahi hai, is baar purana tareeqa (url) chalega
}

// use as: { image: getBotPic(conn), caption }
function getBotPic(conn) {
    try {
        const f = fileFor(conn);
        if (numberOf(conn) && fs.existsSync(f)) return { url: f };
    } catch (_) {}
    return getCachedImage(config.IMAGE_PATH) || { url: config.IMAGE_PATH };
}

// ---- MENU IMAGES: ye 4 images menu par baari-baari (random) aati hain ----
// Env MENU_IMAGES (comma se alag links) se badal sakte ho. Khali list = purani bot picture.
const MENU_IMAGES = String(process.env.MENU_IMAGES || '').split(',').map(x => x.trim()).filter(Boolean);
if (!MENU_IMAGES.length) MENU_IMAGES.push(
    'https://i.postimg.cc/7ZYwCBs9/image1.jpg',
    'https://i.postimg.cc/02C9ygfM/image2.jpg',
    'https://i.postimg.cc/8zPNFyK0/image3.jpg',
    'https://i.postimg.cc/zGX8Ldtk/image4.jpg'
);
let lastMenuIdx = -1;
// -> { pic, key }   pic = { image: pic } me use karo; key = cache ke liye pehchan
function getMenuPic(conn) {
    if (!MENU_IMAGES.length) return { pic: getBotPic(conn), key: 'botpic' };
    let i = Math.floor(Math.random() * MENU_IMAGES.length);
    if (MENU_IMAGES.length > 1 && i === lastMenuIdx) i = (i + 1) % MENU_IMAGES.length;   // lagatar ek hi image na aaye
    lastMenuIdx = i;
    const url = MENU_IMAGES[i];
    return { pic: getCachedImage(url) || { url }, key: url };
}
MENU_IMAGES.forEach(u => { try { getCachedImage(u); } catch (_) {} });   // pehle se download shuru (speed)

async function setBotPicFromBuffer(conn, buffer) {
    fs.mkdirSync(DIR, { recursive: true });
    let out = buffer;
    try {
        out = await require('sharp')(buffer).rotate().resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
    } catch (_) { /* keep original bytes */ }
    fs.writeFileSync(fileFor(conn), out);
    return fileFor(conn);
}

async function setBotPicFromUrl(conn, url) {
    const axios = require('axios');
    const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000, maxContentLength: 15 * 1024 * 1024, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const ct = String(r.headers['content-type'] || '');
    if (!/^image\//i.test(ct)) throw new Error('link image nahi hai');
    return setBotPicFromBuffer(conn, Buffer.from(r.data));
}

function resetBotPic(conn) {
    try { fs.rmSync(fileFor(conn), { force: true }); } catch (_) {}
}

getCachedImage(config.IMAGE_PATH);   // startup par hi warm

module.exports = { getBotPic, getMenuPic, getCachedImage, setBotPicFromBuffer, setBotPicFromUrl, resetBotPic };
