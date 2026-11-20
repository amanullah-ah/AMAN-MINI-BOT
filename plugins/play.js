// plugins/play.js — .play <naam>  →  YouTube par dhoondh kar card dikhata hai + tappable buttons
//   [🎵 Audio]  [🎬 Video]  [▶️ YouTube]
// Button dabane par .song / .video chal jata hai. Agar buttons na chalein to seedha audio bhej deta hai.

const { cmd, findCommand } = require('../arslan');
const config = require('../config');
const yts = require('yt-search');

const PREFIX = () => config.PREFIX || '.';
const botName = () => String(config.BOT_NAME || 'AMAN-MD').trim();

const quickReply = (text, id) => ({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: text, id }) });
const urlButton = (text, url) => ({ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: text, url, merchant_url: url }) });

async function sendCard(conn, jid, quoted, video, text) {
    const { proto, prepareWAMessageMedia, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
    const IM = proto.Message.InteractiveMessage;
    const p = PREFIX();

    let header = IM.Header.fromObject({ title: '', subtitle: '', hasMediaAttachment: false });
    const thumb = video.thumbnail || video.image;
    if (thumb) {
        try {
            const imageMessage = (await prepareWAMessageMedia({ image: { url: thumb } }, { upload: conn.waUploadToServer })).imageMessage;
            header = IM.Header.fromObject({ title: '', subtitle: '', hasMediaAttachment: true, imageMessage });
        } catch (_) { /* image ke bina bhi chalega */ }
    }
    const interactive = IM.create({
        header,
        body: IM.Body.create({ text }),
        footer: IM.Footer.create({ text: `© ${botName()}` }),
        nativeFlowMessage: IM.NativeFlowMessage.fromObject({
            buttons: [
                quickReply('🎵 Audio', `${p}song ${video.url}`),
                quickReply('🎬 Video', `${p}video ${video.url}`),
                urlButton('▶️ YouTube', video.url)
            ]
        })
    });
    const msg = generateWAMessageFromContent(jid, {
        viewOnceMessage: { message: { messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 }, interactiveMessage: interactive } }
    }, { quoted, userJid: conn.user && conn.user.id });
    await conn.relayMessage(jid, msg.message, {
        messageId: msg.key.id,
        additionalNodes: [{
            tag: 'biz', attrs: {},
            content: [{ tag: 'interactive', attrs: { type: 'native_flow', v: '1' },
                content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }] }]
        }]
    });
}

cmd({
    pattern: 'play',
    alias: ['playyt', 'ytplay', 'playsong'],
    desc: 'YouTube par dhoondo — Audio/Video button ke saath',
    category: 'download',
    react: '▶️',
    use: '.play <song ya video ka naam>',
    filename: __filename
}, async (conn, mek, m, ctx) => {
    const { from, reply } = ctx;
    const query = String(ctx.q || '').trim();
    if (!query) return reply(`▶️ *${botName()} PLAY*\n\nUse: .play <naam>\nExample: .play pasoori\n\nResult card par *Audio* ya *Video* button dabao.`);

    await conn.sendMessage(from, { react: { text: '🔎', key: mek.key } }).catch(() => {});
    let video;
    try {
        const r = await yts(query);
        video = r && r.videos && r.videos[0];
    } catch (e) {
        console.error('[PLAY] search failed:', e && e.message);
        return reply('❌ YouTube search abhi nahi ho saka. Thori der baad try karo.');
    }
    if (!video) return reply('❌ Kuch nahi mila. Doosra naam try karo.');

    const text =
        `▶️ *${video.title}*\n\n` +
        `🎤 ${video.author && video.author.name || 'Unknown'}\n` +
        `⏱️ ${video.timestamp || 'Unknown'}\n` +
        `👁️ ${Number(video.views || 0).toLocaleString('en-US')} views\n` +
        `🗓️ ${video.ago || ''}\n\n` +
        `👇 Neeche se chuno:`;
    try {
        await sendCard(conn, from, mek, video, text);
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {});
    } catch (e) {
        console.error('[PLAY] card failed, sending audio directly:', e && e.message);
        // Fallback: buttons na chalein to seedha audio
        const song = findCommand('song');
        if (song && song.function) return song.function(conn, mek, m, { ...ctx, q: video.url, text: video.url, args: [video.url] });
        return reply(`▶️ *${video.title}*\n${video.url}`);
    }
});
