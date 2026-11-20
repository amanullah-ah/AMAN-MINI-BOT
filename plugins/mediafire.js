// plugins/mediafire.js
// MEDIAFIRE — MediaFire file downloader

const { cmd } = require('../arslan');

// ─────────────────────────────────────────────
// ⚙️ CONFIG
const MAX_SIZE_MB = Number(process.env.MEDIAFIRE_MAX_MB) || 100;   // is se bari file ka sirf direct link diya jayega
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
// ─────────────────────────────────────────────

const timeoutFetch = async (url, ms = 60000, opts = {}) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
        return await fetch(url, { signal: ctrl.signal, ...opts });
    } finally {
        clearTimeout(t);
    }
};

// HTML entity decode
const decode = (s) => s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ');

// MediaFire page se info nikalna
function parseMediaFire(html) {
    // Direct download URL
    let direct = null;
    const m1 = html.match(/href="(https?:\/\/download\d*\.mediafire\.com\/[^"]+)"/i)
        || html.match(/"(https?:\/\/download\d*\.mediafire\.com\/[^"]+)"/i);
    if (m1) direct = decode(m1[1]);
    // Naye MediaFire pages: link base64 me data-scrambled-url attribute me hota hai
    if (!direct) {
        const sc = html.match(/data-scrambled-url="([A-Za-z0-9+/=_-]+)"/i);
        if (sc) {
            try {
                const u = Buffer.from(sc[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8').trim();
                if (/^https?:\/\//i.test(u)) direct = u;
            } catch (_) {}
        }
    }

    // File name (og:title)
    let name = 'file';
    const m2 = html.match(/property="og:title" content="([^"]+)"/i)
        || html.match(/<title>([^<]+)<\/title>/i);
    if (m2) name = decode(m2[1]).replace(/^\s*Download\s+/, '').replace(/\s*-\s*MediaFire\s*$/, '').trim() || 'file';

    // Size (og:description mein hota hai: "Download X (12 MB) ...")
    let sizeStr = '';
    const m3 = html.match(/property="og:description" content="([^"]+)"/i);
    if (m3) {
        const s = decode(m3[1]).match(/\(([0-9.]+\s*[KMGT]B)\)/i) || decode(m3[1]).match(/([0-9.]+\s*[KMGT]B)/i);
        if (s) sizeStr = s[1];
    }

    // Bytes mein size — pehle download button ("Download (12.3MB)"), phir og:description; poore HTML ka pehla "KB/MB" nahi (galat match hota tha)
    let sizeBytes = 0;
    const btn = html.match(/id="downloadButton"[\s\S]{0,400}?\(([\d.,]+\s*[KMGT]B)\)/i)
        || html.match(/aria-label="Download file"[\s\S]{0,400}?\(([\d.,]+\s*[KMGT]B)\)/i);
    const sizeSrc = btn ? btn[1] : sizeStr;
    const m4 = sizeSrc ? sizeSrc.match(/([\d.,]+)\s*([KMGT]B)\b/i) : null;
    if (btn && !sizeStr) sizeStr = btn[1];
    if (m4) {
        const n = parseFloat(m4[1].replace(/,/g, ''));
        const mult = { KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 }[m4[2].toUpperCase()] || 1;   // fmtBytes bhi 1024 par chalta hai
        sizeBytes = Math.round(n * mult);
    }

    // Check error page (file removed)
    const removed = /file has been removed|deleted by the owner|link is expired|not found/i.test(html);

    return { direct, name, sizeStr, sizeBytes, removed };
}

const fmtBytes = (b) => {
    if (!b) return '';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
    return `${(b / Math.pow(1024, i)).toFixed(1)} ${u[i]}`;
};

const extMime = (name) => {
    const ext = (name.split('.').pop() || '').toLowerCase();
    const map = {
        pdf: 'application/pdf', txt: 'text/plain', json: 'application/json',
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
        mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', wav: 'audio/wav', opus: 'audio/opus',
        mp4: 'video/mp4', mkv: 'video/x-matroska', webm: 'video/webm', mov: 'video/quicktime',
        zip: 'application/zip', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed',
        apk: 'application/vnd.android.package-archive', doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    };
    return map[ext] || 'application/octet-stream';
};

cmd({
    pattern: 'mediafire',
    alias: ['mf', 'mfire', 'mfdown', 'mfdownload'],
    desc: 'Download file from MediaFire link',
    category: 'download',
    react: '📦',
    filename: __filename
},
async (conn, mek, m, { from, args, reply }) => {
    try {
        if (!args.length) {
            return reply(
`📦 *MEDIAFIRE DOWNLOADER*

📌 *Usage:* .mediafire <link>

📖 *Example:*
.mediafire https://www.mediafire.com/file/xxxxx/file.apk

💡 File ${MAX_SIZE_MB}MB tak chat mein aayegi
🔗 Us se bari file ka direct link milega`
            );
        }

        const url = args[0].trim();
        if (!/mediafire\.com/i.test(url)) {
            return reply('❌ *MediaFire link nahi hai!*');
        }
        if (/mediafire\.com\/folder\//i.test(url)) {
            return reply('❌ *Folder links supported nahi.* Sirf file link do.');
        }

        await reply('📦 *Resolving MediaFire...*\n⏳ Please wait...');

        // Step 1: page fetch karo
        let page;
        try {
            const res = await timeoutFetch(url, 30000, { headers: { 'User-Agent': UA } });
            page = await res.text();
        } catch (e) {
            return reply(`❌ *Page load failed:* ${e.message}`);
        }

        const info = parseMediaFire(page);
        if (!info.direct) {
            return reply('❌ *File nahi mili!*\n\n💡 Ho sakta hai:\n• Link expired/removed ho' + (info.removed ? ' (page me "removed/not found" likha hai)' : '') + '\n• Private file ho');
        }

        const sizeText = info.sizeBytes ? fmtBytes(info.sizeBytes) : (info.sizeStr || 'unknown');
        const caption =
`📦 *MEDIAFIRE FILE*
📄 Name: \`${info.name}\`
💾 Size: \`${sizeText}\``

        // Step 2: bari file → sirf direct link
        if (info.sizeBytes && info.sizeBytes > MAX_SIZE_MB * 1024 * 1024) {
            return reply(
`${caption}

⚠️ File ${MAX_SIZE_MB}MB se bari hai — chat mein nahi aa sakti.

🔗 *Direct Download:*
${info.direct}`
            );
        }

        // Step 3: download & send
        await reply(`${caption}\n⬇️ *Downloading...*`);
        try {
            const dRes = await timeoutFetch(info.direct, 120000, { headers: { 'User-Agent': UA } });
            if (!dRes.ok) throw new Error(`HTTP ${dRes.status}`);
            const maxBytes = MAX_SIZE_MB * 1024 * 1024;
            const len = Number(dRes.headers.get('content-length') || 0);
            if (len > maxBytes) {
                return reply(`${caption}\n\n⚠️ File ${MAX_SIZE_MB}MB se bari hai — chat mein nahi aa sakti.\n\n🔗 *Direct Download:*\n${info.direct}`);
            }
            // memory bachane ke liye stream karke padho, limit paar hote hi ruk jao
            const chunks = []; let got = 0;
            for await (const chunk of dRes.body) {
                got += chunk.length;
                if (got > maxBytes) {
                    return reply(`${caption}\n\n⚠️ File ${MAX_SIZE_MB}MB se bari hai — chat mein nahi aa sakti.\n\n🔗 *Direct Download:*\n${info.direct}`);
                }
                chunks.push(Buffer.from(chunk));
            }
            const buf = Buffer.concat(chunks);
            const fileName = (info.name || 'file').replace(/[\\/:*?"<>|]+/g, '_');

            await conn.sendMessage(from, {
                document: buf,
                fileName,
                mimetype: extMime(fileName),
                caption: `📦 ${fileName}\n💾 ${fmtBytes(buf.length)}`
            }, { quoted: mek });

            return;
        } catch (e) {
            // Download fail → fallback: direct link
            return reply(
`${caption}

⚠️ *Download failed:* ${e.message}

🔗 *Direct link try karo:*
${info.direct}`
            );
        }

    } catch (err) {
        return reply(`❌ ${err.message}`);
    }
});