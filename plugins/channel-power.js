const { cmd } = require('../arslan');
const config = require('../config');
const crypto = require('crypto');

function cleanNumber(value) {
    let n = String(value || '').replace(/\D/g, '');
    if (n.startsWith('0')) n = `${config.DEFAULT_COUNTRY_CODE}${n.slice(1)}`;
    return n;
}

// ===========================================================
// 🆕 Auto-React Engine — Channel status pe auto emoji
// ===========================================================
const AUTO_REACT_EMOJIS = ['🔥', '❤️', '😍', '🥳', '💯', '✨', '👏', '💫'];
const activeAutoReact = new Map();

async function startAutoReact(conn, channelJid, intervalSec = 300) {
    if (activeAutoReact.has(channelJid)) {
        clearInterval(activeAutoReact.get(channelJid));
    }
    const interval = setInterval(async () => {
        try {
            const emoji = AUTO_REACT_EMOJIS[crypto.randomInt(AUTO_REACT_EMOJIS.length)];
            if (typeof conn.newsletterReactMessage === 'function') {
                await conn.newsletterReactMessage(channelJid, 'latest', emoji).catch(() => {});
            }
        } catch (e) {
            console.error('AutoReact error:', e.message);
        }
    }, intervalSec * 1000);
    activeAutoReact.set(channelJid, interval);
    return interval;
}

// ===========================================================
// 1. CHANNELSTATUS — Text/Image status
// ===========================================================

// ===========================================================
// 2. CHSTATIMG — Image status
// ===========================================================

// ===========================================================
// 3. CHSTATVID — Video status
// ===========================================================

// ===========================================================
// 4. CHSTATAUTO — Random Islamic/Motivational status
// ===========================================================
cmd({
    pattern: 'chstatauto',
    alias: ['autostatus'],
    desc: 'Random status channel pe post karo',
    category: 'tools',
    react: '🎲',
    use: '.chstatauto <channel_jid>',
    filename: __filename
}, async (conn, mek, m, ctx) => {
    const channelJid = (ctx.args[0] || '').trim();
    if (!channelJid) return ctx.reply('❌ Channel JID do.');

    const statuses = [
        '🤲 Ya Allah, make this day better than yesterday.',
        '🌙 "Verily, with hardship comes ease." — Quran 94:6',
        '📿 SubhanAllahi wa bihamdihi, SubhanAllahil Azeem.',
        '💫 The best among you are those who learn Quran and teach it.',
        '✨ Whoever fears Allah — He will make a way out for him.',
        '🌟 Jumma Mubarak! May Allah bless you with peace.',
        '🕌 Don\'t forget to read Surah Al-Kahf today.',
        '🕋 Indeed, prayer prohibits immorality and wrongdoing.'
    ];
    const pick = statuses[crypto.randomInt(statuses.length)];

    try {
        const jid = channelJid.endsWith('@newsletter') ? channelJid : `${channelJid}@newsletter`;
        await conn.sendMessage(jid, { text: pick });
        return ctx.reply(`✅ Random status post!\n📌 ${jid}\n💬 ${pick}`);
    } catch (e) { return ctx.reply('❌ ' + e.message); }
});

// ===========================================================
// 5. CHSTATSTICKER — Sticker post
// ===========================================================

// ===========================================================
// 6. CHSTATREMIND — Expiry reminder
// ===========================================================

// ===========================================================
// 7. CHSTATFORWARD — Post ko group me forward
// ===========================================================

// ===========================================================
// 8. CHSTATREACT — Custom emoji reaction
// ===========================================================

// ===========================================================
// 9. AUTOREACT-ON — Auto-reaction engine ON
// ===========================================================
cmd({
    pattern: 'autoreact-on',
    alias: ['autoreactstart'],
    desc: 'Channel status pe auto-reaction engine ON',
    category: 'tools',
    react: '⚡',
    use: '.autoreact-on <channel_jid> [interval_seconds]',
    filename: __filename
}, async (conn, mek, m, ctx) => {
    const args = ctx.args || [];
    const channelJid = args[0];
    const interval = parseInt(args[1]) || 300;

    if (!channelJid) return ctx.reply('Use: `.autoreact-on <channel_jid> [seconds]`');
    if (interval < 30) return ctx.reply('❌ Minimum 30 seconds.');

    const jid = channelJid.endsWith('@newsletter') ? channelJid : `${channelJid}@newsletter`;
    await startAutoReact(conn, jid, interval);
    return ctx.reply(`⚡ Auto-react ON!\n📌 ${jid}\n⏱️ Every ${interval}s`);
});

// ===========================================================
// 10. AUTOREACT-OFF — Auto-reaction OFF
// ===========================================================
cmd({
    pattern: 'autoreact-off',
    alias: ['autoreactstop'],
    desc: 'Auto-reaction engine OFF',
    category: 'tools',
    react: '🛑',
    use: '.autoreact-off <channel_jid>',
    filename: __filename
}, async (conn, mek, m, ctx) => {
    const channelJid = (ctx.args[0] || '').trim();
    if (!channelJid) return ctx.reply('Use: `.autoreact-off <channel_jid>`');

    const jid = channelJid.endsWith('@newsletter') ? channelJid : `${channelJid}@newsletter`;
    if (activeAutoReact.has(jid)) {
        clearInterval(activeAutoReact.get(jid));
        activeAutoReact.delete(jid);
        return ctx.reply(`🛑 Auto-react OFF for ${jid}`);
    }
    return ctx.reply('❌ Ye channel auto-react list me nahi.');
});

// ===========================================================
// 11. CHANNELINFO — Channel info
// ===========================================================

// ===========================================================
// 12. CHSTATLIST — Auto-react list
// ===========================================================
cmd({
    pattern: 'chstatlist',
    alias: ['autoreactlist'],
    desc: 'Auto-react channels list dekho',
    category: 'tools',
    react: '📋',
    filename: __filename
}, async (conn, mek, m, ctx) => {
    if (activeAutoReact.size === 0) return ctx.reply('❌ Koi channel auto-react list me nahi.');

    const lines = [...activeAutoReact.keys()].map((jid, i) => `${i + 1}. ${jid}`);
    return ctx.reply(`⚡ *Auto-React Channels (${activeAutoReact.size})*\n\n` + lines.join('\n'));
});

// ===========================================================
// 13. CHSTATBULK — Bulk post multiple channels
// ===========================================================
