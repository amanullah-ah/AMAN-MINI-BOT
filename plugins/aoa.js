const { cmd } = require('../arslan');

// =================================================================
// 🌙 .aoa <number>  —  Kisi bhi number ko Salam + khoobsurat Urdu shayari
// Misaal:  .aoa 923001234567    |    .aoa 03001234567
// Number ke bajaye kisi ke message par reply ya @mention bhi chalta hai.
// =================================================================

const SALAM = 'السَّلامُ عَلَيْكُم ورَحْمَةُ اللّٰہِ وَبَرَكاتُهُ';

// Asli (original) shayari — yahan se aur sher add/badal sakte hain
const POETRY = [
    'اک سلام سے مہک اٹھتی ہے ہر محفل کی فضا\nاک دعا سے سنور جاتی ہے دل کی دنیا',

    'سلام اُن پر جو لفظوں میں محبت گھول دیتے ہیں\nدلوں کی بند گِرہوں کو ذرا سا کھول دیتے ہیں',

    'دعا ہے ہر قدم پر تجھ کو رب کی رحمتیں مل جائیں\nتری راہوں میں خوشیوں کے ہزاروں گل کھِل جائیں',

    'لبوں پر مسکراہٹ ہو، دلوں میں چین کا موسم\nترے آنگن میں ٹھہرے رحمتِ رب کا حسیں موسم',

    'دل کی بستی میں تری یاد کا چراغ رہے\nسلامتی کی دعا ہو، خوشی کا باغ رہے'
];

// Spam se bachne ke liye: har bhejne wale ke liye gap (owner par lagu nahi)
const COOLDOWN_MS = 30 * 1000;
const lastUse = new Map();

function normalizeNumber(raw) {
    let n = String(raw || '').replace(/[^\d]/g, '');
    if (!n) return '';
    if (n.startsWith('00')) n = n.slice(2);
    // Pakistani local format: 03001234567 -> 923001234567
    if (n.startsWith('0') && n.length === 11) n = '92' + n.slice(1);
    return n;
}

cmd({
    pattern: 'aoa',
    alias: ['salam', 'salaam'],
    desc: 'Number par Salam + Urdu shayari bhejo',
    category: 'general',
    react: '🌙',
    use: '.aoa 923001234567',
    filename: __filename
}, async (conn, mek, m, { from, q, reply, sender, senderNumber, pushname, isOwner, isMe, prefix }) => {
    try {
        const ctxInfo = mek.message?.extendedTextMessage?.contextInfo || {};
        let number = normalizeNumber(q);

        // Number nahi diya to reply / mention se lo
        if (!number) {
            const target = (ctxInfo.mentionedJid && ctxInfo.mentionedJid[0]) || ctxInfo.participant || '';
            number = normalizeNumber(String(target).split('@')[0].split(':')[0]);
        }

        if (!number || number.length < 8 || number.length > 15) {
            return reply(`⚠️ Number likho.\n\n*Misaal:*\n${prefix || '.'}aoa 923001234567\n${prefix || '.'}aoa 03001234567`);
        }

        // Cooldown
        const key = senderNumber || sender || from;
        const privileged = isOwner || isMe;
        const now = Date.now();
        const wait = (lastUse.get(key) || 0) + COOLDOWN_MS - now;
        if (!privileged && wait > 0) {
            return reply(`⏳ ${Math.ceil(wait / 1000)} second baad dobara try karo.`);
        }

        // Number WhatsApp par hai ya nahi
        const jid = number + '@s.whatsapp.net';
        const [check] = await conn.onWhatsApp(jid).catch(() => [null]);
        if (!check || !check.exists) {
            return reply(`❌ +${number} WhatsApp par nahi mila.`);
        }

        const poem = POETRY[Math.floor(Math.random() * POETRY.length)];
        const from_name = pushname ? `${pushname}` : `+${senderNumber || ''}`;

        const text = [
            `*${SALAM}* 🌙`,
            '',
            '𓆰',
            poem,
            '𓆪',
            '',
            `_— ${from_name} ki taraf se_`,
            '> 𝗔𝗠𝗔𝗡 𝗧𝗘𝗖𝗛 𝗠𝗗'
        ].join('\n');

        await conn.sendMessage(check.jid || jid, { text });
        lastUse.set(key, now);

        await reply(`✅ Salam aur shayari +${number} ko bhej di gayi.`);
    } catch (e) {
        reply('⚠️ Nahi bhej saka: ' + (e.message || e));
    }
});
