// plugins/toonfind.js
// TOON — find legal/official cartoon episodes on YouTube

const { cmd } = require('../arslan');

// ─────────────────────────────────────────────
// ⚙️ CONFIG
// YouTube Data API v3 key (free): https://console.cloud.google.com
// Free tier: 100 searches/day — bina key ke Invidious fallback chalega
const YT_KEY = '';

// Invidious public instances (no key fallback — kuch down ho sakte hain)
const INVIDIOUS = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://yewtu.be',
    'https://invidious.f5.si'
];
// ─────────────────────────────────────────────

const timeoutFetch = async (url, ms = 12000, opts = {}) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
        return await fetch(url, { signal: ctrl.signal, ...opts });
    } finally {
        clearTimeout(t);
    }
};

const safeJson = async (res) => res.json().catch(() => null);
// WhatsApp me MarkdownV2 escaping nahi chalta (backslash dikhte the) -> sirf formatting todne wale chars hatao
const esc = (s) => String(s || '').replace(/[*`]/g, '');

// Official kids channel detector
const isOfficial = (ch) => /nick|nickelodeon|disney|cartoon\s*network|pogo|sonic|hungama|official|jetix|animax|zee5|prime\s*video|sony\s*yay|bachpan|kids/i.test(ch || '');

// ISO8601 duration → m:ss
const fmtDur = (iso) => {
    const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '');
    if (!m) return '';
    const h = +(m[1] || 0), min = +(m[2] || 0), s = +(m[3] || 0);
    return h ? `${h}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${min}:${String(s).padStart(2, '0')}`;
};

const fmtSec = (sec) => {
    sec = +sec || 0;
    const h = Math.floor(sec / 3600), min = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? `${h}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${min}:${String(s).padStart(2, '0')}`;
};

// ─── YouTube Data API v3 (key required) ───
async function searchYT(query, limit = 8) {
    const q = `${query} cartoon`;
    const sRes = await timeoutFetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=${limit}&safeSearch=strict&key=${YT_KEY}`
    );
    const sData = await safeJson(sRes);
    if (!sData || !sData.items || !sData.items.length) return [];

    const ids = sData.items.map(i => i.id.videoId).join(',');
    const dRes = await timeoutFetch(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids}&key=${YT_KEY}`
    );
    const dData = await safeJson(dRes);
    const durMap = {};
    (dData?.items || []).forEach(v => { durMap[v.id] = fmtDur(v.contentDetails?.duration); });

    return sData.items.map(i => ({
        title: i.snippet?.title,
        channel: i.snippet?.channelTitle,
        id: i.id?.videoId,
        duration: durMap[i.id?.videoId] || ''
    }));
}

// ─── yt-search (project me pehle se installed, key ki zaroorat nahi) ───
async function searchYtSearch(query, limit = 8) {
    const yts = require('yt-search');
    const r = await yts(`${query} cartoon`);
    let vids = (r && r.videos) || [];
    const full = vids.filter(v => (v.seconds || 0) >= 120);      // Shorts / chhote clips hatao
    if (full.length >= 3) vids = full;
    return vids.slice(0, limit).map(v => ({
        title: v.title,
        channel: v.author && v.author.name,
        id: v.videoId,
        duration: v.timestamp || fmtSec(v.seconds)
    }));
}

// ─── Invidious fallback (no key) ───
async function searchInvidious(query, limit = 8) {
    const q = `${query} cartoon`;
    for (const base of INVIDIOUS) {
        try {
            const res = await timeoutFetch(
                `${base}/api/v1/search?q=${encodeURIComponent(q)}&type=video&page=1`
            );
            const data = await safeJson(res);
            if (Array.isArray(data) && data.length) {
                return data
                    .filter(v => v.type === 'video')
                    .slice(0, limit)
                    .map(v => ({
                        title: v.title,
                        channel: v.author,
                        id: v.videoId,
                        duration: fmtSec(v.lengthSeconds)
                    }));
            }
        } catch { /* next instance */ }
    }
    return [];
}

function formatResults(query, results) {
    const lines = [
        `🎌 *CARTOON SEARCH:* \`${esc(query)}\``,
        `📺 Legal YouTube episodes — click & watch`,
        ''
    ];
    results.forEach((r, i) => {
        const badge = isOfficial(r.channel) ? ' ✅' : '';
        lines.push(
            `${i + 1}. *${esc(r.title)}*`,
            `   👤 ${esc(r.channel)}${badge} • ⏱️ \`${r.duration || '--'}\``,
            `   ▶️ https://youtu.be/${r.id}`
        );
    });
    lines.push('', '_Download ka button nahi — YouTube pe legally dekho_ 📱');
    return lines.join('\n');
}

cmd({
    pattern: 'toonfind',
    alias: ['toon', 'cartoonfind', 'khojcartoon'],
    desc: 'Find official cartoon episodes on YouTube',
    category: 'anime',
    react: '📺',
    filename: __filename
},
async (conn, mek, m, { args, reply }) => {
    try {
        if (!args.length) {
            return reply(
`📺 *CARTOON FINDER (Legal)*

📌 *Usage:* .toonfind <name>

📖 *Examples:*
.toon Motu Patlu
.toon Doraemon
.toon Shinchan
.toon Tom and Jerry

💡 Official channels ✅ mark se honge
🔗 Watch on YouTube — 100% legal`
            );
        }

        const query = args.join(' ');
        await reply(`📺 *Searching YouTube:* \`${esc(query)}\`\n⏳ Please wait...`);

        let results = [];
        let used = '';
        if (YT_KEY) {
            try {
                results = await searchYT(query);
                used = 'YouTube API';
            } catch (e) {
                console.error('[toon] YT API error:', e.message);
            }
        }
        if (!results.length) {
            try {
                results = await searchYtSearch(query);
                used = 'YouTube search';
            } catch (e) {
                console.error('[toon] yt-search error:', e.message);
            }
        }
        if (!results.length) {
            results = await searchInvidious(query);
            used = 'Invidious';
        }

        if (!results.length) {
            return reply(`❌ *Kuch nahi mila:* \`${esc(query)}\`\n\n💡 Try:\n• English spelling\n• Short name (e.g. "Motu Patlu")`);
        }

        const officialCount = results.filter(r => isOfficial(r.channel)).length;
        return reply(
            formatResults(query, results) +
            `\n\n📡 _Source: ${used} • ${results.length} results (${officialCount} official)_`
        );

    } catch (err) {
        return reply(`❌ ${err.message}`);
    }
});
