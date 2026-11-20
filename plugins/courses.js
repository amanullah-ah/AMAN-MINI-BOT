// plugins/courses.js — COURSES category
//   .courses            -> saari courses ki list
//   .courses <number>   -> ek course ki detail
//   .addcourse Title | Link | Detail(optional)   (owner only)
//   .delcourse <number>                           (owner only)
// Data: data/courses.json  (Railway par redeploy se bachane ke liye Volume lagao aur env COURSES_FILE=/path/courses.json set karo)

const fs = require('fs');
const path = require('path');
const { cmd } = require('../arslan');
const config = require('../config');

const FILE = process.env.COURSES_FILE || path.join(__dirname, '..', 'data', 'courses.json');
const P = () => config.PREFIX || '.';

function load() {
    try {
        const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        return Array.isArray(data) ? data : [];
    } catch (_) { return []; }
}

function save(list) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
}

function courseText(c, i) {
    let t = `*${i + 1}. ${c.title}*`;
    if (c.detail) t += `\n${c.detail}`;
    if (c.link) t += `\n🔗 ${c.link}`;
    return t;
}

// ---------------- BUILT-IN COURSES ----------------
// MediaFire link yahan badlo: sirf 'link' wali line me apna link paste karo, baaki kuch na chhedo.
const PLACEHOLDER = 'MEDIAFIRE_LINK_YAHAN';
const BUILTIN = [
    { pattern: 'youtubeautomation', alias: ['ytautomation', 'youtube-automation'], title: 'YouTube Automation',  link: PLACEHOLDER },
    { pattern: 'tiktokautomation',  alias: ['tiktok-automation'],                  title: 'TikTok Automation',   link: PLACEHOLDER },
    { pattern: 'graphicsdesigner',  alias: ['graphic-designer', 'graphicdesign'],  title: 'Graphics Designer',   link: PLACEHOLDER },
    { pattern: 'mrbeastediting',    alias: ['mrbeast-editing', 'mrbeast'],         title: 'Mr Beast Editing',    link: PLACEHOLDER },
    { pattern: 'aivegetablesvideos', alias: ['ai-vegetables-videos', 'aiveggies'], title: 'AI Vegetables Videos', link: PLACEHOLDER }
];
const hasLink = (c) => c.link && c.link !== PLACEHOLDER && /^https?:\/\//i.test(c.link);

for (const c of BUILTIN) {
    cmd({
        pattern: c.pattern, alias: c.alias, desc: `${c.title} course`, use: `.${c.pattern}`,
        category: 'courses', react: '🎓', filename: __filename
    }, async (conn, mek, m, { from, reply }) => {
        if (!hasLink(c)) return reply(`🎓 *${c.title}*\n\n⏳ Link jald add hoga.`);
        const text = `🎓 *${c.title}*\n\n📥 Download:\n${c.link}`;
        try {
            const cm = require('./carousel-menu');
            if (await cm.sendButtons(conn, from, mek, text, [cm.urlButton('📥 Download', c.link)])) return;
        } catch (_) {}
        return conn.sendMessage(from, { text }, { quoted: mek });
    });
}

cmd({
    pattern: 'courses',
    alias: ['course', 'courselist'],
    desc: 'Courses ki list (.courses <number> se detail)',
    use: '.courses  |  .courses 1',
    category: 'courses',
    react: '🎓',
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    const list = load();
    const builtin = `🎓 *COURSES*\n\n` + BUILTIN.map(c => `➤ ${P()}${c.pattern}  — ${c.title}`).join('\n');
    if (!list.length) return conn.sendMessage(from, { text: builtin }, { quoted: mek });

    const n = parseInt(String(q || '').trim(), 10);
    if (Number.isInteger(n) && n >= 1 && n <= list.length) {
        return conn.sendMessage(from, { text: `🎓 *COURSE*\n\n${courseText(list[n - 1], n - 1)}` }, { quoted: mek });
    }

    const rows = list.map((c, i) => `*${i + 1}.* ${c.title}${c.link ? `\n   🔗 ${c.link}` : ''}`).join('\n\n');
    return conn.sendMessage(from, {
        text: `${builtin}\n\n➕ *Extra courses* (${list.length})\n\n${rows}\n\n_Detail ke liye:_ ${P()}courses <number>`
    }, { quoted: mek });
});

cmd({
    pattern: 'addcourse',
    alias: ['coursadd', 'newcourse'],
    desc: 'Naya course add karo (owner only)',
    use: '.addcourse Title | Link | Detail',
    category: 'courses',
    ownerOnly: true,
    react: '➕',
    filename: __filename
}, async (conn, mek, m, { q, reply }) => {
    const parts = String(q || '').split('|').map(s => s.trim());
    const title = parts[0];
    if (!title) {
        return reply(`❌ Format: ${P()}addcourse Title | Link | Detail\nLink aur Detail optional hain.\nMisal: ${P()}addcourse Web Development | https://example.com | Beginner se advanced`);
    }
    const link = parts[1] || '';
    const detail = parts.slice(2).join(' | ');
    const list = load();
    list.push({ title, link, detail, addedAt: Date.now() });
    try { save(list); } catch (e) { return reply(`⚠️ Save nahi hua: ${e.message}`); }
    return reply(`✅ Course add ho gaya (#${list.length}): *${title}*`);
});

cmd({
    pattern: 'delcourse',
    alias: ['removecourse', 'coursedel'],
    desc: 'Course delete karo (owner only)',
    use: '.delcourse <number>',
    category: 'courses',
    ownerOnly: true,
    react: '🗑️',
    filename: __filename
}, async (conn, mek, m, { q, reply }) => {
    const list = load();
    const n = parseInt(String(q || '').trim(), 10);
    if (!Number.isInteger(n) || n < 1 || n > list.length) {
        return reply(`❌ Number do: ${P()}delcourse <number>\n${P()}courses se number dekh lo.`);
    }
    const [gone] = list.splice(n - 1, 1);
    try { save(list); } catch (e) { return reply(`⚠️ Save nahi hua: ${e.message}`); }
    return reply(`🗑️ Delete ho gaya: *${gone.title}*`);
});
