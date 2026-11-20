// plugins/vv2.js
// VIEW ONCE SAVER 2 — view-once media ko apni DM mein save karo
// Manual:  view-once par reply karke  .vv2
// Auto:    .vvon       -> is chat ka har view-once auto DM mein
//          .vvon all   -> har chat ka view-once auto DM mein
//          .vvoff      -> is chat ka auto band   |  .vvoff all -> sab band
// Sab owner only.

const { cmd } = require('../arslan');
const { downloadMediaMessage, downloadContentFromMessage, jidNormalizedUser } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

// ── state (auto-save toggle) ───────────────────────────────────
// Railway par redeploy se bachane ke liye Volume lagao aur env VV2_STATE_FILE set karo
const STATE_FILE = process.env.VV2_STATE_FILE || path.join(__dirname, '..', 'data', 'vv2state.json');
let autoSave = new Set(); // 'all' = har jagah, ya chat jid
try {
    if (fs.existsSync(STATE_FILE)) autoSave = new Set(JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')));
} catch (_) {}
const saveState = () => {
    try {
        fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
        fs.writeFileSync(STATE_FILE, JSON.stringify([...autoSave]));
    } catch (_) {}
};

// ── helpers ────────────────────────────────────────────────────
const VO_WRAPPERS = ['viewOnceMessageV2', 'viewOnceMessageV2Extension', 'viewOnceMessage'];
const OTHER_WRAPPERS = ['ephemeralMessage', 'documentWithCaptionMessage'];

// wrappers kholo; (msg, viewOnce) wapas do
function unwrap(message) {
    let msg = message, viewOnce = false;
    for (let i = 0; i < 6 && msg; i++) {
        let inner = null;
        for (const k of VO_WRAPPERS) if (msg[k]?.message) { inner = msg[k].message; viewOnce = true; break; }
        if (!inner) for (const k of OTHER_WRAPPERS) if (msg[k]?.message) { inner = msg[k].message; break; }
        if (!inner) break;
        msg = inner;
    }
    return { msg, viewOnce };
}

function getMedia(msg) {
    if (msg?.imageMessage) return { type: 'image', msg: msg.imageMessage };
    if (msg?.videoMessage) return { type: 'video', msg: msg.videoMessage };
    if (msg?.audioMessage) return { type: 'audio', msg: msg.audioMessage };
    return null;
}

const toBuf = (v) => {
    if (!v) return v;
    if (Buffer.isBuffer(v) || v instanceof Uint8Array) return Buffer.from(v);
    if (typeof v === 'string') return Buffer.from(v, 'base64');
    if (v.type === 'Buffer' && Array.isArray(v.data)) return Buffer.from(v.data);
    if (typeof v === 'object') {
        const vals = Object.values(v);
        if (vals.length && vals.every(n => typeof n === 'number')) return Buffer.from(vals);
    }
    return v;
};
const fixMedia = (media) => {
    const out = { ...media };
    for (const k of ['mediaKey', 'fileSha256', 'fileEncSha256']) if (out[k]) out[k] = toBuf(out[k]);
    if (!out.url && out.directPath) out.url = 'https://mmg.whatsapp.net' + out.directPath;
    return out;
};

const ownerJid = (conn) => {
    try { return jidNormalizedUser(conn.user.id); } catch (_) {}
    return String((conn.user && conn.user.id) || '').split(':')[0].split('@')[0] + '@s.whatsapp.net';
};

// raw message se contextInfo nikalo
const getCtx = (mek) => {
    let msg = mek?.message;
    for (let i = 0; i < 4 && msg; i++) {
        for (const k of Object.keys(msg)) if (msg[k]?.contextInfo?.quotedMessage) return msg[k].contextInfo;
        msg = msg.ephemeralMessage?.message;
    }
    return null;
};

async function download(conn, fakeMek, media) {
    const fixed = fixMedia(media.msg);
    let buffer;
    try {
        const stream = await downloadContentFromMessage(fixed, media.type);
        const chunks = [];
        for await (const c of stream) chunks.push(c);
        buffer = Buffer.concat(chunks);
    } catch (_) {}
    if (!buffer || !buffer.length) {
        buffer = await downloadMediaMessage(fakeMek, 'buffer', {}, { logger: console, reuploadRequest: conn.updateMediaMessage });
    }
    if (!buffer || !buffer.length) throw new Error('Download fail: media khul/expire ho chuki ho sakti hai.');
    return buffer;
}

// message (raw) -> owner DM
async function saveToDm(conn, fakeMek, rawMessage, toJid, { requireViewOnce }) {
    const { msg, viewOnce } = unwrap(rawMessage);
    const media = getMedia(msg);
    if (!media) throw new Error('Sirf photo/video/audio supported hai.');
    const isVO = viewOnce || media.msg.viewOnce === true;
    if (requireViewOnce && !isVO) throw new Error('Ye view-once message nahi hai.');

    const buffer = await download(conn, { ...fakeMek, message: { [media.type + 'Message']: fixMedia(media.msg) } }, media);

    const from = fakeMek.key.participant || fakeMek.key.remoteJid || '';
    const name = fakeMek.pushName || String(from).split('@')[0];
    const chat = String(fakeMek.key.remoteJid || '').endsWith('@g.us') ? 'Group' : 'DM';
    const cap = media.msg.caption ? `\n📝 ${media.msg.caption}` : '';
    const info = `✅ *VIEW ONCE SAVED*\n👤 From : ${name}\n📍 Chat  : ${chat}${cap}`;

    const payload = { [media.type]: buffer, mimetype: media.msg.mimetype };
    if (media.type === 'audio') payload.ptt = !!media.msg.ptt; else payload.caption = info;
    await conn.sendMessage(toJid, payload);
    if (media.type === 'audio') await conn.sendMessage(toJid, { text: info });
}

// ── 1) MANUAL: .vv2 ────────────────────────────────────────────
cmd({
    pattern: 'vv2',
    alias: ['vo'],
    desc: 'View-once media ko apni DM mein save karo (Owner only)',
    use: '.vv2 (view-once par reply)',
    category: 'owner',
    react: '🔓',
    filename: __filename
}, async (conn, mek, m, { from, reply, isOwner, isCreator }) => {
    if (!(isOwner || isCreator)) return reply('❌ Sirf owner use kar sakta hai.');
    try {
        const ctx = getCtx(mek);
        const raw = ctx?.quotedMessage || m.quoted?.message;
        if (!raw) {
            return reply(`🔓 *VIEW ONCE SAVER 2*\n\n📌 View-once message par reply karke likho:\n*.vv2*\n\n⚡ Auto mode:\n*.vvon* — is chat ka har view-once DM mein\n*.vvon all* — har chat ka\n*.vvoff* — band`);
        }
        const fake = {
            key: { remoteJid: from, id: ctx?.stanzaId, participant: ctx?.participant, fromMe: false },
            pushName: m.quoted?.pushName
        };
        await saveToDm(conn, fake, raw, ownerJid(conn), { requireViewOnce: true });
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});
    } catch (err) {
        return reply(`❌ ${err.message}`);
    }
});

// ── 2) AUTO-SAVE LISTENER ──────────────────────────────────────
cmd({
    on: 'all',
    dontAddCommandList: true,
    filename: __filename
}, async (conn, mek) => {
    try {
        if (!mek.message || mek.key?.fromMe || !autoSave.size) return;
        const chat = mek.key.remoteJid;
        if (!autoSave.has('all') && !autoSave.has(chat)) return;
        if (String(chat).includes('status@broadcast')) return;
        await saveToDm(conn, mek, mek.message, ownerJid(conn), { requireViewOnce: true });
    } catch (_) {}
});

// ── 3) TOGGLES ─────────────────────────────────────────────────
cmd({
    pattern: 'vvon',
    desc: 'Auto-save view-once ON (.vvon | .vvon all)',
    category: 'owner',
    react: '🔛',
    filename: __filename
}, async (conn, mek, m, { from, q, reply, isOwner, isCreator }) => {
    if (!(isOwner || isCreator)) return reply('❌ Sirf owner use kar sakta hai.');
    const all = /^(all|global)$/i.test(String(q || '').trim());
    autoSave.add(all ? 'all' : from);
    saveState();
    return reply(`🔛 *Auto View-Once Save ON*\n📍 ${all ? 'Har chat' : 'Is chat'}\n\nAb view-once media aapki DM mein save hoga.`);
});

cmd({
    pattern: 'vvoff',
    desc: 'Auto-save view-once OFF (.vvoff | .vvoff all)',
    category: 'owner',
    react: '🔴',
    filename: __filename
}, async (conn, mek, m, { from, q, reply, isOwner, isCreator }) => {
    if (!(isOwner || isCreator)) return reply('❌ Sirf owner use kar sakta hai.');
    if (/^(all|global)$/i.test(String(q || '').trim())) autoSave.clear();
    else autoSave.delete(from);
    saveState();
    return reply('🔴 *Auto View-Once Save OFF*');
});
