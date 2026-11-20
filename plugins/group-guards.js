// AMAN-MD GROUP GUARDS — group ke liye extra security + tools
//   .antimedia   on|off|status|type image video sticker audio doc|type all|action delete|warn|kick
//   .antivoice   on|off|status|action ...        (voice notes block)
//   .antiforward on|off|status|action ...        (forwarded messages block)
//   .antipoll    on|off|status|action ...        (poll banana block)
//   .antifake    on <codes>|off|add <code>|remove <code>|status   (join par country code check)
//   .slowmode    <sec>|off|status                (har member ke messages ke beech gap)
//   .join <group invite link>                    (owner: bot ko group mein join karao)
// Admins aur owner par koi rule lagu nahi hota. Delete/kick ke liye bot ka group admin hona zaroori hai.
const { cmd } = require('../arslan');
const fs = require('fs-extra');
const path = require('path');

const mreply = (conn, from, mek, text, mentions) => conn.sendMessage(from, { text, mentions }, { quoted: mek });

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'groupguards.json');
fs.ensureDirSync(DATA_DIR);

let store = {};
try { if (fs.existsSync(DATA_FILE)) store = fs.readJsonSync(DATA_FILE) || {}; } catch (_) { store = {}; }
let saveTimer;
function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        try { fs.writeJsonSync(DATA_FILE, store, { spaces: 2 }); } catch (e) { console.error('[GUARDS] save failed:', e.message); }
    }, 150);
}

const MAX_WARN = 3;
const ACTIONS = ['delete', 'warn', 'kick'];
const MEDIA_TYPES = {
    image: ['imageMessage'],
    video: ['videoMessage', 'ptvMessage'],
    sticker: ['stickerMessage'],
    audio: ['audioMessage'],
    doc: ['documentMessage', 'documentWithCaptionMessage']
};
const POLL_TYPES = new Set(['pollCreationMessage', 'pollCreationMessageV2', 'pollCreationMessageV3', 'pollCreationMessageV4']);

function G(jid) {
    if (!store[jid]) store[jid] = { warnings: {} };
    const g = store[jid];
    if (!g.warnings || typeof g.warnings !== 'object') g.warnings = {};
    return g;
}
function F(jid, key, defaults) {
    const g = G(jid);
    if (!g[key]) g[key] = { enabled: false, action: 'delete', ...(defaults || {}) };
    const f = g[key];
    if (!ACTIONS.includes(f.action)) f.action = 'delete';
    return f;
}

// .resetwarns sab modules ki warnings ek saath clear kare, isliye reset function register karte hain
global.__warnResetters = global.__warnResetters || [];
global.__warnResetters.push((groupJid, userJid) => {
    try { const g = store[groupJid]; if (g && g.warnings) { delete g.warnings[userJid]; save(); } } catch (_) {}
});

// ───────────── common: admin check + toggle command builder ─────────────
function needAdmin(ctx) {
    if (!ctx.isGroup) { ctx.reply('❌ Ye command sirf group me chalti hai.'); return false; }
    if (!ctx.isAdmins && !ctx.isOwner) { ctx.reply('❌ Sirf group admins ye setting badal sakte hain.'); return false; }
    return true;
}

function guardCommand({ pattern, alias, title, key, react, desc, what, extraHelp, defaults, extra }) {
    cmd({ pattern, alias, desc, category: 'group', react, use: `.${pattern} on`, filename: __filename },
    async (conn, mek, m, ctx) => {
        const { from, args, reply, isGroup } = ctx;
        if (!isGroup) return reply('❌ Ye command sirf group me chalti hai.');
        const f = F(from, key, defaults);
        const sub = String(args[0] || '').toLowerCase();
        const status = () => reply(
`${title}

• Status: *${f.enabled ? 'ON ✅' : 'OFF ❌'}*
• Action: *${f.action.toUpperCase()}*${f.action === 'warn' ? ` (${MAX_WARN} warnings par kick)` : ''}${extraHelp ? '\n' + extraHelp(f) : ''}

*Commands:*
.${pattern} on / off
.${pattern} action delete|warn|kick${extra ? '\n' + extra.help : ''}

_${what}. Admins aur owner par lagu nahi._`);
        if (!sub || sub === 'status') return status();
        if (!needAdmin(ctx)) return;
        if (sub === 'on' || sub === 'enable') { f.enabled = true; save(); return reply(`✅ *${pattern.toUpperCase()} ON* — action: *${f.action}*`); }
        if (sub === 'off' || sub === 'disable') { f.enabled = false; save(); return reply(`✅ *${pattern.toUpperCase()} OFF*`); }
        if (sub === 'action') {
            const a = String(args[1] || '').toLowerCase();
            if (!ACTIONS.includes(a)) return reply(`❌ Use: \`.${pattern} action delete|warn|kick\``);
            f.action = a; save(); return reply(`✅ Action: *${a.toUpperCase()}*`);
        }
        if (extra && await extra.run(f, sub, args, ctx, save)) return;
        return status();
    });
}

guardCommand({
    pattern: 'antimedia', alias: ['antimedias', 'nomedia'], title: '🖼️ *AMAN-MD ANTIMEDIA*', key: 'antimedia', react: '🖼️',
    desc: 'Members ki photo/video/sticker/file block karo', what: 'Choose kiye gaye media types block hote hain',
    defaults: { types: ['image', 'video', 'sticker', 'doc'] },
    extraHelp: f => `• Blocked types: *${(f.types || []).join(', ') || 'none'}*`,
    extra: {
        help: '.antimedia type image video sticker audio doc\n.antimedia type all',
        run: async (f, sub, args, ctx, save) => {
            if (sub !== 'type' && sub !== 'types') return false;
            const want = args.slice(1).map(x => String(x).toLowerCase());
            const list = want.includes('all') ? Object.keys(MEDIA_TYPES) : want.map(x => x === 'document' || x === 'file' ? 'doc' : x).filter(x => MEDIA_TYPES[x]);
            if (!list.length) { await ctx.reply('❌ Types chuno: image, video, sticker, audio, doc (ya all)'); return true; }
            f.types = [...new Set(list)]; save();
            await ctx.reply(`✅ Blocked media types: *${f.types.join(', ')}*`);
            return true;
        }
    }
});
guardCommand({ pattern: 'antivoice', alias: ['novoice', 'antiptt'], title: '🎙️ *AMAN-MD ANTIVOICE*', key: 'antivoice', react: '🎙️',
    desc: 'Members ke voice notes block karo', what: 'Voice notes (PTT) block hote hain' });
guardCommand({ pattern: 'antiforward', alias: ['antiforwarded', 'noforward'], title: '↪️ *AMAN-MD ANTIFORWARD*', key: 'antiforward', react: '↪️',
    desc: 'Forwarded messages block karo', what: 'Forward kiye hue messages block hote hain' });
guardCommand({ pattern: 'antipoll', alias: ['nopoll'], title: '📊 *AMAN-MD ANTIPOLL*', key: 'antipoll', react: '📊',
    desc: 'Members ko poll banane se roko', what: 'Members ke poll delete hote hain' });

// ───────────── .slowmode ─────────────
cmd({
    pattern: 'slowmode', alias: ['slow', 'msgdelay'],
    desc: 'Har member ke messages ke beech gap (seconds)', category: 'group', react: '🐢', use: '.slowmode 10', filename: __filename
}, async (conn, mek, m, ctx) => {
    const { from, args, reply, isGroup } = ctx;
    if (!isGroup) return reply('❌ Ye command sirf group me chalti hai.');
    const f = F(from, 'slowmode', { seconds: 0 });
    const sub = String(args[0] || '').toLowerCase();
    const info = () => reply(`🐢 *AMAN-MD SLOWMODE*\n\n• Status: *${f.enabled ? `ON ✅ (${f.seconds} sec)` : 'OFF ❌'}*\n\n*Commands:*\n.slowmode 10 — har member 10 sec mein 1 message\n.slowmode off\n\n_Gap se pehle bheja gaya message delete hota hai. Admins par lagu nahi._`);
    if (!sub || sub === 'status') return info();
    if (!needAdmin(ctx)) return;
    if (sub === 'off' || sub === '0' || sub === 'disable') { f.enabled = false; save(); return reply('✅ *Slowmode OFF*'); }
    const n = Number(sub === 'on' ? (f.seconds || 10) : sub);
    if (!Number.isInteger(n) || n < 3 || n > 3600) return reply('❌ Seconds 3 se 3600 ke beech do. Example: `.slowmode 10`');
    f.enabled = true; f.seconds = n; save();
    return reply(`✅ *Slowmode ON* — har member *${n} sec* mein ek message bhej sakta hai.`);
});

// ───────────── .antifake ─────────────
const cleanCodes = (arr) => [...new Set(arr.map(x => String(x).replace(/[^0-9]/g, '')).filter(x => x.length >= 1 && x.length <= 4))];
cmd({
    pattern: 'antifake', alias: ['fakeblock', 'countrylock'],
    desc: 'Sirf chuni hui country codes wale numbers group mein rahen', category: 'group', react: '🛑', use: '.antifake on 92 91', filename: __filename
}, async (conn, mek, m, ctx) => {
    const { from, args, reply, isGroup } = ctx;
    if (!isGroup) return reply('❌ Ye command sirf group me chalti hai.');
    const f = F(from, 'antifake', { allowed: [] });
    const sub = String(args[0] || '').toLowerCase();
    const info = () => reply(`🛑 *AMAN-MD ANTIFAKE*\n\n• Status: *${f.enabled ? 'ON ✅' : 'OFF ❌'}*\n• Allowed country codes: *${f.allowed.length ? f.allowed.map(c => '+' + c).join(', ') : 'koi nahi'}*\n\n*Commands:*\n.antifake on 92 91 — sirf +92 aur +91 allowed\n.antifake add 971\n.antifake remove 91\n.antifake off\n\n_Naya member jiska country code allowed list mein nahi, remove ho jata hai. Bot ko admin banao._`);
    if (!sub || sub === 'status') return info();
    if (!needAdmin(ctx)) return;
    if (sub === 'on' || sub === 'enable') {
        const codes = cleanCodes(args.slice(1));
        if (codes.length) f.allowed = codes;
        if (!f.allowed.length) return reply('❌ Country codes do. Example: `.antifake on 92 91`');
        f.enabled = true; save();
        return reply(`✅ *AntiFake ON*\nSirf ye codes allowed: *${f.allowed.map(c => '+' + c).join(', ')}*`);
    }
    if (sub === 'off' || sub === 'disable') { f.enabled = false; save(); return reply('✅ *AntiFake OFF*'); }
    if (sub === 'add') {
        const codes = cleanCodes(args.slice(1));
        if (!codes.length) return reply('❌ Example: `.antifake add 971`');
        f.allowed = [...new Set([...f.allowed, ...codes])]; save();
        return reply(`✅ Allowed codes: *${f.allowed.map(c => '+' + c).join(', ')}*`);
    }
    if (sub === 'remove' || sub === 'del') {
        const codes = cleanCodes(args.slice(1));
        f.allowed = f.allowed.filter(c => !codes.includes(c));
        if (!f.allowed.length) f.enabled = false;
        save(); return reply(`✅ Allowed codes: *${f.allowed.length ? f.allowed.map(c => '+' + c).join(', ') : 'koi nahi (AntiFake OFF)'}*`);
    }
    return info();
});

// main.js ke group-participants.update se call hota hai
async function onParticipants(conn, update) {
    try {
        if (!update || update.action !== 'add' || !String(update.id || '').endsWith('@g.us')) return;
        const f = store[update.id] && store[update.id].antifake;
        if (!f || !f.enabled || !f.allowed.length) return;
        const botNum = String((conn.user && (conn.user.id || conn.user.jid)) || '').split(':')[0].split('@')[0];
        const meta = await conn.groupMetadata(update.id);
        const me = (meta.participants || []).find(p => String(p.id || '').split(':')[0].split('@')[0] === botNum
            || String(p.phoneNumber || '').split(':')[0].split('@')[0] === botNum);
        if (!me || !me.admin) return;   // bot admin nahi to kuch nahi kar sakte
        const kicked = [];
        for (const p of update.participants || []) {
            const jid = typeof p === 'string' ? p : (p.phoneNumber || p.id || '');
            if (!jid || String(jid).endsWith('@lid')) continue;      // asli number na mile to skip
            const num = String(jid).split('@')[0].split(':')[0];
            if (num === botNum) continue;
            if (f.allowed.some(code => num.startsWith(code))) continue;
            const target = typeof p === 'string' ? p : (p.id || jid);
            try { await conn.groupParticipantsUpdate(update.id, [target], 'remove'); kicked.push(num); }
            catch (e) { console.error('[ANTIFAKE] kick failed:', e.message); }
        }
        if (kicked.length) await conn.sendMessage(update.id, { text: `🛑 *AntiFake:* ${kicked.map(n => '+' + n).join(', ')} remove kiye gaye (country code allowed nahi).` });
    } catch (e) { console.error('[ANTIFAKE] error:', e.message); }
}

// ───────────── .join ─────────────
cmd({
    pattern: 'join', alias: ['joingroup', 'joingc'],
    desc: 'Owner: group invite link se bot ko group mein join karao', category: 'group', react: '🔗', use: '.join https://chat.whatsapp.com/xxxx', filename: __filename
}, async (conn, mek, m, ctx) => {
    const { args, reply, isOwner, isCreator } = ctx;
    if (!isOwner && !isCreator) return reply('❗ Ye command sirf *owner* ke liye hai.');
    const text = `${args.join(' ')} ${(m.quoted && m.quoted.text) || ''}`;
    const mt = text.match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]{10,})/i);
    if (!mt) return reply('🔗 Usage: `.join https://chat.whatsapp.com/xxxxxxxx`\n(ya link wale message ko reply karke `.join`)');
    try {
        const id = await conn.groupAcceptInvite(mt[1]);
        return reply(`✅ Group join ho gaya.${id ? `\n🆔 ${id}` : ''}`);
    } catch (e) {
        const msg = String((e && e.message) || e);
        if (/not-authorized|forbidden|403/i.test(msg)) return reply('❌ Join nahi ho saka — shayad bot is group se removed hai.');
        if (/gone|expired|410|invalid|404|not-found/i.test(msg)) return reply('❌ Link expire ya galat hai.');
        if (/conflict|409/i.test(msg)) return reply('ℹ️ Bot pehle se is group mein hai.');
        if (/request|approval|pending/i.test(msg)) return reply('⏳ Group admin approval maang raha hai — request bhej di gayi.');
        return reply(`❌ Join fail: ${msg.slice(0, 100)}`);
    }
});

// ───────────── enforcement (har group message) ─────────────
const cooldown = new Map();      // "group|user|feature" -> last notice time
const lastMsg = new Map();       // "group|user" -> last allowed time (slowmode)
const noAdminNotice = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [k, t] of cooldown) if (now - t > 60000) cooldown.delete(k);
    for (const [k, t] of lastMsg) if (now - t > 3700000) lastMsg.delete(k);
    for (const [k, t] of noAdminNotice) if (now - t > 3600000) noAdminNotice.delete(k);
}, 120000).unref();

async function punish(conn, mek, ctx, g, f, label) {
    const { from, sender, isBotAdmins } = ctx;
    const now = Date.now();
    if (!isBotAdmins) {
        if (now - (noAdminNotice.get(from) || 0) > 3600000) {
            noAdminNotice.set(from, now);
            await mreply(conn, from, mek, '⚠️ Group guard ON hai lekin delete/kick ke liye mujhe *group admin* banao.');
        }
        return;
    }
    try { await conn.sendMessage(from, { delete: mek.key }); } catch (e) { console.error('[GUARDS] delete:', e.message); }
    const ck = `${from}|${sender}|${label}`;
    if (now - (cooldown.get(ck) || 0) < 8000) return;      // album/flood par baar baar reply nahi
    cooldown.set(ck, now);
    const tag = '@' + String(sender).split('@')[0];
    if (f.action === 'kick') {
        try { await conn.groupParticipantsUpdate(from, [sender], 'remove'); } catch (e) { console.error('[GUARDS] kick:', e.message); }
        return mreply(conn, from, mek, `⛔ ${tag} — ${label} ki wajah se remove.`, [sender]);
    }
    if (f.action === 'warn') {
        g.warnings[sender] = (Number(g.warnings[sender]) || 0) + 1;
        const n = g.warnings[sender];
        if (n >= MAX_WARN) {
            try { await conn.groupParticipantsUpdate(from, [sender], 'remove'); } catch (e) { console.error('[GUARDS] kick:', e.message); }
            delete g.warnings[sender]; save();
            return mreply(conn, from, mek, `⛔ ${tag} ne warning limit (${MAX_WARN}) cross ki — remove.`, [sender]);
        }
        save();
        return mreply(conn, from, mek, `⚠️ ${tag} — ${label} allowed nahi.\nWarning: *${n}/${MAX_WARN}*`, [sender]);
    }
    return mreply(conn, from, mek, `🚫 ${tag} — ${label} yahan allowed nahi.`, [sender]);
}

const IGNORE = new Set(['protocolMessage', 'reactionMessage', 'senderKeyDistributionMessage', 'pollUpdateMessage', 'editedMessage']);

cmd({
    on: 'all',
    allowUnprefixedInGroups: true,
    dontAddCommandList: true,
    filename: __filename
}, async (conn, mek, m, ctx) => {
    const { from, isGroup, sender, isAdmins, isOwner } = ctx;
    if (!isGroup || !sender || (mek.key && mek.key.fromMe)) return;
    const g = store[from];
    if (!g || isAdmins || isOwner) return;
    const type = mek.type;
    if (!type || IGNORE.has(type) || String(from).includes('status@broadcast')) return;

    // 1) slowmode
    const sm = g.slowmode;
    if (sm && sm.enabled && sm.seconds) {
        const key = `${from}|${sender}`;
        const now = Date.now();
        const last = lastMsg.get(key) || 0;
        if (now - last < sm.seconds * 1000) {
            if (ctx.isBotAdmins) {
                try { await conn.sendMessage(from, { delete: mek.key }); } catch (_) {}
                const ck = `${key}|slow`;
                if (now - (cooldown.get(ck) || 0) > 15000) {
                    cooldown.set(ck, now);
                    const wait = Math.ceil((sm.seconds * 1000 - (now - last)) / 1000);
                    await mreply(conn, from, mek, `🐢 @${String(sender).split('@')[0]} slowmode ON hai — *${wait} sec* ruko.`, [sender]);
                }
            }
            return;
        }
        lastMsg.set(key, now);
    }

    const msgObj = (m && m.msg) || (mek.message && mek.message[type]) || {};
    const ci = msgObj.contextInfo || {};

    // 2) antipoll
    if (g.antipoll && g.antipoll.enabled && POLL_TYPES.has(type)) return punish(conn, mek, ctx, g, g.antipoll, 'poll');
    // 3) antiforward
    if (g.antiforward && g.antiforward.enabled && (ci.isForwarded || Number(ci.forwardingScore) > 0)) return punish(conn, mek, ctx, g, g.antiforward, 'forwarded message');
    // 4) antivoice
    if (g.antivoice && g.antivoice.enabled && type === 'audioMessage' && msgObj.ptt === true) return punish(conn, mek, ctx, g, g.antivoice, 'voice note');
    // 5) antimedia
    if (g.antimedia && g.antimedia.enabled) {
        for (const t of (g.antimedia.types || [])) {
            if ((MEDIA_TYPES[t] || []).includes(type)) return punish(conn, mek, ctx, g, g.antimedia, t === 'doc' ? 'file' : t);
        }
    }
});

module.exports = { onParticipants };
