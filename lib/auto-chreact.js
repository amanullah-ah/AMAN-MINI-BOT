// lib/auto-chreact.js
// Host ke channel(s) par jab bhi nayi post aaye, har connected session khud react kare.
// Settings data/auto-chreact.json mein save hoti hain (restart ke baad bhi rehti hain).

const fs = require('fs');
const path = require('path');
const { delay } = require('@whiskeysockets/baileys');

const FILE = path.join(__dirname, '..', 'data', 'auto-chreact.json');

// Pehle se jo channels main.js mein hardcoded the, wo default rahenge
const DEFAULT_CHANNELS = require('../aman').AUTO_REACT_CHANNELS.slice();
const DEFAULT_EMOJIS = ['❤️', '👍', '😮', '😎', '💀', '💫', '🔥', '👑'];

let state = null;

function load() {
    if (state) return state;
    try {
        const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        state = {
            enabled: raw.enabled !== false,
            channels: Array.isArray(raw.channels) ? raw.channels : DEFAULT_CHANNELS.slice(),
            emojis: Array.isArray(raw.emojis) && raw.emojis.length ? raw.emojis : DEFAULT_EMOJIS.slice()
        };
    } catch (_) {
        state = { enabled: true, channels: DEFAULT_CHANNELS.slice(), emojis: DEFAULT_EMOJIS.slice() };
    }
    return state;
}

function save() {
    try {
        fs.mkdirSync(path.dirname(FILE), { recursive: true });
        fs.writeFileSync(FILE, JSON.stringify(load(), null, 2));
    } catch (e) { console.error('auto-chreact save error:', e.message); }
}

const get = () => load();
function setEnabled(v) { load().enabled = !!v; save(); }
function addChannel(jid) { const s = load(); if (!s.channels.includes(jid)) s.channels.push(jid); save(); }
function removeChannel(jid) { const s = load(); s.channels = s.channels.filter(j => j !== jid); save(); }
function setEmojis(list) { const s = load(); s.emojis = list.length ? list : DEFAULT_EMOJIS.slice(); save(); }

// Har incoming message par main.js isko call karta hai. Channel post ho to react schedule karta hai.
function handle(conn, mek) {
    try {
        const jid = mek?.key?.remoteJid;
        if (!jid || !jid.endsWith('@newsletter')) return;
        const s = load();
        if (!s.enabled || !s.channels.includes(jid)) return;
        const serverId = mek.newsletterServerId;
        if (!serverId) return;
        const emoji = s.emojis[Math.floor(Math.random() * s.emojis.length)];
        (async () => {
            // sab sessions ek hi second mein react na karein (ban/rate-limit se bachav)
            await delay(1500 + Math.floor(Math.random() * 8000));
            await conn.newsletterReactMessage(jid, String(serverId), emoji);
        })().catch(() => {});
    } catch (_) {}
}

module.exports = { get, setEnabled, addChannel, removeChannel, setEmojis, handle, DEFAULT_EMOJIS };
