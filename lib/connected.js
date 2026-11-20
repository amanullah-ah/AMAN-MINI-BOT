// lib/connected.js — "CONNECTED" message ka text (bot connect hone par owner ko jata hai)
const fs = require('fs');
const path = require('path');

const sans = (t) => String(t).replace(/[A-Za-z0-9]/g, (c) => {
    const k = c.charCodeAt(0);
    if (k >= 65 && k <= 90) return String.fromCodePoint(0x1D5D4 + k - 65);   // 𝗔-𝗭
    if (k >= 97 && k <= 122) return String.fromCodePoint(0x1D5EE + k - 97);  // 𝗮-𝘇
    return String.fromCodePoint(0x1D7CE + k - 48);                            // 𝟎-𝟗
});

function version() {
    try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version || ''; } catch (_) { return ''; }
}

function uptime() {
    const s = Math.floor(process.uptime());
    return `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m ${s % 60}s`;
}

function buildConnectedText({ prefix, mode, totalCommands, owner }) {
    const C = require('../aman').CONNECTED;   // design aman.js mein hai (CONNECTED)
    const vars = {
        OWNER: owner || C.OWNER_FALLBACK,
        UPTIME: sans(uptime()),
        PREFIX: prefix,
        MODE: sans(String(mode || 'public').toUpperCase()),
        COUNT: sans(totalCommands),
        VERSION: sans(version())
    };
    return C.LINES.map(l => l.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`))).join('\n');
}

module.exports = { buildConnectedText };
