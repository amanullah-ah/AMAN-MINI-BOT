// AMAN-MD ANTIBADWORD — group mein gande/banned alfaaz wale messages delete + warn/kick.
// .antibadword on | off | status | add <word> | remove <word> | list | action delete|warn|kick
// Default list khali hai — admin apne group ke hisaab se words khud add karta hai.
const { cmd } = require('../arslan');
const fs = require('fs-extra');
const path = require('path');

const mreply = (conn, from, mek, text, mentions) => conn.sendMessage(from, { text, mentions }, { quoted: mek });

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'antibadword.json');
fs.ensureDirSync(DATA_DIR);

let store = {};
try { if (fs.existsSync(DATA_FILE)) store = fs.readJsonSync(DATA_FILE) || {}; } catch (_) { store = {}; }
let saveTimer;
function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        try { fs.writeJsonSync(DATA_FILE, store, { spaces: 2 }); } catch (e) { console.error('[ANTIBADWORD] save failed:', e.message); }
    }, 150);
}
function getCfg(jid) {
    if (!store[jid]) store[jid] = { enabled: false, action: 'warn', maxWarn: 3, words: [], warnings: {} };
    const c = store[jid];
    if (!['delete', 'warn', 'kick'].includes(c.action)) c.action = 'warn';
    c.maxWarn = Math.max(1, Math.min(10, Number(c.maxWarn) || 3));
    c.words = Array.isArray(c.words) ? c.words : [];
    if (!c.warnings || typeof c.warnings !== 'object') c.warnings = {};
    return c;
}

const norm = (s) => String(s || '')
    .normalize('NFKD').replace(/[\u0300-\u036f\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, '')
    .toLowerCase();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// compiled regex cache per group (words badalne par reset)
const rxCache = new Map();
function getRegex(jid, c) {
    const sig = c.words.join('|');
    const hit = rxCache.get(jid);
    if (hit && hit.sig === sig) return hit.rx;
    const rx = c.words.length
        ? new RegExp(`(^|[^\\p{L}\\p{N}])(?:${c.words.map(w => esc(norm(w))).join('|')})(?=$|[^\\p{L}\\p{N}])`, 'iu')
        : null;
    rxCache.set(jid, { sig, rx });
    return rx;
}

cmd({
    pattern: 'antibadword',
    alias: ['antibad', 'badword', 'antigali'],
    desc: 'Group me banned alfaaz block karo (on/off/add/remove/list/action)',
    category: 'group',
    react: '🤬',
    use: '.antibadword add <word>',
    filename: __filename
}, async (conn, mek, m, ctx) => {
    const { from, args, reply, isGroup, isAdmins, isOwner } = ctx;
    if (!isGroup) return reply('❌ Ye command sirf group me chalti hai.');
    const c = getCfg(from);
    const sub = String(args[0] || '').toLowerCase();

    if (!sub || sub === 'status') {
        return reply(
`🤬 *AMAN-MD ANTIBADWORD*

• Status: *${c.enabled ? 'ON ✅' : 'OFF ❌'}*
• Action: *${c.action.toUpperCase()}*${c.action === 'warn' ? ` (${c.maxWarn} warnings par kick)` : ''}
• Banned words: *${c.words.length}*

*Commands:*
.antibadword on / off
.antibadword add <word>
.antibadword remove <word>
.antibadword list
.antibadword action delete|warn|kick

_Admins aur owner par lagu nahi hota._`);
    }
    if (sub === 'list') {
        if (!isOwner && !isAdmins) return reply('❌ Sirf admins list dekh sakte hain.');
        return reply(c.words.length ? `📋 *Banned words (${c.words.length}):*\n${c.words.map(w => `• ${w}`).join('\n')}` : '📋 List khali hai. `.antibadword add <word>`');
    }
    if (!isOwner && !isAdmins) return reply('❌ Sirf group admins ye setting badal sakte hain.');

    if (sub === 'on' || sub === 'enable') {
        if (!c.words.length) return reply('⚠️ Pehle kam az kam ek word add karo: `.antibadword add <word>`');
        c.enabled = true; save(); return reply('✅ *AntiBadword ON*');
    }
    if (sub === 'off' || sub === 'disable') { c.enabled = false; save(); return reply('✅ *AntiBadword OFF*'); }
    if (sub === 'action') {
        const a = String(args[1] || '').toLowerCase();
        if (!['delete', 'warn', 'kick'].includes(a)) return reply('❌ Use: `.antibadword action delete|warn|kick`');
        c.action = a; save(); return reply(`✅ Action: *${a.toUpperCase()}*`);
    }
    if (sub === 'add') {
        const words = args.slice(1).map(w => norm(w).trim()).filter(w => w.length >= 2 && w.length <= 40);
        if (!words.length) return reply('❌ Example: `.antibadword add word1 word2`');
        let added = 0;
        for (const w of words) { if (!c.words.includes(w) && c.words.length < 200) { c.words.push(w); added++; } }
        save(); return reply(`✅ *${added}* word add hue. Total: *${c.words.length}*`);
    }
    if (sub === 'remove' || sub === 'del') {
        const words = args.slice(1).map(w => norm(w).trim());
        const before = c.words.length;
        c.words = c.words.filter(w => !words.includes(w));
        if (!c.words.length) c.enabled = false;
        save(); return reply(`✅ *${before - c.words.length}* word hata diye.`);
    }
    if (sub === 'reset') {
        const target = m.quoted?.sender || m.mentionedJid?.[0];
        if (!target) return reply('❌ Member ko reply karo ya mention karo.');
        delete c.warnings[target]; save();
        return mreply(conn, from, mek, `✅ @${target.split('@')[0]} ki warnings clear.`, [target]);
    }
    return reply('❌ Samajh nahi aaya. `.antibadword status` dekho.');
});

cmd({
    on: 'body',
    allowUnprefixedInGroups: true,
    dontAddCommandList: true,
    filename: __filename
}, async (conn, mek, m, ctx) => {
    const { from, body, isGroup, sender, isAdmins, isOwner, isBotAdmins, reply } = ctx;
    if (!isGroup || !body || !sender || mek.key?.fromMe) return;
    const c = store[from];
    if (!c || !c.enabled || !c.words.length) return;
    if (isOwner || isAdmins) return;

    const rx = getRegex(from, c);
    if (!rx || !rx.test(norm(body))) return;
    if (!isBotAdmins) return;   // delete/kick ke liye bot admin chahiye

    try { await conn.sendMessage(from, { delete: mek.key }); } catch (e) { console.error('[ANTIBADWORD] delete:', e.message); }
    const tag = '@' + String(sender).split('@')[0];
    if (c.action === 'delete') return mreply(conn, from, mek, `🚫 ${tag} aisay alfaaz yahan allowed nahi.`, [sender]);
    if (c.action === 'kick') {
        try { await conn.groupParticipantsUpdate(from, [sender], 'remove'); } catch (e) { console.error('[ANTIBADWORD] kick:', e.message); }
        return mreply(conn, from, mek, `⛔ ${tag} banned word ki wajah se remove.`, [sender]);
    }
    c.warnings[sender] = (Number(c.warnings[sender]) || 0) + 1;
    const n = c.warnings[sender];
    if (n >= c.maxWarn) {
        try { await conn.groupParticipantsUpdate(from, [sender], 'remove'); } catch (e) { console.error('[ANTIBADWORD] kick:', e.message); }
        delete c.warnings[sender]; save();
        return mreply(conn, from, mek, `⛔ ${tag} ne warning limit (${c.maxWarn}) cross ki — remove.`, [sender]);
    }
    save();
    return mreply(conn, from, mek, `⚠️ ${tag} zabaan sambhal ke!\nWarning: *${n}/${c.maxWarn}*`, [sender]);
});

// .resetwarns ke liye: is module ki warnings clear karne wala function register
global.__warnResetters = global.__warnResetters || [];
global.__warnResetters.push((groupJid, userJid) => {
  try { const c = store[groupJid]; if (c && c.warnings) { delete c.warnings[userJid]; save(); } } catch (_) {}
});
