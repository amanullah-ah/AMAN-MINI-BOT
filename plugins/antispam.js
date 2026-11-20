// AMAN-MD ANTISPAM — group mein flood/spam rokta hai (kam waqt mein bahut zyada messages).
// .antispam on | off | status | limit <n> | time <sec> | action delete|warn|kick | reset (reply/mention se warnings clear)
const { cmd } = require('../arslan');
const fs = require('fs-extra');
const path = require('path');

const mreply = (conn, from, mek, text, mentions) => conn.sendMessage(from, { text, mentions }, { quoted: mek });

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'antispam.json');
fs.ensureDirSync(DATA_DIR);

let store = {};
try { if (fs.existsSync(DATA_FILE)) store = fs.readJsonSync(DATA_FILE) || {}; } catch (_) { store = {}; }
let saveTimer;
function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        try { fs.writeJsonSync(DATA_FILE, store, { spaces: 2 }); } catch (e) { console.error('[ANTISPAM] save failed:', e.message); }
    }, 150);
}
function getCfg(jid) {
    if (!store[jid]) store[jid] = { enabled: false, limit: 6, seconds: 8, action: 'warn', maxWarn: 3, warnings: {} };
    const c = store[jid];
    c.limit = Math.max(3, Math.min(30, Number(c.limit) || 6));
    c.seconds = Math.max(3, Math.min(60, Number(c.seconds) || 8));
    c.maxWarn = Math.max(1, Math.min(10, Number(c.maxWarn) || 3));
    if (!['delete', 'warn', 'kick'].includes(c.action)) c.action = 'warn';
    if (!c.warnings || typeof c.warnings !== 'object') c.warnings = {};
    return c;
}

const hits = new Map();      // "group|user" -> [timestamps]
const cooldown = new Map();  // "group|user" -> last action time
const noAdminNotice = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [k, arr] of hits) { if (!arr.length || now - arr[arr.length - 1] > 120000) hits.delete(k); }
    for (const [k, t] of cooldown) { if (now - t > 120000) cooldown.delete(k); }
    for (const [k, t] of noAdminNotice) { if (now - t > 3600000) noAdminNotice.delete(k); }
}, 60000).unref();

const IGNORE_TYPES = new Set(['protocolMessage', 'reactionMessage', 'senderKeyDistributionMessage', 'pollUpdateMessage', 'editedMessage']);

cmd({
    pattern: 'antispam',
    alias: ['antiflood', 'spamguard'],
    desc: 'Group me spam/flood rokein (on/off/limit/time/action)',
    category: 'group',
    react: '🚫',
    use: '.antispam on',
    filename: __filename
}, async (conn, mek, m, ctx) => {
    const { from, args, reply, isGroup, isAdmins, isOwner } = ctx;
    if (!isGroup) return reply('❌ Ye command sirf group me chalti hai.');
    const c = getCfg(from);
    const sub = String(args[0] || '').toLowerCase();

    if (!sub || sub === 'status') {
        return reply(
`🚫 *AMAN-MD ANTISPAM*

• Status: *${c.enabled ? 'ON ✅' : 'OFF ❌'}*
• Limit: *${c.limit} messages / ${c.seconds} sec*
• Action: *${c.action.toUpperCase()}*${c.action === 'warn' ? ` (${c.maxWarn} warnings par kick)` : ''}

*Commands:*
.antispam on / off
.antispam limit 6
.antispam time 8
.antispam action delete|warn|kick
.antispam reset (member ko reply/mention karke)

_Admins aur owner par ye rule lagu nahi hota._`);
    }
    if (!isOwner && !isAdmins) return reply('❌ Sirf group admins ye setting badal sakte hain.');

    if (sub === 'on' || sub === 'enable') { c.enabled = true; save(); return reply(`✅ *AntiSpam ON*\n${c.limit} messages / ${c.seconds} sec se zyada par *${c.action}* hoga.`); }
    if (sub === 'off' || sub === 'disable') { c.enabled = false; save(); return reply('✅ *AntiSpam OFF*'); }
    if (sub === 'limit') {
        const n = Number(args[1]);
        if (!Number.isInteger(n) || n < 3 || n > 30) return reply('❌ Limit 3 se 30 ke beech do. Example: `.antispam limit 6`');
        c.limit = n; save(); return reply(`✅ Limit: *${n}* messages / ${c.seconds} sec`);
    }
    if (sub === 'time') {
        const n = Number(args[1]);
        if (!Number.isInteger(n) || n < 3 || n > 60) return reply('❌ Time 3 se 60 second ke beech do. Example: `.antispam time 8`');
        c.seconds = n; save(); return reply(`✅ Window: *${n} sec* (limit ${c.limit})`);
    }
    if (sub === 'action') {
        const a = String(args[1] || '').toLowerCase();
        if (!['delete', 'warn', 'kick'].includes(a)) return reply('❌ Use: `.antispam action delete|warn|kick`');
        c.action = a; save(); return reply(`✅ Action: *${a.toUpperCase()}*`);
    }
    if (sub === 'reset') {
        const target = m.quoted?.sender || m.mentionedJid?.[0];
        if (!target) return reply('❌ Member ko reply karo ya mention karo.');
        delete c.warnings[target]; save();
        return mreply(conn, from, mek, `✅ @${target.split('@')[0]} ki spam warnings clear.`, [target]);
    }
    return reply('❌ Samajh nahi aaya. `.antispam status` dekho.');
});

cmd({
    on: 'all',
    allowUnprefixedInGroups: true,
    dontAddCommandList: true,
    filename: __filename
}, async (conn, mek, m, ctx) => {
    const { from, isGroup, sender, isAdmins, isOwner, isBotAdmins, reply } = ctx;
    if (!isGroup || !sender || mek.key?.fromMe) return;
    if (IGNORE_TYPES.has(mek.type) || String(from).includes('status@broadcast')) return;
    const c = store[from];
    if (!c || !c.enabled) return;
    if (isOwner || isAdmins) return;

    const key = `${from}|${sender}`;
    const now = Date.now();
    const win = c.seconds * 1000;
    const arr = (hits.get(key) || []).filter(t => now - t < win);
    arr.push(now);
    hits.set(key, arr);
    if (arr.length <= c.limit) return;

    // Flood mila — har baar action na ho (10s cooldown), lekin message delete hota rahe
    if (!isBotAdmins) {
        if (now - (noAdminNotice.get(from) || 0) > 3600000) {
            noAdminNotice.set(from, now);
            await reply('⚠️ AntiSpam ON hai lekin spam rokne ke liye mujhe *group admin* banao.');
        }
        return;
    }
    try { await conn.sendMessage(from, { delete: mek.key }); } catch (e) { console.error('[ANTISPAM] delete:', e.message); }
    if (now - (cooldown.get(key) || 0) < 10000) return;
    cooldown.set(key, now);

    const tag = '@' + String(sender).split('@')[0];
    if (c.action === 'delete') return mreply(conn, from, mek, `🚫 ${tag} spam mat karo. Messages delete kar diye.`, [sender]);
    if (c.action === 'kick') {
        try { await conn.groupParticipantsUpdate(from, [sender], 'remove'); } catch (e) { console.error('[ANTISPAM] kick:', e.message); }
        return mreply(conn, from, mek, `⛔ ${tag} spam ki wajah se group se remove.`, [sender]);
    }
    c.warnings[sender] = (Number(c.warnings[sender]) || 0) + 1;
    const n = c.warnings[sender];
    if (n >= c.maxWarn) {
        try { await conn.groupParticipantsUpdate(from, [sender], 'remove'); } catch (e) { console.error('[ANTISPAM] kick:', e.message); }
        delete c.warnings[sender]; save();
        return mreply(conn, from, mek, `⛔ ${tag} ne spam warning limit (${c.maxWarn}) cross ki — remove.`, [sender]);
    }
    save();
    return mreply(conn, from, mek, `⚠️ ${tag} spam mat karo!\nWarning: *${n}/${c.maxWarn}*`, [sender]);
});

// .resetwarns ke liye: is module ki warnings clear karne wala function register
global.__warnResetters = global.__warnResetters || [];
global.__warnResetters.push((groupJid, userJid) => {
  try { const c = store[groupJid]; if (c && c.warnings) { delete c.warnings[userJid]; save(); } } catch (_) {}
});
