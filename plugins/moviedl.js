// .moviedl <naam> — YouTube par lambi (40+ minute) full movie search + download
// Drama command jaisa hi tareeqa: apne server par yt-dlp, koi third-party site nahi.
const { cmd } = require('../arslan');
const config = require('../config');
const mediaDl = require('../lib/media-dl');
const { findLong } = require('../lib/longsearch');

const MAX_BYTES = 700 * 1024 * 1024;       // is se badi file nahi bheji jati
const DOC_ABOVE = 90 * 1024 * 1024;        // bari file video ke bajaye document ke taur par

const cleanFileName = v => String(v || 'movie').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 100) || 'movie';

cmd({
    pattern: 'moviedl',
    alias: ['filmdl', 'moviedownload'],
    desc: 'YouTube par 40+ minute ki full movie search aur download',
    category: 'download',
    react: '🎥',
    use: '.moviedl <movie name>',
    filename: __filename
}, async (conn, mek, m, ctx) => {
    const reply = ctx.reply || (text => conn.sendMessage(ctx.from || mek.key.remoteJid, { text }, { quoted: mek }));
    const chat = ctx.from || mek.key?.remoteJid;
    const query = String(ctx.q || '').trim();

    try {
        if (!query) return reply('⚠️ Movie ka naam likho.\nExample: *.moviedl Jawani Phir Nahi Ani*');
        if (/youtube\.com\/|youtu\.be\//i.test(query)) return reply('❌ Link nahi, sirf movie ka naam likho. (Link ke liye .video use karo)');

        await reply('🔎 Movie search ho rahi hai, please wait…');
        let found;
        try { found = await findLong(query, { kind: 'movie', minSeconds: 2400 }); }
        catch (e) {
            console.error('[AMAN MOVIE] search failed:', e.message);
            return reply('❌ YouTube search nahi ho saki. Thori der baad dobara try karo.');
        }
        const video = found[0];
        if (!video) return reply('❌ Is naam se 40+ minute ki full movie YouTube par nahi mili.\n\n💡 Poora naam likho, ya saal ke saath: *.moviedl <naam> 2019*');

        const caption = [
            '╭━━━━〔 🎥 𝗔𝗠𝗔𝗡-𝐌𝐃 〕━━━━╮',
            `┃ 🎞️ Title: ${video.title}`,
            `┃ ⏱️ Duration: ${video.timestamp}`,
            `┃ 👁️ Views: ${Number(video.views || 0).toLocaleString()}`,
            `┃ 📺 Channel: ${video.author?.name || 'Unknown'}`,
            '┃',
            '┃ ⏳ Download shuru hai... (10-25 min lag sakte hain)',
            '┃ ℹ️ Badi movie ki quality khud kam ho sakti hai',
            '╰━━━━━━━━━━━━━━━━━━━━━━━╯',
            `\n${config.BOT_FOOTER || '© 𝐏𝙾𝚆𝙴𝚁𝙳 𝐁𝚈 𝗔𝗠𝗔𝗡-𝐌𝐃'}`
        ].join('\n');
        await conn.sendMessage(chat, { image: { url: video.thumbnail }, caption }, { quoted: mek }).catch(() => reply(caption));

        let dl = null;
        try {
            await conn.sendMessage(chat, { react: { text: '⏳', key: mek.key } }).catch(() => {});
            dl = await mediaDl.downloadFullVideoFile(video.url, { maxBytes: MAX_BYTES, heights: [360, 240, 144], timeoutMs: 40 * 60 * 1000 });

            const title = cleanFileName(video.title);
            const mb = (dl.size / 1048576).toFixed(0);
            const cap = `🎥 *${video.title}*\n📦 ${mb} MB · ${dl.height}p\n\n${config.BOT_FOOTER || 'AMAN HELL-MD'}`;
            const asDoc = () => conn.sendMessage(chat, { document: { url: dl.path }, mimetype: 'video/mp4', fileName: `${title}.mp4`, caption: cap }, { quoted: mek });

            if (dl.size > DOC_ABOVE) {
                await asDoc();
            } else {
                try { await conn.sendMessage(chat, { video: { url: dl.path }, mimetype: 'video/mp4', caption: cap }, { quoted: mek }); }
                catch (e) { console.warn('[AMAN MOVIE] video send failed, trying document:', e.message); await asDoc(); }
            }
            await conn.sendMessage(chat, { react: { text: '✅', key: mek.key } }).catch(() => {});
        } catch (error) {
            console.error('[AMAN MOVIE] Failed:', error.details || error.message);
            await conn.sendMessage(chat, { react: { text: '❌', key: mek.key } }).catch(() => {});
            const why = mediaDl.explainError(error);
            await reply('❌ Movie download/send nahi ho saki.' + (why ? '\n\n💡 ' + why : '\nThori der baad dobara try karo.'));
        } finally {
            if (dl && dl.cleanup) dl.cleanup();
        }
    } catch (error) {
        console.error('[AMAN MOVIE] Command failed:', error.message);
        return reply('❌ Movie search mein error aaya. Thori dair baad dobara try karo.');
    }
});
