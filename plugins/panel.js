// plugins/panel.js — ADMIN PANEL category (owner only + password)
// .login <password>  .logout  .panel  .cats  .addcat  .editcat  .delcat  .restorecat  .movecmd
// Courses (login ke baad): .pcourses  .paddcourse  .peditcourse  .pdelcourse   (data: data/courses.json, courses.js wali hi file)
// Password: Railway Variables me PANEL_PASSWORD set karo. Login 15 minute ke liye chalta hai.

const crypto = require('crypto');
const { cmd, findCommand, normalize } = require('../arslan');
const config = require('../config');
const cp = require('../lib/catpanel');

const P = () => config.PREFIX || '.';
const TTL = 15 * 60 * 1000;
const unlocked = new Map();      // senderNumber -> expiry
const fails = new Map();         // senderNumber -> { n, until }

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const panelPassword = () => String(process.env.PANEL_PASSWORD || config.PANEL_PASSWORD || '');

function isUnlocked(num) {
    const t = unlocked.get(num);
    if (t && t > Date.now()) return true;
    unlocked.delete(num);
    return false;
}

// Panel sirf is number par aur sirf DM me chalta hai (baaki jagah chup-chaap ignore)
const PANEL_NUMBER = () => String(process.env.PANEL_NUMBER || '923497081205').replace(/\D/g, '');
const allowedHere = (num, isGroup, botNumber) => !isGroup && [String(num), String(botNumber)].includes(PANEL_NUMBER());

// Har panel command se pehle: sahi number + DM + password login hona zaroori
async function guard(num, reply, isGroup, botNumber) {
    if (!allowedHere(num, isGroup, botNumber)) return false;
    if (!panelPassword()) { await reply(`🔐 Pehle Railway Variables me *PANEL_PASSWORD* set karo, phir ${P()}login <password>.`); return false; }
    if (!isUnlocked(num)) { await reply(`🔒 Panel locked hai. Pehle: ${P()}login <password>`); return false; }
    return true;
}

const refresh = () => cp.apply();
const cleanName = (s) => String(s || '').trim().toLowerCase().replace(/^\.+/, '');
const iconOf = (s) => String(s || '').trim().slice(0, 8);

async function buttonMessage(conn, from, mek, text, buttons, fallbackText) {
    const cm = require('./carousel-menu');
    // WhatsApp ek message me max 10 button
    for (let i = 0; i < buttons.length; i += 10) {
        const ok = await cm.sendButtons(conn, from, mek, i === 0 ? text : '👇', buttons.slice(i, i + 10));
        if (!ok) { await conn.sendMessage(from, { text: fallbackText || text }, { quoted: mek }); return; }
    }
}

const qr = (text, id) => require('./carousel-menu').quickReply(text, id);

// ---------------- login / logout ----------------
cmd({
    pattern: 'login', desc: 'Admin panel unlock (password)', use: '.login <password>',
    category: 'panel', ownerOnly: true, react: '🔐', filename: __filename
}, async (conn, mek, m, { from, q, senderNumber, isGroup, botNumber, reply }) => {
    if (!allowedHere(senderNumber, isGroup, botNumber)) return;
    if (!panelPassword()) return reply('🔐 Pehle Railway Variables me *PANEL_PASSWORD* set karo.');
    const f = fails.get(senderNumber) || { n: 0, until: 0 };
    if (f.until > Date.now()) return reply('⛔ Bohat galat koshishen. 10 minute baad dobara try karo.');
    const given = String(q || '').trim();
    // password wala message chat se hata do (apna message ho to)
    try { await conn.sendMessage(from, { delete: mek.key }); } catch (_) {}
    if (given && crypto.timingSafeEqual(sha(given), sha(panelPassword()))) {
        fails.delete(senderNumber);
        unlocked.set(senderNumber, Date.now() + TTL);
        return reply(`✅ Panel unlock (15 minute). ${P()}panel kholo.`);
    }
    f.n += 1;
    if (f.n >= 5) { f.until = Date.now() + 10 * 60 * 1000; f.n = 0; }
    fails.set(senderNumber, f);
    return reply('❌ Password galat.');
});

cmd({
    pattern: 'logout', desc: 'Admin panel lock karo', category: 'panel', ownerOnly: true, react: '🔒', filename: __filename
}, async (conn, mek, m, { senderNumber, isGroup, botNumber, reply }) => {
    if (!allowedHere(senderNumber, isGroup, botNumber)) return;
    unlocked.delete(senderNumber);
    return reply('🔒 Panel lock ho gaya.');
});

// ---------------- panel ----------------
cmd({
    pattern: 'panel', alias: ['adminpanel'], desc: 'Categories ka admin panel', category: 'panel', ownerOnly: true, react: '🛡️', filename: __filename
}, async (conn, mek, m, { from, senderNumber, isGroup, botNumber, reply }) => {
    if (!(await guard(senderNumber, reply, isGroup, botNumber))) return;
    const { list, deleted } = cp.info();
    const text = `🛡️ *ADMIN PANEL*\n\n📂 Categories: ${list.length}\n🗑️ Deleted: ${deleted.length}\n\nNeeche se chuno 👇`;
    const buttons = [
        qr('➕ Add Category', `${P()}addcat`), qr('✏️ Edit Category', `${P()}editcat`),
        qr('🗑️ Delete Category', `${P()}delcat`), qr('♻️ Restore', `${P()}restorecat`),
        qr('📋 List', `${P()}cats`),
        qr('🎓 Courses', `${P()}pcourses`), qr('➕ Add Course', `${P()}paddcourse`),
        qr('🔒 Logout', `${P()}logout`)
    ];
    return buttonMessage(conn, from, mek, text, buttons,
        `${text}\n\n${P()}addcat  ${P()}editcat  ${P()}delcat  ${P()}restorecat  ${P()}cats  ${P()}movecmd  ${P()}pcourses  ${P()}paddcourse  ${P()}peditcourse  ${P()}pdelcourse  ${P()}logout`);
});

// ---------------- list ----------------
cmd({
    pattern: 'cats', alias: ['categories2', 'catlist'], desc: 'Saari categories ki list', category: 'panel', ownerOnly: true, react: '📋', filename: __filename
}, async (conn, mek, m, { from, senderNumber, isGroup, botNumber, reply }) => {
    if (!(await guard(senderNumber, reply, isGroup, botNumber))) return;
    const { list, deleted } = cp.info();
    const icons = require('./carousel-menu').CATEGORY_ICONS || {};
    let t = `📋 *CATEGORIES* (${list.length})\n\n` + list.map((c, i) =>
        `${i + 1}. ${icons[c.name] || c.icon || '📌'} ${c.name} — ${c.count} cmd${c.custom ? ' (custom)' : ''}`).join('\n');
    if (deleted.length) t += `\n\n🗑️ *Deleted:*\n` + deleted.map(c => `• ${c.name} (${c.count} cmd) → ${P()}restorecat ${c.name}`).join('\n');
    return reply(t);
});

// ---------------- add ----------------
cmd({
    pattern: 'addcat', desc: 'Nayi category banao', use: '.addcat name | 🎓', category: 'panel', ownerOnly: true, react: '➕', filename: __filename
}, async (conn, mek, m, { q, senderNumber, isGroup, botNumber, reply }) => {
    if (!(await guard(senderNumber, reply, isGroup, botNumber))) return;
    const parts = String(q || '').split('|').map(s => s.trim());
    const name = cleanName(parts[0]);
    if (!name) return reply(`➕ Format: ${P()}addcat naam | icon\nMisal: ${P()}addcat movies | 🎬\n\nNaam 2-20 harf, bina space (a-z, 0-9, _ -).\nBanane ke baad commands is me daalne ke liye: ${P()}movecmd command | naam`);
    if (!cp.NAME_RE.test(name)) return reply('❌ Naam 2-20 harf ka ho, bina space (a-z, 0-9, _ -).');
    if (cp.nameTaken(name)) return reply(`❌ *${name}* naam pehle se hai.`);
    const d = cp.load();
    d.custom[name] = {};
    if (parts[1]) d.icons[name] = iconOf(parts[1]);
    cp.save(d); refresh();
    return reply(`✅ Category *${name}* ban gayi.\nMenu me tab dikhegi jab is me command ho: ${P()}movecmd command | ${name}`);
});

// ---------------- edit ----------------
cmd({
    pattern: 'editcat', desc: 'Category ka naam/icon badlo', use: '.editcat purana | naya | icon', category: 'panel', ownerOnly: true, react: '✏️', filename: __filename
}, async (conn, mek, m, { from, q, senderNumber, isGroup, botNumber, reply }) => {
    if (!(await guard(senderNumber, reply, isGroup, botNumber))) return;
    const parts = String(q || '').split('|').map(s => s.trim());
    const oldName = cleanName(parts[0]);
    if (!oldName) {
        const { list } = cp.info();
        return buttonMessage(conn, from, mek, '✏️ Kaun si category edit karni hai? 👇',
            list.filter(c => !cp.PROTECTED_NAMES.includes(c.name)).map(c => qr(c.name, `${P()}editcat ${c.name}`)),
            `✏️ Format: ${P()}editcat purana | naya | icon`);
    }
    const hit = cp.resolve(oldName);
    if (!hit) return reply(`❌ *${oldName}* naam ki category nahi mili. ${P()}cats dekho.`);
    if (cp.PROTECTED_NAMES.includes(hit.name)) return reply('🛡️ Panel category edit nahi ho sakti.');
    if (parts.length < 2) return reply(`✏️ *${hit.name}* edit karne ke liye bhejo:\n${P()}editcat ${hit.name} | naya_naam | icon\n(naam ya icon me se kuch khali chhod sakte ho)`);

    const newName = cleanName(parts[1]);
    const icon = iconOf(parts[2]);
    if (!newName && !icon) return reply('❌ Naya naam ya icon do.');
    const d = cp.load();
    let finalName = hit.name;
    if (newName && newName !== hit.name) {
        if (!cp.NAME_RE.test(newName)) return reply('❌ Naam 2-20 harf ka ho, bina space (a-z, 0-9, _ -).');
        if (cp.nameTaken(newName)) return reply(`❌ *${newName}* naam pehle se hai.`);
        if (hit.kind === 'base') d.renames[hit.base] = { name: newName };
        else { d.custom[newName] = d.custom[hit.name]; delete d.custom[hit.name]; }
        for (const k of Object.keys(d.moves)) if (d.moves[k] === hit.name) d.moves[k] = newName;
        if (d.icons[hit.name]) { d.icons[newName] = d.icons[hit.name]; delete d.icons[hit.name]; }
        finalName = newName;
    }
    if (icon) d.icons[finalName] = icon;
    cp.save(d); refresh();
    return reply(`✅ Ho gaya: *${hit.name}* → *${finalName}*${icon ? ` ${icon}` : ''}`);
});

// ---------------- delete ----------------
cmd({
    pattern: 'delcat', desc: 'Category delete karo (commands band)', use: '.delcat name', category: 'panel', ownerOnly: true, react: '🗑️', filename: __filename
}, async (conn, mek, m, { from, q, senderNumber, isGroup, botNumber, reply }) => {
    if (!(await guard(senderNumber, reply, isGroup, botNumber))) return;
    const parts = String(q || '').trim().split(/\s+/).filter(Boolean);
    const name = cleanName(parts[0]);
    const confirmed = ['yes', 'haan', 'confirm'].includes(String(parts[1] || '').toLowerCase());
    if (!name) {
        const { list } = cp.info();
        return buttonMessage(conn, from, mek, '🗑️ Kaun si category delete karni hai? 👇',
            list.filter(c => !cp.PROTECTED_NAMES.includes(c.name)).map(c => qr(`${c.name} (${c.count})`, `${P()}delcat ${c.name}`)),
            `🗑️ Format: ${P()}delcat naam`);
    }
    const hit = cp.resolve(name);
    if (!hit) return reply(`❌ *${name}* naam ki category nahi mili. ${P()}cats dekho.`);
    if (cp.PROTECTED_NAMES.includes(hit.name) || (hit.kind === 'base' && cp.protectedBases().has(hit.base))) {
        return reply('🛡️ Ye category delete nahi ho sakti (panel / menu isi par chalte hain).');
    }
    const count = cp.info().list.find(c => c.name === hit.name)?.count || 0;
    if (!confirmed) {
        return buttonMessage(conn, from, mek,
            `⚠️ *${hit.name}* delete karni hai?\n\n${hit.kind === 'custom' ? 'Is ke andar ki commands apni asli category me wapas chali jayengi.' : `Menu se hat jayegi aur is ki ${count} commands band ho jayengi.`}\nRestore: ${P()}restorecat ${hit.name}`,
            [qr('✅ Haan, delete', `${P()}delcat ${hit.name} yes`), qr('❌ Cancel', `${P()}panel`)],
            `⚠️ Confirm: ${P()}delcat ${hit.name} yes`);
    }
    const d = cp.load();
    for (const k of Object.keys(d.moves)) if (d.moves[k] === hit.name) delete d.moves[k];   // andar aayi commands ghar wapas
    if (hit.kind === 'custom') { delete d.custom[hit.name]; delete d.icons[hit.name]; }
    else if (!d.deleted.includes(hit.base)) d.deleted.push(hit.base);
    cp.save(d); refresh();
    return reply(`🗑️ *${hit.name}* delete ho gayi.${hit.kind === 'base' ? `\nWapas laane ke liye: ${P()}restorecat ${hit.name}` : ''}`);
});

// ---------------- restore ----------------
cmd({
    pattern: 'restorecat', desc: 'Delete hui category wapas lao', use: '.restorecat name', category: 'panel', ownerOnly: true, react: '♻️', filename: __filename
}, async (conn, mek, m, { from, q, senderNumber, isGroup, botNumber, reply }) => {
    if (!(await guard(senderNumber, reply, isGroup, botNumber))) return;
    const name = cleanName(q);
    const { d, deleted } = cp.info();
    if (!name) {
        if (!deleted.length) return reply('♻️ Koi deleted category nahi hai.');
        return buttonMessage(conn, from, mek, '♻️ Kaun si category wapas laani hai? 👇',
            deleted.map(c => qr(`${c.name} (${c.count})`, `${P()}restorecat ${c.name}`)), `♻️ Format: ${P()}restorecat naam`);
    }
    const hit = deleted.find(c => c.name === name);
    if (!hit) return reply(`❌ *${name}* deleted list me nahi hai.`);
    d.deleted = d.deleted.filter(b => b !== hit.base);
    cp.save(d); refresh();
    return reply(`♻️ *${hit.name}* wapas aa gayi (${hit.count} commands).`);
});

// ---------------- move command ----------------
cmd({
    pattern: 'movecmd', desc: 'Command ko doosri category me bhejo', use: '.movecmd command | category', category: 'panel', ownerOnly: true, react: '📦', filename: __filename
}, async (conn, mek, m, { q, senderNumber, isGroup, botNumber, reply }) => {
    if (!(await guard(senderNumber, reply, isGroup, botNumber))) return;
    const parts = String(q || '').split('|').map(s => s.trim());
    const cname = normalize(parts[0]);
    const target = cleanName(parts[1]);
    if (!cname || !target) return reply(`📦 Format: ${P()}movecmd command | category\nMisal: ${P()}movecmd song | music\n\nCategory pehle se honi chahiye (${P()}addcat / ${P()}cats).`);
    const c = findCommand(cname);
    if (!c || !c.pattern) return reply(`❌ *${cname}* command nahi mili.`);
    if (c.baseCategory === 'panel' || cp.PROTECTED_NAMES.includes(target)) return reply('🛡️ Panel ki commands move nahi hoti, aur is me kuch daala nahi ja sakta.');
    const hit = cp.resolve(target);
    if (!hit) return reply(`❌ *${target}* category nahi hai. Pehle ${P()}addcat ${target}`);
    const d = cp.load();
    const home = cp.dispName(d, c.baseCategory);
    if (hit.name === home) delete d.moves[c.pattern];     // ghar wapas
    else d.moves[c.pattern] = hit.name;
    cp.save(d); refresh();
    return reply(`✅ *${c.pattern}* ab *${hit.name}* category me hai.\nNote: owner/admin ki pabandi asli category ke hisaab se hi rehti hai.`);
});

// ---------------- courses (panel login ke baad) ----------------
// Wahi file jo plugins/courses.js use karta hai (COURSES_FILE env ya data/courses.json),
// isliye yahan add kiya hua course `.courses` me foran dikhta hai.
const fs = require('fs');
const path = require('path');
const COURSES_FILE = process.env.COURSES_FILE || path.join(__dirname, '..', 'data', 'courses.json');
function loadCourses() {
    try { const d = JSON.parse(fs.readFileSync(COURSES_FILE, 'utf8')); return Array.isArray(d) ? d : []; } catch (_) { return []; }
}
function saveCourses(list) {
    fs.mkdirSync(path.dirname(COURSES_FILE), { recursive: true });
    fs.writeFileSync(COURSES_FILE, JSON.stringify(list, null, 2));
}
const courseRows = (list) => list.map((c, i) =>
    `*${i + 1}.* ${c.title}${c.link ? `\n   🔗 ${c.link}` : ''}${c.detail ? `\n   📝 ${c.detail}` : ''}`).join('\n\n');

cmd({
    pattern: 'pcourses', alias: ['panelcourses'], desc: 'Panel: extra courses ki list', category: 'panel', ownerOnly: true, react: '🎓', filename: __filename
}, async (conn, mek, m, { from, senderNumber, isGroup, botNumber, reply }) => {
    if (!(await guard(senderNumber, reply, isGroup, botNumber))) return;
    const list = loadCourses();
    const head = `🎓 *COURSES* (${list.length})\n\n`;
    const text = list.length
        ? head + courseRows(list)
        : head + 'Abhi koi extra course nahi hai.';
    const help = `\n\n➕ ${P()}paddcourse Title | Link | Detail\n✏️ ${P()}peditcourse number | Title | Link | Detail\n🗑️ ${P()}pdelcourse number`;
    return buttonMessage(conn, from, mek, text + help, [
        qr('➕ Add Course', `${P()}paddcourse`), qr('🛡️ Panel', `${P()}panel`)
    ], text + help);
});

cmd({
    pattern: 'paddcourse', alias: ['paddcrs'], desc: 'Panel: naya course add karo', use: '.paddcourse Title | Link | Detail', category: 'panel', ownerOnly: true, react: '➕', filename: __filename
}, async (conn, mek, m, { q, senderNumber, isGroup, botNumber, reply }) => {
    if (!(await guard(senderNumber, reply, isGroup, botNumber))) return;
    const parts = String(q || '').split('|').map(s => s.trim());
    const title = parts[0];
    if (!title) return reply(`➕ Format: ${P()}paddcourse Title | Link | Detail\nLink aur Detail optional hain.\nMisal: ${P()}paddcourse Web Development | https://example.com | Beginner se advanced`);
    const link = parts[1] || '';
    if (link && !/^https?:\/\//i.test(link)) return reply('❌ Link http:// ya https:// se shuru hona chahiye.');
    const detail = parts.slice(2).join(' | ');
    const list = loadCourses();
    list.push({ title, link, detail, addedAt: Date.now() });
    try { saveCourses(list); } catch (e) { return reply(`⚠️ Save nahi hua: ${e.message}`); }
    return reply(`✅ Course add ho gaya (#${list.length}): *${title}*\n${P()}courses se dekh lo.`);
});

cmd({
    pattern: 'peditcourse', alias: ['peditcrs'], desc: 'Panel: course badlo', use: '.peditcourse number | Title | Link | Detail', category: 'panel', ownerOnly: true, react: '✏️', filename: __filename
}, async (conn, mek, m, { q, senderNumber, isGroup, botNumber, reply }) => {
    if (!(await guard(senderNumber, reply, isGroup, botNumber))) return;
    const parts = String(q || '').split('|').map(s => s.trim());
    const list = loadCourses();
    const n = parseInt(parts[0], 10);
    if (!Number.isInteger(n) || n < 1 || n > list.length) return reply(`✏️ Format: ${P()}peditcourse number | Title | Link | Detail\nKhali chhodo to purani value rehti hai (misal: ${P()}peditcourse 2 | | https://naya-link.com).\nNumber ${P()}pcourses se dekho.`);
    const c = list[n - 1];
    if (parts[1]) c.title = parts[1];
    if (parts[2]) {
        if (!/^https?:\/\//i.test(parts[2])) return reply('❌ Link http:// ya https:// se shuru hona chahiye.');
        c.link = parts[2];
    }
    if (parts.length > 3 && parts.slice(3).join(' | ')) c.detail = parts.slice(3).join(' | ');
    try { saveCourses(list); } catch (e) { return reply(`⚠️ Save nahi hua: ${e.message}`); }
    return reply(`✅ Course #${n} update ho gaya: *${c.title}*`);
});

cmd({
    pattern: 'pdelcourse', alias: ['pdelcrs'], desc: 'Panel: course delete karo', use: '.pdelcourse number', category: 'panel', ownerOnly: true, react: '🗑️', filename: __filename
}, async (conn, mek, m, { q, senderNumber, isGroup, botNumber, reply }) => {
    if (!(await guard(senderNumber, reply, isGroup, botNumber))) return;
    const list = loadCourses();
    const n = parseInt(String(q || '').trim(), 10);
    if (!Number.isInteger(n) || n < 1 || n > list.length) return reply(`🗑️ Format: ${P()}pdelcourse number\nNumber ${P()}pcourses se dekho.`);
    const [gone] = list.splice(n - 1, 1);
    try { saveCourses(list); } catch (e) { return reply(`⚠️ Save nahi hua: ${e.message}`); }
    return reply(`🗑️ Delete ho gaya: *${gone.title}*`);
});
