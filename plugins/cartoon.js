// plugins/cartoon.js
// CARTOON — anime + cartoon info (Jikan → TVmaze → TMDB → Wikipedia)

const { cmd } = require('../arslan');

// ─────────────────────────────────────────────
// ⚙️ CONFIG — TMDB key optional hai (fallback ke liye)
const TMDB_KEY = ''; // https://www.themoviedb.org/settings/api
// ─────────────────────────────────────────────

const timeoutFetch = async (url, ms = 15000) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
        return await fetch(url, { signal: ctrl.signal });
    } finally {
        clearTimeout(t);
    }
};

const safeJson = async (res) => res.json().catch(() => null);
// WhatsApp me MarkdownV2 escaping nahi chalta (backslash dikhte the) -> sirf formatting todne wale chars hatao
const esc = (s) => String(s || '').replace(/[*`]/g, '');
const strip = (html) => String(html || '').replace(/<[^>]+>/g, '');

// ─── API 1: Jikan v4 (MyAnimeList) — anime specialist, no key ───
async function fromJikan(query) {
    const res = await timeoutFetch(
        `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1&sfw=true`
    );
    const data = await safeJson(res);
    if (!data || !data.data || !data.data.length) return null;
    const a = data.data[0];

    let aired = '';
    if (a.aired?.from) {
        aired = a.aired.from.slice(0, 4);
        if (a.aired.to) aired += ` - ${a.aired.to.slice(0, 4)}`;
    }

    return {
        source: 'MyAnimeList',
        title: a.title_english || a.title,
        original: (a.title_english && a.title_english !== a.title) ? a.title : '',
        year: aired,
        type: a.type || '',
        episodes: a.episodes ? `${a.episodes}` : (a.status === 'Currently Airing' ? 'ongoing' : ''),
        status: a.status || '',
        runtime: a.duration && a.duration !== 'Unknown' ? a.duration.replace(' per ep', '') : '',
        genre: (a.genres || []).map(g => g.name).join(', '),
        studio: (a.studios || []).map(s => s.name).join(', '),
        rating: a.score ? `${a.score}/10` : '',
        votes: a.scored_by ? `${a.scored_by}` : '',
        rank: a.rank ? `#${a.rank}` : '',
        popularity: a.popularity ? `#${a.popularity} popular` : '',
        plot: a.synopsis || '',
        poster: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || null,
        trailer: a.trailer?.youtube_id ? `https://youtu.be/${a.trailer.youtube_id}` : '',
        ageRating: a.rating || ''
    };
}

// ─── API 2: TVmaze (no key) — Western cartoons ───
async function fromTvmaze(query) {
    const res = await timeoutFetch(
        `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(query)}`
    );
    const d = await safeJson(res);
    if (!d) return null;
    return {
        source: 'TVmaze',
        title: d.name,
        original: '',
        year: d.premiered ? d.premiered.slice(0, 4) : '',
        type: '',
        episodes: '',
        status: d.status || '',
        runtime: d.averageRuntime ? `${d.averageRuntime} min/ep` : '',
        genre: (d.genres || []).join(', '),
        studio: d.network?.name || d.webChannel?.name || '',
        rating: d.rating?.average ? `${d.rating.average}/10` : '',
        votes: '',
        rank: '',
        popularity: '',
        plot: strip(d.summary),
        poster: d.image?.original || d.image?.medium || null,
        trailer: '',
        ageRating: ''
    };
}

// ─── API 3: TMDB (optional key) — animation movies ───
async function fromTmdb(query) {
    if (!TMDB_KEY) return null;
    const isJwt = TMDB_KEY.startsWith('ey');
    const h = isJwt ? { Authorization: `Bearer ${TMDB_KEY}` } : {};
    const keyParam = isJwt ? '' : `&api_key=${TMDB_KEY}`;

    const tmdbGet = async (path) => {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 15000);
        try {
            return await fetch(`https://api.themoviedb.org/3${path}`, {
                headers: h, signal: ctrl.signal
            });
        } finally { clearTimeout(t); }
    };

    const sRes = await tmdbGet(
        `/search/multi?query=${encodeURIComponent(query)}&include_adult=false&page=1${keyParam}`
    );
    const search = await safeJson(sRes);
    if (!search || !search.results || !search.results.length) return null;
    const item = search.results[0];
    const type = item.media_type || 'movie';
    const dRes = await tmdbGet(`/${type}/${item.id}?language=en-US${keyParam}`);
    const d = await safeJson(dRes);
    if (!d) return null;
    return {
        source: 'TMDB',
        title: d.title || d.name,
        original: '',
        year: (d.release_date || d.first_air_date || '').slice(0, 4),
        type: type === 'tv' ? 'TV Series' : 'Movie',
        episodes: d.number_of_episodes ? String(d.number_of_episodes) : '',
        status: d.status || '',
        runtime: d.runtime ? `${d.runtime} min` : '',
        genre: (d.genres || []).map(g => g.name).join(', '),
        studio: (d.production_companies || [])[0]?.name || '',
        rating: d.vote_average ? `${d.vote_average.toFixed(1)}/10` : '',
        votes: d.vote_count ? String(d.vote_count) : '',
        rank: '',
        popularity: '',
        plot: d.overview || '',
        poster: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : null,
        trailer: '',
        ageRating: ''
    };
}

// ─── API 4: Wikipedia (no key) ───
async function fromWiki(query) {
    const res = await timeoutFetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`
    );
    const d = await safeJson(res);
    if (!d || !d.title || !d.extract) return null;
    return {
        source: 'Wikipedia',
        title: d.title,
        original: '',
        year: '',
        type: '',
        episodes: '',
        status: '',
        runtime: '',
        genre: '',
        studio: '',
        rating: '',
        votes: '',
        rank: '',
        popularity: '',
        plot: d.extract,
        poster: d.thumbnail?.source || null,
        trailer: '',
        ageRating: ''
    };
}

function formatCard(c) {
    const lines = [
        `🎌 *${esc(c.title)}*`,
        c.original ? `🇯🇵 ${esc(c.original)}` : '',
        c.type ? `📼 Type: \`${esc(c.type)}\`` : '',
        c.year ? `📅 Year: \`${esc(c.year)}\`` : '',
        c.status ? `📡 Status: \`${esc(c.status)}\`` : '',
        c.episodes ? `📦 Episodes: \`${esc(c.episodes)}\`` : '',
        c.runtime ? `⏱️ Runtime: \`${esc(c.runtime)}\`` : '',
        c.genre ? `🎭 Genre: ${esc(c.genre)}` : '',
        c.studio ? `🏢 Studio: ${esc(c.studio)}` : '',
        c.rating ? `⭐ Score: ${esc(c.rating)}${c.votes ? ` \`(${esc(c.votes)} users)\`` : ''}` : '',
        c.rank ? `🏆 Rank: \`${esc(c.rank)}\`` : '',
        c.ageRating ? `🔞 ${esc(c.ageRating)}` : '',
        '',
        c.plot ? `📝 *Synopsis:*\n${esc(c.plot.slice(0, 800))}${c.plot.length > 800 ? '...' : ''}` : '',
        c.trailer ? `\n▶️ *Trailer:* ${c.trailer}` : ''
    ].filter(Boolean);
    return lines.join('\n') + `\n\n📡 _Source: ${c.source}_`;
}

cmd({
    pattern: 'cartoon',
    // 'anime' aur 'toon' alias hata diye: .anime pehle se anime.js ka command hai, .toon ab toonfind ka hai
    alias: ['acartoon', 'anim', 'cartooninfo'],
    desc: 'Get anime/cartoon info (Jikan + 3 more APIs)',
    category: 'anime',
    react: '🎌',
    filename: __filename
},
async (conn, mek, m, { from, args, reply }) => {
    try {
        if (!args.length) {
            return reply(
`🎌 *CARTOON / ANIME INFO*

📌 *Usage:* .cartoon <name>

📖 *Examples:*
.cartoon Naruto
.cartoon Demon Slayer
.cartoon Tom and Jerry
.cartoon Doraemon

🔗 APIs: MyAnimeList + TVmaze + TMDB + Wikipedia`
            );
        }

        const query = args.join(' ');
        await reply(`🎌 *Searching:* \`${query}\`\n⏳ Please wait...`);

        // Fallback chain: Jikan → TVmaze → TMDB → Wikipedia
        let result = null;
        const sources = [fromJikan, fromTvmaze, fromTmdb, fromWiki];
        const names = ['MyAnimeList', 'TVmaze', 'TMDB', 'Wikipedia'];

        for (let i = 0; i < sources.length; i++) {
            try {
                result = await sources[i](query);
            } catch (e) {
                console.error(`[cartoon] ${names[i]} error:`, e.message);
            }
            if (result) break;
        }

        if (!result) {
            return reply(`❌ *Not found:* \`${query}\`\n\n💡 Try:\n• English anime name\n• Roman spelling check karo`);
        }

        const card = formatCard(result);

        if (result.poster) {
            try {
                await conn.sendMessage(from, {
                    image: { url: result.poster },
                    caption: card
                }, { quoted: mek });
                return;
            } catch { /* fallback text */ }
        }

        return reply(card);

    } catch (err) {
        return reply(`❌ ${err.message}`);
    }
});
