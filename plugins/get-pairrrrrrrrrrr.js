const { cmd, commands } = require('../arslan');
const axios = require('axios');

// Pairing code apne hi server (/code route) se aata hai. Purani Heroku API band thi.
// Alag server use karna ho to env me PAIR_API set karo, e.g. https://mybot.up.railway.app
async function fetchPairCode(number) {
    const base = (process.env.PAIR_API || `http://127.0.0.1:${process.env.PORT || 8000}`).replace(/\/+$/, '');
    try {
        return await axios.get(`${base}/code`, { params: { number }, timeout: 45000 });
    } catch (e) {
        const msg = e.response && e.response.data && (e.response.data.message || e.response.data.error);
        const err = new Error(msg || e.message);
        err.userMessage = msg || null;
        throw err;
    }
}


// Tappable "Copy Code" button: frame + footer ke saath (lib/copybtn.js). Na chale to false -> caller plain text bhejta hai.
const { sendCopyButton } = require('../lib/copybtn');
async function sendCopyCode(conn, jid, quoted, code, bodyText) {
    return sendCopyButton(conn, jid, quoted, {
        body: bodyText || `*Your pairing code is:*\n${code}\n\n👇 Neeche button dabao, code copy ho jayega`,
        title: 'PAIR',
        copy: code,
        label: '📋 Copy Code',
        id: 'copy_pair_code'
    });
}

cmd({
    pattern: "pair",
    alias: ["getpaijsksnsr", "pairing", "clonebnsjdndnznot"],
    react: "✅",
    desc: "Get pairing code for 𝗔𝗠𝗔𝗡-𝐌𝐃 bot",
    category: "general",
    use: ".pair 92323***",
    filename: __filename
}, async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, senderNumber, reply }) => {
    try {
        // Extract phone number from command
        const phoneNumber = q ? q.trim().replace(/[^0-9]/g, '') : senderNumber.replace(/[^0-9]/g, '');

        // Validate phone number format
        if (!phoneNumber || phoneNumber.length < 10 || phoneNumber.length > 15) {
            return await reply("❌ Please provide a valid phone number without `+`\nExample: `.pair 92323***`");
        }

        // Make API request to get pairing code
        const response = await fetchPairCode(phoneNumber);

        if (!response.data || !response.data.code) {
            return await reply("❌ Failed to retrieve pairing code. Please try again later.");
        }

        const pairingCode = response.data.code;
        const doneMessage = "> *PAIRING CODE*";

        // Tappable copy button (pehli koshish)
        if (await sendCopyCode(conn, from, mek, pairingCode)) return;

        // Fallback: plain text (button na chale to)
        await reply(`${doneMessage}\n\n*Your pairing code is:* ${pairingCode}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        await reply(`${pairingCode}`);

    } catch (error) {
        console.error("Pair command error:", error);
        await reply(error.userMessage ? `❌ ${error.userMessage}` : "❌ An error occurred while getting pairing code. Please try again later.");
    }
});

cmd({
    pattern: "pair2",
    alias: ["getpair2", "reqpair", "clonebot2"],
    react: "📉",
    desc: "Get pairing code for 𝗔𝗠𝗔𝗡-𝐌𝐃 bot",
    category: "general",
    use: ".pair 92323XXX",
    filename: __filename
}, async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, senderNumber, reply }) => {
    try {
        // Check if in group
        if (isGroup) {
            return await reply("❌ This command only works in private chat. Please message me directly.");
        }

        // Show processing reaction
        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        // Extract phone number
        const phoneNumber = q ? q.trim().replace(/[^0-9]/g, '') : senderNumber.replace(/[^0-9]/g, '');

        // Validate phone number
        if (!phoneNumber || phoneNumber.length < 10 || phoneNumber.length > 15) {
            return await reply("❌ Invalid phone number format!\n\nPlease use: `.pair 92323000000000`\n(Without + sign)");
        }

        // Get pairing code from API
        const response = await fetchPairCode(phoneNumber);
        
        if (!response.data?.code) {
            return await reply("❌ Failed to get pairing code. Please try again later.");
        }

        const pairingCode = response.data.code;
        
        // Send image with caption
        const sentMessage = await conn.sendMessage(from, {
            image: { url: "https://files.catbox.moe/prkkzj.png" },
            caption: `- *⍴ᥲіrіᥒg ᥴ᥆ძᥱ*\n\n Notification has been sent to your WhatsApp. Please check your phone and copy this code to pair it and get your session id.\n\n*🔢 Pairing Code*: *${pairingCode}*\n\n> *Copy button neeche hai 👇🏻*`
        }, { quoted: m });

        // Tappable copy button; na chale to clean code plain text mein
        const copied = await sendCopyCode(conn, from, mek, pairingCode, `*🔢 Pairing Code:* *${pairingCode}*\n\n👇 Button dabao, code copy ho jayega`);
        if (!copied) await reply(pairingCode);
        
        // Add ✅ reaction to the clean code message
        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (error) {
        console.error("Pair command error:", error);
        await reply(error.userMessage ? `❌ ${error.userMessage}` : "❌ An error occurred. Please try again later.");
    }
});
