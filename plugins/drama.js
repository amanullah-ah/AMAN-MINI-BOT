// plugins/drama.js
// DRAMA — TV drama/series info (TVmaze → TMDB → OMDb → Wikipedia)

const { cmd } = require('../arslan');

// ─────────────────────────────────────────────
// ⚙️ CONFIG — free keys yahan daalo (optional)
const OMDB_KEY = ''; // https://www.omdbapi.com/apikey.aspx
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
const esc = (s) => String(s || '');   // WhatsApp mein MarkdownV2 escaping nahi chahiye
const strip = (html) => String(html || '').replace(/<[^>]+>/g, '');

// ─── API 1: TVmaze (no key) — series specialist ───
async function fromTvmaze(query) {
    const res = await timeoutFetch(
        `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(query)}&embed=episodes`
    );
    const d = await safeJson(res);
    if (!d) return null;

    const eps = d._embedded?.episodes || [];
    const now = new Date().toISOString().slice(0, 10);
    const aired = eps.filter(e => e.airdate && e.airdate <= now);
    const upcoming = eps.filter(e => e.airdate && e.airdate > now);

    const latest = aired[aired.length - 1];
    const next = upcoming[0];

    let episodeInfo = '';
    if (latest) {
        episodeInfo += `\n📺 *Latest:* S${String(latest.season).padStart(2, '0')}E${String(latest.number).padStart(2, '0')} \`${esc(latest.name)}\` — ${latest.airdate}`;
    }
    if (next) {
        episodeInfo += `\n⏭️ *Next:* S${String(next.season).padStart(2, '0')}E${String(next.number).padStart(2, '0')} \`${esc(next.name)}\` — ${next.airdate}`;
    }

    return {
        source: 'TVmaze',
        title: d.name,
        year: d.premiered ? d.premiered.slice(0, 4) : '',
        status: d.status || '',
        network: d.network?.name || d.webChannel?.name || '',
        country: d.network?.country?.name || d.webChannel?.country?.name || '',
        runtime: d.averageRuntime ? `${d.averageRuntime} min/ep` : '',
        genre: (d.genres || []).join(', '),
        rating: d.rating?.average ? `${d.rating.average}/10` : '',
        plot: strip(d.summary),
        poster: d.image?.original || d.image?.medium || null,
        extra: eps.length ? `📦 Total Episodes: \`${eps.length}\`` + episodeInfo : '',
        officialSite: d.officialSite || ''
    };
}

// ─── API 2: TMDB ────────────────────────────
async function tmdbFetch(path) {
    if (TMDB_KEY.startsWith('ey')) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 15000);
        try {
            return await fetch(`https://api.themoviedb.org/3${path}`, {
                headers: { Authorization: `Bearer ${TMDB_KEY}` },
                signal: ctrl.signal
            });
        } finally { clearTimeout(t); }
    }
    const sep = path.includes('?') ? '&' : '?';
    return timeoutFetch(`https://api.themoviedb.org/3${path}${sep}api_key=${TMDB_KEY}`);
}

async function fromTmdb(query) {
    if (!TMDB_KEY) return null;
    const sRes = await tmdbFetch(
        `/search/tv?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`
    );
    const search = await safeJson(sRes);
    if (!search || !search.results || !search.results.length) return null;
    const item = search.results[0];
    const dRes = await tmdbFetch(`/tv/${item.id}?language=en-US`);
    const d = await safeJson(dRes);
    if (!d) return null;

    let lastEp = '';
    if (d.last_episode_to_air) {
        const le = d.last_episode_to_air;
        lastEp = `\n📺 *Latest:* S${String(le.season_number).padStart(2, '0')}E${String(le.episode_number).padStart(2, '0')} \`${esc(le.name)}\` — ${le.air_date || ''}`;
    }
    if (d.next_episode_to_air) {
        const ne = d.next_episode_to_air;
        lastEp += `\n⏭️ *Next:* S${String(ne.season_number).padStart(2, '0')}E${String(ne.episode_number).padStart(2, '0')} \`${esc(ne.name)}\` — ${ne.air_date || ''}`;
    }

    return {
        source: 'TMDB',
        title: d.name,
        year: (d.first_air_date || '').slice(0, 4),
        status: d.status || '',
        network: (d.networks || []).map(n => n.name).join(', '),
        country: (d.origin_country || []).join(', '),
        runtime: d.episode_run_time?.[0] ? `${d.episode_run_time[0]} min/ep` : '',
        genre: (d.genres || []).map(g => g.name).join(', '),
        rating: d.vote_average ? `${d.vote_average.toFixed(1)}/10` : '',
        votes: d.vote_count ? String(d.vote_count) : '',
        plot: d.overview || '',
        poster: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : null,
        extra: d.number_of_episodes ? `📦 Total Episodes: \`${d.number_of_episodes}\` (${d.number_of_seasons} seasons)` + lastEp : ''
    };
}

// ─── API 3: OMDb ────────────────────────────
async function fromOmdb(query) {
    if (!OMDB_KEY) return null;
    const res = await timeoutFetch(
        `https://www.omdbapi.com/?t=${encodeURIComponent(query)}&type=series&apikey=${OMDB_KEY}&plot=full`
    );
    const data = await safeJson(res);
    if (!data || data.Response === 'False') return null;
    return {
        source: 'OMDb',
        title: data.Title,
        year: data.Year,
        status: '',
        network: '',
        country: data.Country || '',
        runtime: data.Runtime,
        genre: data.Genre,
        rating: data.imdbRating && data.imdbRating !== 'N/A' ? `${data.imdbRating}/10 (IMDb)` : '',
        votes: data.imdbVotes !== 'N/A' ? data.imdbVotes : '',
        plot: data.Plot && data.Plot !== 'N/A' ? data.Plot : '',
        poster: data.Poster && data.Poster !== 'N/A' ? data.Poster : null,
        extra: data.totalSeasons && data.totalSeasons !== 'N/A' ? `📦 Seasons: \`${data.totalSeasons}\`` : '',
        actors: data.Actors
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
        status: '',
        network: '',
        country: '',
        runtime: '',
        genre: '',
        rating: '',
        votes: '',
        plot: d.extract,
        poster: d.thumbnail?.source || null,
        extra: ''
    };
}

function formatCard(d) {
    const lines = [
        `🎭 *${esc(d.title)}*`,
        d.year ? `📅 Year: \`${esc(d.year)}\`` : '',
        d.status ? `📡 Status: \`${esc(d.status)}\`` : '',
        d.network ? `📺 Network: ${esc(d.network)}` : '',
        d.country ? `🌍 Country: \`${esc(d.country)}\`` : '',
        d.runtime ? `⏱️ Runtime: \`${esc(d.runtime)}\`` : '',
        d.genre ? `🎭 Genre: ${esc(d.genre)}` : '',
        d.rating ? `⭐ Rating: ${esc(d.rating)}${d.votes ? ` \`(${esc(d.votes)} votes)\`` : ''}` : '',
        d.actors && d.actors !== 'N/A' ? `🎬 Cast: ${esc(d.actors)}` : '',
        '',
        d.plot ? `📝 *Plot:*\n${esc(d.plot.slice(0, 800))}${d.plot.length > 800 ? '...' : ''}` : '',
        d.extra || '',
        d.officialSite ? `🔗 ${esc(d.officialSite)}` : ''
    ].filter(Boolean);
    return lines.join('\n') + `\n\n📡 _Source: ${d.source}_`;
}

cmd({
    pattern: 'drama',
    alias: ['series', 'serial', 'kdrama', 'show'],
    desc: 'Get drama/series info (4 APIs fallback)',
    category: 'general',
    react: '🎭',
    filename: __filename
},
async (conn, mek, m, { args, reply, from }) => {
    try {
        if (!args.length) {
            return reply(
`🎭 *DRAMA INFO*

📌 *Usage:* .drama <name>

📖 *Examples:*
.drama Ertugrul
.drama Money Heist
.drama Mere Paas Tum Ho
.drama Squid Game

🔗 APIs: TVmaze + TMDB + OMDb + Wikipedia`
            );
        }

        const query = args.join(' ');
        await reply(`🎭 *Searching:* \`${query}\`\n⏳ Please wait...`);

        // Fallback chain: TVmaze → TMDB → OMDb → Wikipedia
        let result = null;
        const sources = [fromTvmaze, fromTmdb, fromOmdb, fromWiki];
        const names = ['TVmaze', 'TMDB', 'OMDb', 'Wikipedia'];

        for (let i = 0; i < sources.length; i++) {
            try {
                result = await sources[i](query);
            } catch (e) {
                console.error(`[drama] ${names[i]} error:`, e.message);
            }
            if (result) break;
        }

        if (!result) {
            return reply(`❌ *Not found:* \`${query}\`\n\n💡 Try:\n• English title use karo\n• Roman Urdu nahi, official spelling`);
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
