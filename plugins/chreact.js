const { cmd } = require('../arslan');
const reactor = require('../lib/reactor');

// =================================================================
// 💫 CHREACT v2 — WhatsApp channel post par ek ya kai emoji react
// Default: Baileys direct (API key ki zaroorat nahi)
// Optional: env CHREACT_API_KEY set ho to DavidCyrilTech API istemal hoti hai
//           (CHREACT_API_URL se URL badal sakte hain)
// =================================================================

const API_URL = process.env.CHREACT_API_URL || 'https://apis.davidcyriltech.my.id/tools/wareact';
const API_KEY = (process.env.CHREACT_API_KEY || '').trim();
const USE_API = !!API_KEY && !/^dc_live_x+$/i.test(API_KEY);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Emoji-aware splitter (❤️ 🔥 jaise graphemes ko sahi split karta hai)
function splitEmojis(str) {
    try {
        const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
        return [...seg.segment(str)].map(s => s.segment).filter(e => /\S/.test(e));
    } catch {
        return Array.from(str).filter(e => /\S/.test(e));
    }
}

async function reactViaApi(link, emoji) {
    const url = new URL(API_URL);
    url.searchParams.set('url', link);
    url.searchParams.set('emoji', emoji);
    const res = await fetch(url, { headers: { 'X-API-Key': API_KEY } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
    return data;
}

cmd({
    pattern: 'chreact',
    alias: ['creact', 'reactch', 'channelreact'],
    desc: 'React to WhatsApp channel post (multi-emoji)',
    category: 'general',
    react: '💫',
    filename: __filename
},
async (conn, mek, m, { args, reply, from }) => {
    try {
        if (args.length < 2) {
            return reply(
`💫 *CHREACT — Channel Reaction*

📌 *Usage:* .chreact <link> <emoji1> [emoji2] ...

📖 *Examples:*
.chreact https://whatsapp.com/channel/0029Vb8yiOF42DcjDYgq5g0Q/302 🔥
.chreact https://whatsapp.com/channel/0029Vb8yiOF42DcjDYgq5g0Q/302 🔥 ❤️ 😂 🎉

💡 Bohat sary emojis ek saath bhi de sakte ho
🔗 ${USE_API ? 'API-based' : 'Baileys direct — no API key'}`
            );
        }

        const link = args[0];
        if (!link.includes('whatsapp.com/channel/')) {
            return reply('❌ *Invalid channel link!*');
        }

        const emojis = splitEmojis(args.slice(1).join(''));
        if (!emojis.length) return reply('❌ *Emoji missing!*');

        const tag = link.split('/').slice(-2).join('/');

        // Baileys mode mein channel ek baar resolve karo
        let resolved = null;
        if (!USE_API) {
            resolved = await reactor.resolveChannelLink(conn, link);
            if (!resolved.ok) return reply(`❌ *Channel resolve failed:* ${resolved.error}`);
            if (!resolved.serverId) return reply('❌ *Server ID missing.* Link mein post number nahi hai.');
        }

        const total = emojis.length;
        let sent = 0, failed = 0, failStreak = 0, lastError = '';

        const sentMsg = await conn.sendMessage(from, {
            text: `💫 *CHREACT Started*\n📡 \`...${tag}\`\n\n📤 Sent: 0/${total}\n⏳ Reacting...`
        }, { quoted: mek });

        const progress = async () => {
            try {
                await conn.sendMessage(from, {
                    text: `💫 *CHREACT Running*\n📡 \`...${tag}\`\n\n📤 Sent: ${sent}/${total}\n❌ Failed: ${failed}\n${emojis.slice(Math.max(0, sent - 8), sent).join(' ')}`,
                    edit: sentMsg.key
                });
            } catch { /* edit errors ignore */ }
        };

        for (let i = 0; i < emojis.length; i++) {
            const emoji = emojis[i];
            let ok = false;
            for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
                try {
                    if (USE_API) {
                        await reactViaApi(link, emoji);
                    } else {
                        const r = await reactor.reactViaBaileys(conn, resolved.channelJid, resolved.serverId, emoji);
                        if (!r || !r.ok) throw new Error((r && r.error) || 'react failed');
                    }
                    ok = true;
                } catch (e) {
                    lastError = e.message;
                    if (attempt === 2) { failed++; failStreak++; }
                    else await sleep(1500);
                }
            }
            if (ok) { sent++; failStreak = 0; }
            if ((i + 1) % 5 === 0) await progress();
            if (failStreak >= 5) {
                return reply(`⛔ *Stopped:* Lagatar 5 reactions fail hue.\n📤 Sent: ${sent}/${total}\n❌ Failed: ${failed}\n📋 ${lastError}`);
            }
            await sleep(700); // rate-limit se bachne ke liye
        }

        await progress();
        return reply(
`✅ *CHREACT DONE*
📡 Post    : \`...${tag}\`
📤 Sent    : ${sent}/${total}
❌ Failed  : ${failed}
${emojis.join(' ')}${failed && lastError ? `\n📋 ${lastError}` : ''}`
        );

    } catch (err) {
        return reply(`❌ ${err.message}`);
    }
});
