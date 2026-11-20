// plugins/ai-helpers.js — AI wale chhote commands (ai.js ka engine istemal karte hain, no API key)
//   .explain <topic>   → asaan zubaan me samjhao          (category: ai)
//   .idea <topic>      → 5 creative ideas                  (category: ai)
//   .helpme [problem]  → bot ka help / sawal ka jawab      (category: ai)
//   .grammar <text>    → grammar theek karo                (category: ai)
//   .learn <topic>     → mini lesson + practice sawal      (category: ai)
// Sab me kisi message ko reply karke bhi command chala sakte ho.

const { cmd } = require('../arslan');
const config = require('../config');

const LANG = 'Reply in the same language and script the user writes in (Roman Urdu, Hindi, English, etc). This is a WhatsApp chat: plain text, short lines, no markdown tables.';
const react = (conn, from, mek, e) => conn.sendMessage(from, { react: { text: e, key: mek.key } }).catch(() => {});
const P = () => config.PREFIX || '.';

// Command ke text + (agar reply kiya ho to) us message ka text
function inputOf(q, m) {
    const typed = String(q || '').trim();
    const quoted = String((m && m.quoted && m.quoted.text) || '').trim();
    if (typed && quoted) return `${typed}\n\n"""${quoted.slice(0, 2500)}"""`;
    return typed || quoted;
}

async function run(ctx, system, user, title) {
    const { conn, mek, from, sender, reply } = ctx;
    const { askAI, MODELS, throttled } = require('./ai');
    if (throttled(sender || from)) return reply('⏳ Thora ruko, pehli request chal rahi hai.');
    await react(conn, from, mek, '⏳');
    try {
        const { text } = await askAI([{ role: 'system', content: system }, { role: 'user', content: String(user).slice(0, 3500) }], MODELS.gpt);
        await react(conn, from, mek, '✅');
        return reply(`${title}\n\n${text.slice(0, 3500)}`);
    } catch (e) {
        await react(conn, from, mek, '❌');
        return reply(`❌ AI abhi jawab nahi de raha. Thori der baad try karo.\n_${String(e.message).slice(0, 80)}_`);
    }
}

cmd({
    pattern: 'explain', alias: ['samjhao'], desc: 'Kisi bhi topic ko asaan zubaan me samjhao',
    use: '.explain <topic>', category: 'ai', react: '💡', filename: __filename
}, async (conn, mek, m, { q, reply, from, sender }) => {
    const input = inputOf(q, m);
    if (!input) return reply(`💡 Format: ${P()}explain <topic>\nMisal: ${P()}explain blockchain kya hai\nYa kisi message ko reply karke ${P()}explain likho.`);
    return run({ conn, mek, from, sender, reply },
        `You explain things very simply, like to a curious beginner. Use short paragraphs, one everyday example, at most 150 words. ${LANG}`,
        `Explain this simply:\n${input}`, '💡 *EXPLAIN*');
});

cmd({
    pattern: 'idea', alias: ['ideas'], desc: 'Kisi topic par 5 creative ideas',
    use: '.idea <topic>', category: 'ai', react: '🧠', filename: __filename
}, async (conn, mek, m, { q, reply, from, sender }) => {
    const input = inputOf(q, m);
    if (!input) return reply(`🧠 Format: ${P()}idea <topic>\nMisal: ${P()}idea YouTube channel ke liye video ideas`);
    return run({ conn, mek, from, sender, reply },
        `You give 5 creative, practical and different ideas about the user's topic. Numbered list, each idea one short line. ${LANG}`,
        `Give ideas for:\n${input}`, '🧠 *IDEAS*');
});

cmd({
    pattern: 'helpme', desc: 'Bot ka help ya apna masla likho',
    use: '.helpme [masla]', category: 'ai', react: '🆘', filename: __filename
}, async (conn, mek, m, { q, reply, from, sender }) => {
    const p = P();
    const input = inputOf(q, m);
    if (!input) {
        return reply(`🆘 *HELP*\n\n` +
            `📂 ${p}menu — saari categories\n` +
            `🎞️ ${p}cmenu — slide menu\n` +
            `🤖 ${p}ai <sawal> — AI se poocho\n` +
            `🔗 ${p}pair — bot pair karo\n` +
            `👑 ${p}owner — owner se rabta\n\n` +
            `Apna masla likho: ${p}helpme <masla>\nMisal: ${p}helpme song kaise download karun`);
    }
    return run({ conn, mek, from, sender, reply },
        `You are the support assistant of the WhatsApp bot "${config.BOT_NAME || 'AMAN-MD'}". The command prefix is "${p}". Useful commands: ${p}menu (categories), ${p}cmenu (slide menu), ${p}ai <question>, ${p}song <name>, ${p}video <name>, ${p}pair, ${p}owner. Help the user step by step in a few short lines; if you are not sure a command exists, tell them to check ${p}menu. ${LANG}`,
        input, '🆘 *HELP*');
});

cmd({
    pattern: 'grammar', alias: ['fixgrammar'], desc: 'Text ki grammar aur spelling theek karo',
    use: '.grammar <text>', category: 'ai', react: '✍️', filename: __filename
}, async (conn, mek, m, { q, reply, from, sender }) => {
    const input = inputOf(q, m);
    if (!input) return reply(`✍️ Format: ${P()}grammar <text>\nMisal: ${P()}grammar i has went to market yesterday\nYa kisi message ko reply karke ${P()}grammar likho.`);
    return run({ conn, mek, from, sender, reply },
        `You are a grammar and spelling corrector. Keep the user's language and meaning. Output exactly: first line "✅ " + the corrected text, then up to 3 short lines starting with "• " explaining the main mistakes. If the text is already correct, say so in one line. ${LANG}`,
        input, '✍️ *GRAMMAR*');
});

cmd({
    pattern: 'learn', alias: ['lesson'], desc: 'Kisi topic ka mini lesson + practice sawal',
    use: '.learn <topic>', category: 'ai', react: '📚', filename: __filename
}, async (conn, mek, m, { q, reply, from, sender }) => {
    const input = inputOf(q, m);
    if (!input) return reply(`📚 Format: ${P()}learn <topic>\nMisal: ${P()}learn Python basics`);
    return run({ conn, mek, from, sender, reply },
        `You are a friendly teacher giving a mini lesson to a beginner. Structure: 1) what it is in 1-2 lines, 2) 4-5 key points, 3) one small practice question at the end. Under 200 words. ${LANG}`,
        `Teach me:\n${input}`, '📚 *LEARN*');
});
