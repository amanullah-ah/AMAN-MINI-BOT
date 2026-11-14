// AMAN HELL-MD — YouTube drama search and download
// Replies are bound to the requester and prompt, and listeners always expire.
const { cmd } = require('../arslan');
const axios = require('axios');
const yts = require('yt-search');
const config = require('../config');

const REQUEST_TIMEOUT = 60000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

function cleanFileName(value) {
    return String(value || 'drama')
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100) || 'drama';
}

function getMessageText(msg) {
    const m = msg?.message || {};
    return String(m.conversation || m.extendedTextMessage?.text || '').trim();
}

function sameSender(a, b) {
    const normalize = value => String(value || '').replace(/:\d+(?=@)/, '').toLowerCase();
    return normalize(a) === normalize(b);
}

async function getDownloadLink(url) {
    try {
        const res = await axios.get(
            `https://adeel-xtech-apis.vercel.app/api/ytmp4?url=${encodeURIComponent(url)}`,
            { timeout: REQUEST_TIMEOUT, headers: { 'User-Agent': USER_AGENT } }
        );
        const result = res.data?.result;
        if (res.data?.status === true && typeof result?.video_download === 'string') {
            return result.video_download;
        }
        console.warn('[AMAN DRAMA] Unexpected download API response shape.');
    } catch (error) {
        console.warn('[AMAN DRAMA] Download API error:', error.message);
    }
    return null;
}

cmd({
    pattern: 'drama',
    alias: ['darama', 'dramadl'],
    desc: 'YouTube par 15+ minute drama search aur download',
    category: 'download',
    react: '🎬',
    use: '.drama <drama name>',
    filename: __filename
}, async (conn, mek, m, ctx) => {
    const reply = ctx.reply || (text => conn.sendMessage(ctx.from || mek.key.remoteJid, { text }, { quoted: mek }));
    const chat = ctx.from || mek.key?.remoteJid;
    const query = String(ctx.q || '').trim();

    try {
        if (!query) return reply('⚠️ Drama ka naam likho.\nExample: *.drama Ertugrul episode*');
        if (/youtube\.com\/|youtu\.be\//i.test(query)) {
            return reply('❌ Link nahi, sirf drama ka naam likho.');
        }

        await reply('🔎 Drama search ho raha hai, please wait…');
        const search = await yts(query);
        const video = (search.videos || []).find(item => Number(item.seconds) >= 900);
        if (!video) return reply('❌ 15 minutes ya usse lamba suitable drama nahi mila.');

        const caption = [
            '╭━━〔 🎬 AMAN DRAMA DOWNLOADER 〕━━╮',
            `┃ 🎞️ Title: ${video.title}`,
            `┃ ⏱️ Duration: ${video.timestamp}`,
            `┃ 👁️ Views: ${Number(video.views || 0).toLocaleString()}`,
            `┃ 📺 Channel: ${video.author?.name || 'Unknown'}`,
            '┃',
            '┃ Reply to this message:',
            '┃ 1️⃣ — MP4 document',
            '┃ 2️⃣ — Send as video',
            '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯',
            `\n${config.BOT_FOOTER || '© AMAN HELL-MD'}`
        ].join('\n');

        const sent = await conn.sendMessage(chat, {
            image: { url: video.thumbnail },
            caption
        }, { quoted: mek });

        const requester = mek.key?.participant || mek.key?.remoteJid;
        let finished = false;
        const removeListener = () => {
            conn.ev.off('messages.upsert', listener);
            clearTimeout(timer);
        };
        const timer = setTimeout(() => {
            if (finished) return;
            finished = true;
            removeListener();
        }, 120000);

        const listener = async update => {
            const msg = update?.messages?.[0];
            if (!msg || msg.key?.remoteJid !== chat || msg.key?.fromMe) return;
            if (!sameSender(msg.key?.participant || msg.key?.remoteJid, requester)) return;

            const text = getMessageText(msg);
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            if (!contextInfo || contextInfo.stanzaId !== sent.key?.id) return;
            if (!['1', '2'].includes(text)) return;
            if (finished) return;
            finished = true;
            removeListener();

            try {
                await conn.sendMessage(chat, { react: { text: '⏳', key: msg.key } });
                const downloadUrl = await getDownloadLink(video.url);
                if (!downloadUrl) {
                    await conn.sendMessage(chat, { react: { text: '❌', key: msg.key } });
                    return conn.sendMessage(chat, {
                        text: '❌ Download server abhi available nahi hai. Thori dair baad try karo.'
                    }, { quoted: msg });
                }

                const title = cleanFileName(video.title);
                if (text === '1') {
                    await conn.sendMessage(chat, {
                        document: { url: downloadUrl },
                        mimetype: 'video/mp4',
                        fileName: `${title}.mp4`,
                        caption: `🎬 *${video.title}*\n\n${config.BOT_FOOTER || 'AMAN HELL-MD'}`
                    }, { quoted: msg });
                } else {
                    await conn.sendMessage(chat, {
                        video: { url: downloadUrl },
                        mimetype: 'video/mp4',
                        caption: `🎬 *${video.title}*\n\n${config.BOT_FOOTER || 'AMAN HELL-MD'}`
                    }, { quoted: msg });
                }
                await conn.sendMessage(chat, { react: { text: '✅', key: msg.key } });
            } catch (error) {
                console.error('[AMAN DRAMA] Send failed:', error.message);
                try {
                    await conn.sendMessage(chat, { text: '❌ File send nahi ho saki. Dobara try karo.' }, { quoted: msg });
                } catch (_) {}
            }
        };

        conn.ev.on('messages.upsert', listener);
    } catch (error) {
        console.error('[AMAN DRAMA] Command failed:', error.message);
        return reply('❌ Drama search mein error aaya. Thori dair baad dobara try karo.');
    }
});
