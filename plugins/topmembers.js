// plugins/topmembers.js — group ke sab se active members (asli message count)
// Count main.js se aata hai (track), deploy ke baad se shuru hota hai.
// Data: data/topmembers.json  (Railway par bachane ke liye Volume + env TOPMEMBERS_FILE)

const fs = require('fs');
const path = require('path');
const { cmd } = require('../arslan');

const FILE = process.env.TOPMEMBERS_FILE || path.join(__dirname, '..', 'data', 'topmembers.json');
let data = null, timer = null;

function load() {
    if (!data) { try { data = JSON.parse(fs.readFileSync(FILE, 'utf8')) || {}; } catch (_) { data = {}; } }
    return data;
}
function flush() {
    timer = null;
    try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(data)); } catch (_) {}
}

// bot (session number) -> group -> member -> { n: messages, t: last time }
function track(bot, group, sender, mek) {
    if (!group || !String(group).endsWith('@g.us') || !sender) return;
    const msg = (mek && mek.message) || {};
    if (msg.protocolMessage || msg.reactionMessage || msg.senderKeyDistributionMessage) return;
    const d = load();
    const g = ((d[bot] = d[bot] || {})[group] = d[bot][group] || {});
    const e = (g[sender] = g[sender] || { n: 0, t: 0 });
    e.n += 1; e.t = Date.now();
    if (!timer) { timer = setTimeout(flush, 30000); if (timer.unref) timer.unref(); }
}

cmd({
    pattern: 'topmembers', alias: ['toptalkers'], desc: 'Group ke sab se active members (asli ginti)',
    use: '.topmembers [10]', category: 'group', react: '🏆', filename: __filename
}, async (conn, mek, m, { from, q, isGroup, botNumber, reply }) => {
    if (!isGroup) return reply('❌ Ye command sirf group me chalti hai.');
    const g = (load()[botNumber] || {})[from] || {};
    const rows = Object.entries(g).sort((a, b) => b[1].n - a[1].n);
    if (!rows.length) return reply('🏆 Abhi ginti shuru hui hai. Thori der group me baat-cheet hone do, phir dobara try karo.');
    let n = parseInt(String(q || '').trim(), 10);
    if (!Number.isInteger(n) || n < 1) n = 10;
    n = Math.min(n, 20);
    const top = rows.slice(0, n);
    const medals = ['🥇', '🥈', '🥉'];
    const lines = top.map(([jid, v], i) => `${medals[i] || `${i + 1}.`} @${jid.split('@')[0].split(':')[0]} — ${v.n} msg`);
    const total = rows.reduce((s, [, v]) => s + v.n, 0);
    return conn.sendMessage(from, {
        text: `🏆 *TOP MEMBERS*\n\n${lines.join('\n')}\n\n📊 Ginti is bot ke group me aane ke baad se (${total} msg).`,
        mentions: top.map(([jid]) => jid)
    }, { quoted: mek });
});

module.exports = { track };
