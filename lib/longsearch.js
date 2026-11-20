// lib/longsearch.js — YouTube par lambi video (drama / movie) dhoondhne ka shared helper.
// Sirf ek search ke bajaye kai variants chalata hai (full drama / full movie / episode ...),
// chhoti clips, trailers, OST waghera hata deta hai aur naam se sab se milti-julti video chunta hai.

const yts = require('yt-search');

const STOP = new Set(['or', 'aur', 'and', 'ka', 'ki', 'ke', 'the', 'full', 'drama', 'dramas', 'episode', 'ep', 'movie', 'film', 'hd', 'new', 'latest', 'part']);
const JUNK = /\b(trailer|teaser|promo|ost|song|songs|scene|scenes|clip|clips|review|reaction|behind the scenes|bts|shorts?|status|whatsapp status|making|interview|mashup)\b/i;

const norm = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const tokens = s => norm(s).split(' ').filter(t => t.length > 1 && !STOP.has(t));

function variants(query, kind) {
    const q = String(query).trim();
    const aur = q.replace(/\bor\b/gi, 'aur');
    const base = [q, aur].filter((v, i, a) => v && a.indexOf(v) === i);
    const extra = kind === 'movie'
        ? [' full movie', ' full film', ' movie']
        : [' full drama', ' full episode', ' episode 1', ' drama'];
    const list = [];
    for (const b of base) for (const e of extra) list.push(b + e);
    for (const b of base) list.push(b);
    return [...new Set(list)].slice(0, 6);
}

async function findLong(query, { kind = 'drama', minSeconds = 900 } = {}) {
    const wantJunk = JUNK.test(query);
    const results = await Promise.allSettled(variants(query, kind).map(v => yts(v)));
    const seen = new Map();
    let anyOk = false;
    for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        anyOk = true;
        for (const v of (r.value.videos || [])) if (v && v.videoId && !seen.has(v.videoId)) seen.set(v.videoId, v);
    }
    if (!anyOk) throw new Error('SEARCH_FAILED');

    const qTokens = tokens(query);
    const scored = [];
    for (const v of seen.values()) {
        if (Number(v.seconds) < minSeconds) continue;
        if (!wantJunk && JUNK.test(v.title || '')) continue;
        const tTokens = new Set(tokens((v.title || '') + ' ' + (v.author && v.author.name || '')));
        const hit = qTokens.filter(t => tTokens.has(t)).length;
        const ratio = qTokens.length ? hit / qTokens.length : 1;
        if (qTokens.length && hit === 0) continue;                       // naam se kuch bhi nahi milta
        const score = ratio * 100 + Math.log10(Number(v.views || 0) + 10) * 4 + Math.min(Number(v.seconds) / 3600, 3);
        scored.push({ v, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.v);
}

module.exports = { findLong };
