// plugins/repeat.js — REPEAT
//   .repeat AMAN 20            -> AMAN 20 baar (har baar nayi line mein)
//   .repeat AMAN 20 -s         -> AMAN AMAN AMAN ... (ek hi line, space se)
//   .repeat 20 AMAN            -> count pehle bhi likh sakte ho
//   .repeat hello world 5      -> kai lafzon ka text bhi chalega
//   (kisi message par reply karke) .repeat 10   -> us message ka text 10 baar
//
// Limits (spam / bot hang se bachne ke liye):
//   Normal user : max 50 baar, max 4000 characters, 8 second cooldown
//   Owner       : max 1000 baar, max 20000 characters, koi cooldown nahi

const { cmd } = require('../arslan');
const config = require('../config');

const P = () => config.PREFIX || '.';
const LIMITS = {
    user: { count: 50, chars: 4000, cooldown: 8000 },
    owner: { count: 1000, chars: 20000, cooldown: 0 }
};
const lastUse = new Map();

// "AMAN 20", "20 AMAN", "hello world 5 -s"  ->  { text, count, inline }
function parseArgs(raw) {
    let s = String(raw || '').trim();
    let inline = false;
    const flag = s.match(/(?:^|\s)-s$/i) || s.match(/^-s(?:\s|$)/i);
    if (flag) { inline = true; s = s.replace(/(?:^|\s)-s$/i, '').replace(/^-s(?:\s|$)/i, '').trim(); }

    let m = s.match(/^([\s\S]*?)\s+(\d{1,6})$/);          // text count
    if (m) return { text: m[1].trim(), count: parseInt(m[2], 10), inline };
    m = s.match(/^(\d{1,6})\s+([\s\S]+)$/);               // count text
    if (m) return { text: m[2].trim(), count: parseInt(m[1], 10), inline };
    m = s.match(/^(\d{1,6})$/);                           // sirf count (reply wale text ke liye)
    if (m) return { text: '', count: parseInt(m[1], 10), inline };
    return { text: s, count: NaN, inline };
}

cmd({
    pattern: 'repeat',
    alias: ['rep', 'repeater'],
    desc: 'Text ko kai baar repeat karo (.repeat AMAN 20)',
    use: '.repeat <text> <count>',
    category: 'tools',
    react: '🔁',
    filename: __filename
}, async (conn, mek, m, { from, q, reply, isOwner, isCreator, sender }) => {
    const owner = !!(isOwner || isCreator);
    const lim = owner ? LIMITS.owner : LIMITS.user;

    const help = `🔁 *REPEAT*\n\n` +
        `📌 *Use:*\n` +
        `${P()}repeat AMAN 20\n` +
        `${P()}repeat AMAN 20 -s  _(ek hi line mein)_\n` +
        `${P()}repeat hello world 5\n` +
        `Ya kisi message par reply karke: ${P()}repeat 10\n\n` +
        `📏 Limit: max ${lim.count} baar, ${lim.chars} characters`;

    let { text, count, inline } = parseArgs(q);
    if (!text) text = String((m.quoted && m.quoted.text) || '').trim();   // reply wala text
    if (!text || !Number.isFinite(count)) return reply(help);

    if (count < 1) return reply('❌ Count kam az kam 1 hona chahiye.\n\n' + help);
    if (count > lim.count) return reply(`❌ Itni baar repeat nahi ho sakta. Max *${lim.count}* baar.`);

    // loop se bachao: agar text khud command ho (".repeat .repeat 5") to bot apne hi message ko command samajh sakta hai
    const prefix = P();
    if (prefix && text.trim().startsWith(prefix)) {
        return reply(`❌ Text *${prefix}* se shuru nahi hona chahiye (command ban jata hai).`);
    }

    const sep = inline ? ' ' : '\n';
    const total = text.length * count + (count - 1) * sep.length;
    if (total > lim.chars) {
        const maxCount = Math.max(1, Math.floor((lim.chars + sep.length) / (text.length + sep.length)));
        return reply(`❌ Message bahut lamba ho jayega (${total} characters). Is text ke liye max *${maxCount}* baar.`);
    }

    if (lim.cooldown) {
        const who = sender || m.sender || from;
        const now = Date.now();
        const wait = lim.cooldown - (now - (lastUse.get(who) || 0));
        if (wait > 0) return reply(`⏳ ${Math.ceil(wait / 1000)} second baad dobara try karo.`);
        lastUse.set(who, now);
        if (lastUse.size > 500) lastUse.delete(lastUse.keys().next().value);
    }

    const out = Array.from({ length: count }, () => text).join(sep);
    await conn.sendMessage(from, { text: out }, { quoted: mek });
});

module.exports = { parseArgs };
