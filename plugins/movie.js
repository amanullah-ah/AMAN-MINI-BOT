// plugins/movie.js
// MOVIE — movie/series info from multiple APIs (fallback chain)

const { cmd } = require('../arslan');

// ─────────────────────────────────────────────
// ⚙️ CONFIG — free keys yahan daalo (optional)
// OMDb : https://www.omdbapi.com/apikey.aspx (free)
// TMDB : https://www.themoviedb.org/settings/api (free)
const OMDB_KEY = ''; // e.g. 'a1b2c3d4'
const TMDB_KEY = ''; // e.g. 'eyJhbGci...'
// ─────────────────────────────────────────────

// Timeout wala fetch
const timeoutFetch = async (url, ms = 15000) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
        const res = await fetch(url, { signal: ctrl.signal });
        return res;
    } finally {
        clearTimeout(t);
    }
};

const safeJson = async (res) => res.json().catch(() => null);

const esc = (s) => String(s || '');   // WhatsApp mein MarkdownV2 escaping nahi chahiye

// ─── API 1: OMDb ────────────────────────────
async function fromOmdb(query) {
    if (!OMDB_KEY) return null;
    const res = await timeoutFetch(
        `https://www.omdbapi.com/?t=${encodeURIComponent(query)}&apikey=${OMDB_KEY}&plot=full`
    );
    const data = await safeJson(res);
    if (!data || data.Response === 'False') return null;
    return {
        source: 'OMDb',
        title: data.Title,
        year: data.Year,
        rated: data.Rated,
        runtime: data.Runtime,
        genre: data.Genre,
        director: data.Director,
        actors: data.Actors,
        rating: data.imdbRating && data.imdbRating !== 'N/A' ? `${data.imdbRating}/10 (IMDb)` : '',
        votes: data.imdbVotes !== 'N/A' ? data.imdbVotes : '',
        plot: data.Plot && data.Plot !== 'N/A' ? data.Plot : '',
        poster: data.Poster && data.Poster !== 'N/A' ? data.Poster : null,
        boxOffice: data.BoxOffice && data.BoxOffice !== 'N/A' ? data.BoxOffice : ''
    };
}

// ─── API 2: TMDB ────────────────────────────
async function tmdbFetch(path) {
    // JWT (v4) key: Bearer header | simple (v3) key: api_key param
    if (TMDB_KEY.startsWith('ey')) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 15000);
        try {
            const res = await fetch(`https://api.themoviedb.org/3${path}`, {
                headers: { Authorization: `Bearer ${TMDB_KEY}` },
                signal: ctrl.signal
            });
            return res;
        } finally { clearTimeout(t); }
    }
    const sep = path.includes('?') ? '&' : '?';
    return timeoutFetch(`https://api.themoviedb.org/3${path}${sep}api_key=${TMDB_KEY}`);
}

async function fromTmdb(query) {
    if (!TMDB_KEY) return null;
    const sRes = await tmdbFetch(
        `/search/multi?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`
    );
    const search = await safeJson(sRes); // headers handled in tmdbFetch via direct call
    if (!search || !search.results || !search.results.length) return null;
    const item = search.results[0];
    const type = item.media_type || 'movie';
    const dRes = await tmdbFetch(`/${type}/${item.id}?language=en-US`);
    const d = await safeJson(dRes);
    if (!d) return null;
    return {
        source: 'TMDB',
        title: d.title || d.name,
        year: (d.release_date || d.first_air_date || '').slice(0, 4),
        rated: '',
        runtime: d.runtime ? `${d.runtime} min` : (d.episode_run_time?.[0] ? `${d.episode_run_time[0]} min/ep` : ''),
        genre: (d.genres || []).map(g => g.name).join(', '),
        director: '',
        actors: '',
        rating: d.vote_average ? `${d.vote_average.toFixed(1)}/10 (TMDB)` : '',
        votes: d.vote_count ? String(d.vote_count) : '',
        plot: d.overview || '',
        poster: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : null,
        boxOffice: ''
    };
}

// ─── API 3: TVmaze (no key) ─────────────────
async function fromTvmaze(query) {
    const res = await timeoutFetch(
        `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(query)}`
    );
    const d = await safeJson(res);
    if (!d) return null;
    const strip = (html) => String(html || '').replace(/<[^>]+>/g, '');
    return {
        source: 'TVmaze',
        title: d.name,
        year: d.premiered ? d.premiered.slice(0, 4) : '',
        rated: d.rating?.average ? `${d.rating.average}/10` : '',
        runtime: d.averageRuntime ? `${d.averageRuntime} min/ep` : '',
        genre: (d.genres || []).join(', '),
        director: '',
        actors: '',
        rating: d.rating?.average ? `${d.rating.average}/10` : '',
        votes: '',
        plot: strip(d.summary),
        poster: d.image?.original || d.image?.medium || null,
        boxOffice: '',
        status: d.status || '',
        network: d.network?.name || d.webChannel?.name || ''
    };
}

// ─── API 4: Wikipedia (no key) ──────────────
async function fromWiki(query) {
    const res = await timeoutFetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`
    );
    const d = await safeJson(res);
    if (!d || !d.title || !d.extract) return null;
    return {
        source: 'Wikipedia',
        title: d.title,
        year: '',
        rated: '',
        runtime: '',
        genre: '',
        director: '',
        actors: '',
        rating: '',
        votes: '',
        plot: d.extract,
        poster: d.thumbnail?.source || null,
        boxOffice: ''
    };
}

function formatCard(m) {
    const lines = [
        `🎬 *${esc(m.title)}*`,
        m.year ? `📅 Year: \`${esc(m.year)}\`` : '',
        m.rated ? `🔞 Rated: \`${esc(m.rated)}\`` : '',
        m.runtime ? `⏱️ Runtime: \`${esc(m.runtime)}\`` : '',
        m.status ? `📡 Status: \`${esc(m.status)}\`` : '',
        m.network ? `📺 Network: \`${esc(m.network)}\`` : '',
        m.genre ? `🎭 Genre: ${esc(m.genre)}` : '',
        m.rating ? `⭐ Rating: ${esc(m.rating)}${m.votes ? ` \`(${esc(m.votes)} votes)\`` : ''}` : '',
        m.director && m.director !== 'N/A' ? `🎬 Director: ${esc(m.director)}` : '',
        m.actors && m.actors !== 'N/A' ? `🎭 Actors: ${esc(m.actors)}` : '',
        m.boxOffice ? `💰 Box Office: ${esc(m.boxOffice)}` : '',
        '',
        m.plot ? `📝 *Plot:*\n${esc(m.plot.slice(0, 900))}${m.plot.length > 900 ? '...' : ''}` : ''
    ].filter(Boolean);
    return lines.join('\n') + `\n\n📡 _Source: ${m.source}_`;
}

cmd({
    pattern: 'movie',
    alias: ['film', 'imdb', 'movinfo'],
    desc: 'Get movie/series info (4 APIs fallback)',
    category: 'general',
    react: '🎬',
    filename: __filename
},
async (conn, mek, m, { args, reply, from }) => {
    try {
        if (!args.length) {
            return reply(
`🎬 *MOVIE INFO*

📌 *Usage:* .movie <name>

📖 *Examples:*
.movie Inception
.movie Money Heist
.movie The Dark Knight

🔗 APIs: OMDb + TMDB + TVmaze + Wikipedia`
            );
        }

        const query = args.join(' ');
        await reply(`🎬 *Searching:* \`${query}\`\n⏳ Please wait...`);

        // Fallback chain: OMDb → TMDB → TVmaze → Wikipedia
        let result = null;
        const sources = [fromOmdb, fromTmdb, fromTvmaze, fromWiki];
        const names = ['OMDb', 'TMDB', 'TVmaze', 'Wikipedia'];

        for (let i = 0; i < sources.length; i++) {
            try {
                result = await sources[i](query);
            } catch (e) {
                console.error(`[movie] ${names[i]} error:`, e.message);
            }
            if (result) break;
        }

        if (!result) {
            return reply(`❌ *Not found:* \`${query}\`\n\n💡 Try:\n• Exact name\n• English title\n• IMDB / TMDB key config check karo`);
        }

        const card = formatCard(result);

        // Poster ke saath bhejo agar mila
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