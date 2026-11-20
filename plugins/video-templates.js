// plugins/video-templates.js — VIDEO EDITING category (sab ffmpeg se, koi API key nahi)
//
// Kaise use karein: kisi video (ya photo) par REPLY karke command likho, ya video bhejte waqt caption me command likho.
//   .vtcinematic              → template lag kar nayi video
//   .vtromantic Tum meri jaan → video par neeche text bhi (caption)
//
// Style templates : vtaesthetic vtcinematic vtdua vtenergetic vtfunny vtlove vtmotivational vtnight
//                   vtpoetry vtromantic vtsad vtsports vttravel vtvintage vtviral vvintage vvivid vwarm
// Tools           : vtrim <start> <end> | vtogif (video → GIF) | vtomp3 (video → mp3) | vthumb [sec] (thumbnail)
// List            : vtemplate
//
// Photo par style template lagao to 6 second ki slow-zoom video ban jati hai.

const fs = require('fs');
const { cmd } = require('../arslan');
const config = require('../config');
const V = require('../lib/vedit');

const P = () => config.PREFIX || '.';
const CATEGORY = 'videoediting';
const react = (conn, from, mek, e) => conn.sendMessage(from, { react: { text: e, key: mek.key } }).catch(() => {});

// ───────────── templates (yahan se filters badal sakte hain) ─────────────
// vf    : ffmpeg video filters        speed : 1 = normal, 1.2 = tez, 0.9 = thori slow
// base  : size wali scale (default: 720px chaudai tak)
const BASE = "scale='min(720,iw)':-2";
const TEMPLATES = {
    vtaesthetic:    { emoji: '🌸', title: 'Aesthetic',    vf: 'eq=contrast=0.92:brightness=0.05:saturation=0.8,colorbalance=rs=0.05:gs=-0.02:bs=0.1,gblur=sigma=0.5,vignette=PI/5' },
    vtcinematic:    { emoji: '🎬', title: 'Cinematic',    vf: "eq=contrast=1.12:saturation=1.1,colorbalance=rs=0.08:bs=-0.06:rh=0.05:bh=0.08,vignette=PI/6,drawbox=x=0:y=0:w=iw:h=ih*0.1:color=black:t=fill,drawbox=x=0:y=ih-ih*0.1:w=iw:h=ih*0.1:color=black:t=fill" },
    vtdua:          { emoji: '🤲', title: 'Dua',          vf: 'eq=brightness=-0.03:saturation=0.9,colorbalance=rs=0.06:gs=0.03:bs=-0.05,gblur=sigma=0.5,vignette=PI/4' },
    vtenergetic:    { emoji: '⚡', title: 'Energetic',    vf: 'eq=contrast=1.15:saturation=1.5:brightness=0.02,unsharp=5:5:0.8', speed: 1.15 },
    vtfunny:        { emoji: '😂', title: 'Funny',        vf: 'eq=saturation=1.6:contrast=1.1,hue=h=8', speed: 1.25 },
    vtlove:         { emoji: '💖', title: 'Love',         vf: 'eq=saturation=1.2:brightness=0.03,colorbalance=rs=0.12:gs=-0.05:bs=0.05:rm=0.08,gblur=sigma=0.7,vignette=PI/5' },
    vtmotivational: { emoji: '🔥', title: 'Motivational', vf: 'eq=contrast=1.25:saturation=0.8:brightness=-0.03,unsharp=5:5:1.0,vignette=PI/4' },
    vtnight:        { emoji: '🌙', title: 'Night',        vf: 'eq=brightness=-0.08:contrast=1.1:saturation=0.9,colorbalance=bs=0.15:bm=0.1:rs=-0.08,vignette=PI/4' },
    vtpoetry:       { emoji: '✍️', title: 'Poetry',       vf: 'eq=saturation=0.6:contrast=1.05,colorbalance=rs=0.1:gs=0.04:bs=-0.1,gblur=sigma=0.8,vignette=PI/4', speed: 0.9 },
    vtromantic:     { emoji: '🌹', title: 'Romantic',     vf: 'eq=saturation=1.15:brightness=0.05:contrast=0.95,colorbalance=rs=0.1:bs=0.1:rm=0.05,gblur=sigma=0.9,vignette=PI/5' },
    vtsad:          { emoji: '💔', title: 'Sad',          vf: 'eq=saturation=0.35:brightness=-0.06:contrast=1.05,colorbalance=bs=0.08,gblur=sigma=0.5,vignette=PI/3.5', speed: 0.9 },
    vtsports:       { emoji: '🏆', title: 'Sports',       vf: 'eq=contrast=1.2:saturation=1.35,unsharp=5:5:1.2', speed: 1.1 },
    vttravel:       { emoji: '✈️', title: 'Travel',       vf: 'eq=saturation=1.3:brightness=0.04:contrast=1.08,colorbalance=rs=0.05:bs=-0.05:gs=0.02' },
    vtvintage:      { emoji: '📼', title: 'Vintage',      vf: 'eq=saturation=0.7:contrast=1.1,colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131,noise=alls=12:allf=t,vignette=PI/4' },
    vtviral:        { emoji: '🚀', title: 'Viral (9:16)', base: "crop='if(gt(iw/ih,9/16),ih*9/16,iw)':'if(gt(iw/ih,9/16),ih,iw*16/9)',scale=720:1280", vf: 'eq=saturation=1.45:contrast=1.12,unsharp=5:5:0.8' },
    // sirf rang ka filter
    vvintage:       { emoji: '🎞️', title: 'Vintage filter', vf: 'eq=saturation=0.75:contrast=1.08,colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131' },
    vvivid:         { emoji: '🌈', title: 'Vivid filter',   vf: 'eq=saturation=1.6:contrast=1.15,unsharp=5:5:0.6' },
    vwarm:          { emoji: '☀️', title: 'Warm filter',    vf: 'eq=brightness=0.03:saturation=1.1,colorbalance=rs=0.12:gs=0.03:bs=-0.12:rm=0.06:bm=-0.06' }
};

// ───────────── processing ─────────────
const busy = new Set();
let active = 0;
const MAX_ACTIVE = 2;     // ek waqt me max itni video jobs (server halka rahe)

async function withJob(key, reply, fn) {
    if (busy.has(key)) return reply('⏳ Aap ki pehli video abhi ban rahi hai, thora ruko.');
    if (active >= MAX_ACTIVE) return reply('⏳ Abhi bot dusri videos bana raha hai, 1 minute baad try karo.');
    busy.add(key); active++;
    try { return await fn(); } finally { busy.delete(key); active--; }
}

function buildFilter(tpl, caption, textFile, font) {
    const f = [tpl.base || BASE];
    if (tpl.vf) f.push(tpl.vf);
    if (tpl.speed && tpl.speed !== 1) f.push(`setpts=PTS/${tpl.speed}`);
    if (caption && textFile && font) {
        f.push(`drawtext=fontfile='${font}':textfile='${textFile}':fontcolor=white:fontsize=h/20:line_spacing=6:box=1:boxcolor=black@0.5:boxborderw=14:x=(w-text_w)/2:y=h-text_h-h/10`);
    }
    f.push('format=yuv420p');
    return f.join(',');
}

// template lagao. Success par { buffer, note }
async function applyTemplate(buffer, kind, tpl, caption) {
    const inFile = V.tmpFile(kind === 'image' ? 'jpg' : 'mp4');
    const out = V.tmpFile('mp4');
    const txt = V.tmpFile('txt');
    const tmps = [inFile, out, txt];
    try {
        let head, imgSize = null;
        if (kind === 'image') {
            const prep = await V.prepImage(buffer);
            fs.writeFileSync(inFile, prep.buffer);
            imgSize = `${prep.W}x${prep.H}`;
            head = ['-i', inFile];
        } else {
            fs.writeFileSync(inFile, buffer);
            head = ['-i', inFile];
        }
        const font = caption ? V.findFont() : null;
        if (caption && font) fs.writeFileSync(txt, V.wrapText(caption));
        let note = '';
        if (caption && !font) note = 'Font nahi mila, is liye text nahi laga.';

        const attempt = async (withText) => {
            let vf = buildFilter(tpl, caption, txt, font && withText ? font : null);
            if (kind === 'image') {
                vf = `zoompan=z='min(zoom+0.0009,1.18)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=150:s=${imgSize}:fps=25,${vf.replace(BASE + ',', '')}`;
            }
            const args = [...head, '-vf', vf];
            if (kind === 'video') {
                args.push('-map', '0:v:0', '-map', '0:a?');
                if (tpl.speed && tpl.speed !== 1) args.push('-af', `atempo=${tpl.speed}`);
                args.push('-c:a', 'aac', '-b:a', '128k');
            }
            args.push('-t', String(kind === 'image' ? 6 : V.MAX_SECONDS),
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out);
            await V.run(args);
        };
        try { await attempt(true); }
        catch (e1) {
            if (!caption) throw e1;
            note = 'Text lagane me masla aya, is liye bina text ke bana di.';
            await attempt(false);
        }
        return { buffer: fs.readFileSync(out), note };
    } finally { V.rm(...tmps); }
}

const usage = (name, tpl) =>
    `${tpl.emoji} *${tpl.title.toUpperCase()}*\n\nKisi *video ya photo* par reply karke likho:\n\`${P()}${name}\`\nText ke saath: \`${P()}${name} Aap ka text\`\n\n_Saari templates: ${P()}vtemplate_`;

for (const [name, tpl] of Object.entries(TEMPLATES)) {
    cmd({
        pattern: name,
        desc: `${tpl.title} video template`,
        category: CATEGORY,
        react: tpl.emoji,
        use: `.${name} [text]`,
        filename: __filename
    }, async (conn, mek, m, { args, reply, from, sender }) => {
        let media;
        try { media = await V.getMedia(m); } catch (e) { return reply(`❌ ${e.message}`); }
        if (!media) return reply(usage(name, tpl));
        const caption = args.join(' ').trim().slice(0, 120);
        return withJob(sender || from, reply, async () => {
            await react(conn, from, mek, '⏳');
            try {
                const { buffer, note } = await applyTemplate(media.buffer, media.kind, tpl, caption);
                await conn.sendMessage(from, { video: buffer, mimetype: 'video/mp4', caption: `${tpl.emoji} *${tpl.title}*${note ? `\n_${note}_` : ''}` }, { quoted: mek });
                await react(conn, from, mek, '✅');
            } catch (e) {
                await react(conn, from, mek, '❌');
                return reply(`❌ Video nahi ban saki.\n_${String(e.message).slice(0, 120)}_`);
            }
        });
    });
}

// ───────────── .vtrim <start> <end> ─────────────
function parseTime(t) {
    if (t == null || t === '') return null;
    const parts = String(t).trim().split(':').map(Number);
    if (parts.some(n => !Number.isFinite(n) || n < 0)) return NaN;
    return parts.reduce((acc, n) => acc * 60 + n, 0);
}

cmd({
    pattern: 'vtrim',
    alias: ['trimvideo', 'cutvideo'],
    desc: 'Video ka hissa kaato (start aur end second)',
    category: CATEGORY,
    react: '✂️',
    use: '.vtrim <start> <end>',
    filename: __filename
}, async (conn, mek, m, { args, reply, from, sender }) => {
    let media;
    try { media = await V.getMedia(m); } catch (e) { return reply(`❌ ${e.message}`); }
    if (!media || media.kind !== 'video') {
        return reply(`✂️ *VIDEO TRIM*\n\nVideo par reply karke likho:\n\`${P()}vtrim 5 15\`  → 5 se 15 second\n\`${P()}vtrim 0:10 0:45\`  → 10 sec se 45 sec\n\`${P()}vtrim 20\`  → 20 sec se aakhir tak`);
    }
    const start = parseTime(args[0]);
    const end = parseTime(args[1]);
    if (start == null || Number.isNaN(start) || Number.isNaN(end)) return reply(`❌ Time sahi likho. Misal: \`${P()}vtrim 5 15\``);
    if (end != null && end <= start) return reply('❌ End time start se bara hona chahiye.');
    const span = end != null ? end - start : 180;
    return withJob(sender || from, reply, async () => {
        await react(conn, from, mek, '⏳');
        const inFile = V.tmpFile('mp4'), out = V.tmpFile('mp4');
        try {
            fs.writeFileSync(inFile, media.buffer);
            await V.run(['-i', inFile, '-ss', String(start), '-t', String(Math.min(span, 180)),
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out]);
            const buf = fs.readFileSync(out);
            if (!buf.length) throw new Error('is hisse me video nahi mili');
            await conn.sendMessage(from, { video: buf, mimetype: 'video/mp4', caption: `✂️ *Trim*  ${start}s → ${end != null ? end + 's' : 'end'}` }, { quoted: mek });
            await react(conn, from, mek, '✅');
        } catch (e) {
            await react(conn, from, mek, '❌');
            return reply(`❌ Trim nahi ho saka.\n_${String(e.message).slice(0, 120)}_`);
        } finally { V.rm(inFile, out); }
    });
});

// ───────────── .vtogif ─────────────
cmd({
    pattern: 'vtogif',
    alias: ['videotogif', 'vid2gif'],
    desc: 'Video ko GIF (loop wali chhoti video) banao',
    category: CATEGORY,
    react: '🎞️',
    use: '.vtogif',
    filename: __filename
}, async (conn, mek, m, { reply, from, sender }) => {
    let media;
    try { media = await V.getMedia(m); } catch (e) { return reply(`❌ ${e.message}`); }
    if (!media || media.kind !== 'video') return reply(`🎞️ *VIDEO → GIF*\n\nKisi *video* par reply karke \`${P()}vtogif\` likho.\n_(pehle 8 second ki GIF banti hai)_`);
    return withJob(sender || from, reply, async () => {
        await react(conn, from, mek, '⏳');
        const inFile = V.tmpFile('mp4'), out = V.tmpFile('mp4');
        try {
            fs.writeFileSync(inFile, media.buffer);
            await V.run(['-i', inFile, '-t', '8', '-vf', "fps=15,scale='min(480,iw)':-2,format=yuv420p", '-an',
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-movflags', '+faststart', out]);
            await conn.sendMessage(from, { video: fs.readFileSync(out), mimetype: 'video/mp4', gifPlayback: true, caption: '🎞️ *GIF*' }, { quoted: mek });
            await react(conn, from, mek, '✅');
        } catch (e) {
            await react(conn, from, mek, '❌');
            return reply(`❌ GIF nahi ban saki.\n_${String(e.message).slice(0, 120)}_`);
        } finally { V.rm(inFile, out); }
    });
});

// ───────────── .vtomp3 ─────────────
cmd({
    pattern: 'vtomp3',
    alias: ['videotomp3', 'vid2mp3'],
    desc: 'Video ki awaaz mp3 mein nikalo',
    category: CATEGORY,
    react: '🎵',
    use: '.vtomp3',
    filename: __filename
}, async (conn, mek, m, { reply, from, sender }) => {
    let media;
    try { media = await V.getMedia(m, { audio: true }); } catch (e) { return reply(`❌ ${e.message}`); }
    if (!media || media.kind === 'image') return reply(`🎵 *VIDEO → MP3*\n\nKisi *video* par reply karke \`${P()}vtomp3\` likho.`);
    return withJob(sender || from, reply, async () => {
        await react(conn, from, mek, '⏳');
        const inFile = V.tmpFile('bin'), out = V.tmpFile('mp3');
        try {
            fs.writeFileSync(inFile, media.buffer);
            await V.run(['-i', inFile, '-vn', '-map', '0:a:0', '-t', '900', '-c:a', 'libmp3lame', '-q:a', '3', out]);
            await conn.sendMessage(from, { audio: fs.readFileSync(out), mimetype: 'audio/mpeg', ptt: false }, { quoted: mek });
            await react(conn, from, mek, '✅');
        } catch (e) {
            await react(conn, from, mek, '❌');
            return reply(`❌ MP3 nahi ban saka (shayad video mein awaaz nahi).\n_${String(e.message).slice(0, 100)}_`);
        } finally { V.rm(inFile, out); }
    });
});

// ───────────── .vthumb ─────────────
cmd({
    pattern: 'vthumb',
    alias: ['videothumb', 'thumbnail'],
    desc: 'Video ka thumbnail (photo) nikalo',
    category: CATEGORY,
    react: '🖼️',
    use: '.vthumb [second]',
    filename: __filename
}, async (conn, mek, m, { args, reply, from, sender }) => {
    let media;
    try { media = await V.getMedia(m); } catch (e) { return reply(`❌ ${e.message}`); }
    if (!media || media.kind !== 'video') return reply(`🖼️ *VIDEO THUMBNAIL*\n\nKisi *video* par reply karke likho:\n\`${P()}vthumb\`  → beech ka frame\n\`${P()}vthumb 7\`  → 7 second ka frame`);
    return withJob(sender || from, reply, async () => {
        await react(conn, from, mek, '⏳');
        const inFile = V.tmpFile('mp4'), out = V.tmpFile('jpg');
        try {
            fs.writeFileSync(inFile, media.buffer);
            const dur = await V.probeDuration(inFile);
            let t = parseTime(args[0]);
            if (t == null || Number.isNaN(t)) t = dur ? dur / 2 : 1;
            if (dur && t >= dur) t = Math.max(0, dur - 0.5);
            await V.run(['-ss', String(t), '-i', inFile, '-frames:v', '1', '-q:v', '2', out]);
            await conn.sendMessage(from, { image: fs.readFileSync(out), caption: `🖼️ *Thumbnail*  (${Math.round(t * 10) / 10}s)` }, { quoted: mek });
            await react(conn, from, mek, '✅');
        } catch (e) {
            await react(conn, from, mek, '❌');
            return reply(`❌ Thumbnail nahi nikal saka.\n_${String(e.message).slice(0, 120)}_`);
        } finally { V.rm(inFile, out); }
    });
});

// ───────────── .vtemplate (list) ─────────────
cmd({
    pattern: 'vtemplate',
    alias: ['vtemplates', 'vtlist', 'videomenu'],
    desc: 'Video editing templates ki list',
    category: CATEGORY,
    react: '🎬',
    use: '.vtemplate',
    filename: __filename
}, async (conn, mek, m, { reply }) => {
    const p = P();
    const styles = Object.entries(TEMPLATES).map(([n, t]) => `${t.emoji} ${p}${n}`).join('\n');
    return reply(
        `🎬 *VIDEO EDITING*\n\n` +
        `Kisi *video ya photo* par reply karke command likho (text bhi likh sakte ho: \`${p}vtlove Tum meri jaan\`).\n\n` +
        `*Templates*\n${styles}\n\n` +
        `*Tools*\n✂️ ${p}vtrim <start> <end>\n🎞️ ${p}vtogif\n🎵 ${p}vtomp3\n🖼️ ${p}vthumb [second]`
    );
});

module.exports = { TEMPLATES, applyTemplate };
