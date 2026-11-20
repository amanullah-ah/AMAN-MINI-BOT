// plugins/carousel-menu.js
// Swipe-able carousel menu (cards) with tappable command buttons + pagination.
//   .cmenu          -> page 1 (info card + category cards)
//   .cmenu 2        -> page 2 ...
// Agar fail ho jaye to khud-ba-khud normal text menu bhej deta hai.

const fs = require('fs');
const path = require('path');
const { cmd, commands } = require('../arslan');
const config = require('../config');
const { getBotPic, getMenuPic } = require('../lib/botpic');

// ---------- settings (yahan se badlein) ----------
const MAX_CARD_CHARS = 2800;     // ek slide (category) me itne harf se zyada ho to hi 2 slides me todo (warna sari commands ek slide me)
const MAX_CMDS_PER_CARD = 30;    // ek card me max itni commands; zyada hon to category 2/3 cards me bat jati hai
const CARDS_PER_PAGE = 8;       // ek page par command cards (WhatsApp max 10 cards: info + nav ke liye jagah)
const CATEGORY_ICONS = {
    main: '🏠', general: '🏠', settings: '⚙️', pair: '🔗', channel: '📢', sticker: '🏷️',
    owner: '👑', group: '👥', download: '📥', music: '🎵', anime: '🎌', fun: '🎮',
    games: '🎲', love: '💞', emotions: '😊', islamic: '🕌', tools: '🧰', utility: '🛠️',
    image: '🖼️', system: '💻', search: '🔎', misc: '📦', personal: '👤', extra: '✨', aman: '👑', courses: '🎓', panel: '🛡️', ai: '🤖', videoediting: '🎬', audio: '🎧'
};
// Saare menus me ek hi category order: pehle bot basics, phir group/download/tools, fun/islamic, aakhir me owner/settings/system
const CATEGORY_ORDER = ['main', 'aman', 'general', 'group', 'download', 'music', 'audio', 'ai', 'videoediting', 'tools', 'utility', 'image', 'sticker', 'search',
    'fun', 'games', 'anime', 'love', 'emotions', 'islamic', 'courses', 'extra', 'panel', 'owner', 'settings', 'system'];
// -------------------------------------------------

// menu me dikhne wala naam (key se alag ho to)
const CATEGORY_LABELS = { videoediting: 'video editing' };
const catLabel = (c) => CATEGORY_LABELS[c] || c;

const PREFIX = () => config.PREFIX || '.';
const botName = () => String(config.BOT_NAME || 'AMAN-MD').trim();

function uptimeText() {
    let s = Math.floor(process.uptime());
    const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    s = s % 60;
    return `${d ? d + 'd ' : ''}${h}h ${m}m ${s}s`;
}

// Saari visible commands ko category ke hisaab se group karo
function groupCommands() {
    const grouped = {};
    const seen = new Set();
    let total = 0;
    for (const c of commands) {
        if (!c.pattern || c.dontAddCommandList) continue;
        let cat = String(c.category || 'misc').toLowerCase();
        if (cat === 'downloader') cat = 'download';
        const key = cat + ':' + c.pattern;
        if (seen.has(key)) continue;
        seen.add(key);
        total++;
        (grouped[cat] = grouped[cat] || []).push(c.pattern);
    }
    const cats = [...CATEGORY_ORDER.filter(c => grouped[c]),
        ...Object.keys(grouped).filter(c => !CATEGORY_ORDER.includes(c)).sort()];
    return { grouped, cats, total };
}

// Har category ka ek card (slide): us ki sari commands
function buildCategoryCards(onlyCat) {
    const { grouped, cats: allCats, total } = groupCommands();
    const cats = onlyCat ? allCats.filter(c => c === onlyCat) : allCats;
    const p = PREFIX();
    const cards = [];
    for (const cat of cats) {
        const list = grouped[cat].slice().sort();
        // Har category ek slide: us ki SARI commands. Sirf bahut hi lambi category (WhatsApp ki limit) 2+ slides me tootti hai.
        const lineLen = list.reduce((n, x) => n + x.length + 9, 0);   // '┋├┈⌖ ' + naam + newline
        const parts = Math.max(1, Math.ceil(lineLen / MAX_CARD_CHARS), Math.ceil(list.length / MAX_CMDS_PER_CARD));
        const per = Math.ceil(list.length / parts);
        for (let i = 0; i < parts; i++) {
            cards.push({
                cat,
                count: list.length,
                part: i + 1, parts,
                title: `${CATEGORY_ICONS[cat] || '📌'} ${catLabel(cat).toUpperCase()}${parts > 1 ? ` · ${i + 1}/${parts}` : ''}`,
                commands: list.slice(i * per, (i + 1) * per)
            });
        }
    }
    return { cards, total };
}


// Native-flow buttons dikhane ke liye WhatsApp ko "biz" node chahiye (private aur group dono mein)
function relayInteractive(conn, jid, msg) {
    return conn.relayMessage(jid, msg.message, {
        messageId: msg.key.id,
        additionalNodes: [{
            tag: 'biz', attrs: {},
            content: [{ tag: 'interactive', attrs: { type: 'native_flow', v: '1' },
                content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }] }]
        }]
    });
}

// Agar group mein carousel na dikhe to env CAROUSEL_IN_GROUPS=false karo: group mein purana text menu chalega
const blockedInGroup = (jid) => String(jid).endsWith('@g.us') && String(process.env.CAROUSEL_IN_GROUPS || 'true').toLowerCase() === 'false';

// Header photo ek baar upload hoti hai, phir 20 minute cache (har menu par dobara upload slow tha)
const MEDIA_TTL_MS = 20 * 60 * 1000;
const UPLOAD_TIMEOUT_MS = 4000;
const mediaCache = new Map();
function getHeaderMedia(conn, prepareWAMessageMedia, timeoutMs) {
    const menuPic = getMenuPic(conn);
    const pic = menuPic.pic || {};
    let mtime = 0;
    try { if (pic.url && !/^https?:/i.test(pic.url)) mtime = fs.statSync(pic.url).mtimeMs; } catch (_) {}
    const key = `${String((conn.user && conn.user.id) || '').split(':')[0]}|${menuPic.key}|${mtime}`;
    const hit = mediaCache.get(key);
    if (hit && Date.now() - hit.at < MEDIA_TTL_MS) return hit.promise;
    const upload = Promise.race([
        prepareWAMessageMedia({ image: pic }, { upload: conn.waUploadToServer }).then(r => r.imageMessage),
        new Promise((_, rej) => setTimeout(() => rej(new Error('image upload timeout')), timeoutMs || UPLOAD_TIMEOUT_MS))
    ]);
    const entry = { at: Date.now(), promise: upload };
    mediaCache.set(key, entry);
    upload.catch(() => { if (mediaCache.get(key) === entry) mediaCache.delete(key); });   // fail ho to dobara try hoga
    if (mediaCache.size > 20) mediaCache.delete(mediaCache.keys().next().value);
    return upload;
}

// CONNECTED message ke liye video header (config.CONNECT_VIDEO ya assets/connect.mp4). Na mile to image chalegi.
function connectVideoSource() {
    const v = String(config.CONNECT_VIDEO || '').trim();
    if (v) return /^https?:/i.test(v) ? { url: v } : (fs.existsSync(v) ? { url: path.resolve(v) } : null);
    const local = path.join(__dirname, '..', 'assets', 'connect.mp4');
    return fs.existsSync(local) ? { url: local } : null;
}

const quickReply = (text, id) => ({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: text, id }) });
const urlButton = (text, url) => ({ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: text, url, merchant_url: url }) });
const pairUrl = () => process.env.PAIR_URL || config.PAIR_URL || 'https://aman-md46.vercel.app';
const pairButton = () => urlButton('🔗 Pair', pairUrl());

// Owner number hamesha international format mein: 03497081205 -> 923497081205
function ownerNumberIntl() {
    const n = String((config.OWNER_NUMBERS && config.OWNER_NUMBERS[0]) || config.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
    if (!n) return null;
    return n.startsWith('0') ? '92' + n.slice(1) : n;
}

// Chat Owner dabane par ye message pehle se likha hua khulega (user bas send dabaye)
const OWNER_GREETING = '𝐇𝐢 𝐀𝐌𝐀𝐍 𝐒𝐢𝐫 👋✨\n𝐈 𝐜𝐨𝐧𝐭𝐚𝐜𝐭𝐞𝐝 𝐲𝐨𝐮 𝐟𝐫𝐨𝐦 𝐲𝐨𝐮𝐫 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩 𝐁𝐨𝐭 🤖';

function ownerLink(withText) {
    const n = ownerNumberIntl();
    if (!n) return null;
    return 'https://wa.me/' + n + (withText ? '?text=' + encodeURIComponent(OWNER_GREETING) : '');
}

// WhatsApp contact card: sahi waid ki wajah se "Invite" ki jagah "Message" button aata hai
async function sendOwnerContact(conn, jid, quoted) {
    try {
        const n = ownerNumberIntl();
        if (!n) return false;
        const name = String(config.OWNER_NAME || 'Owner');
        const vcard = [
            'BEGIN:VCARD', 'VERSION:3.0',
            `N:;${name};;;`,
            `FN:${name}`,
            `ORG:${botName()};`,
            `TEL;type=CELL;type=VOICE;waid=${n}:+${n}`,
            'END:VCARD'
        ].join('\n');
        await conn.sendMessage(jid, { contacts: { displayName: name, contacts: [{ vcard }] } }, { quoted });
        return true;
    } catch (e) {
        console.error('owner contact error:', e && e.message);
        return false;
    }
}

function footerText() { return `Powered By ${botName()}`; }

// Plain-text fallback (agar carousel na chale)
function textMenu(page, pageCards, total, totalPages) {
    const p = PREFIX();
    let t = `*${botName()}*\n👑 Owner: ${config.OWNER_NAME || '-'}\n⚡ Prefix: ${p}\n📦 Commands: ${total}\n⏱️ Uptime: ${uptimeText()}\n\n`;
    for (const c of pageCards) t += `*${c.title}*\n${c.commands.map(x => `➤ ${p}${x}`).join('\n')}\n\n`;
    if (totalPages > 1) t += `📄 Page ${page}/${totalPages} — next: ${p}cmenu ${page % totalPages + 1}`;
    return t.trim();
}

async function buildCarousel(conn, page, pageCards, total, totalPages, baileys, catFilter) {
    const { proto, prepareWAMessageMedia } = baileys;
    const IM = proto.Message.InteractiveMessage;
    const p = PREFIX();

    // Header image ek baar upload karke sab cards mein use hoti hai
    let media = null;
    try { media = { imageMessage: await getHeaderMedia(conn, prepareWAMessageMedia) }; } catch (_) { /* image ke bina bhi chalega */ }

    const header = () => IM.Header.fromObject({ title: '', subtitle: '', hasMediaAttachment: !!media, ...(media || {}) });
    const makeCard = (body, buttons) => ({
        header: header(),
        body: IM.Body.fromObject({ text: body }),
        footer: IM.Footer.fromObject({ text: footerText() }),
        nativeFlowMessage: IM.NativeFlowMessage.fromObject({ buttons })
    });

    const cards = [];

    // 1) Info card (sirf page 1 par)
    if (page === 1 && !catFilter) {
        const owner = ownerLink(true);
        // Card ki khali jagah bharne ke liye: saari categories ka overview (icon + naam + commands ki ginti)
        const { grouped, cats: allCats } = groupCommands();
        const overview = allCats.slice(0, 30)
            .map(c => `${CATEGORY_ICONS[c] || '📌'} ${catLabel(c).toUpperCase()} — ${grouped[c].length}`)
            .join('\n');
        const line = '------------------------------';
        const info =
            `《 💎 ${botName()} 》\n` +
            `${line}\n` +
            `👑 Owner   : ${config.OWNER_NAME || '-'}\n` +
            `⚡ Prefix  : ${p}\n` +
            `📦 Commands: ${total}\n` +
            `⏱️ Uptime  : ${uptimeText()}\n` +
            `🕒 Time    : ${new Date().toLocaleTimeString('en-US', { timeZone: config.TIME_ZONE || 'Asia/Karachi' })}\n` +
            `${line}\n` +
            `📂 *CATEGORIES*\n${overview}\n` +
            `${line}\n` +
            `➡️ Swipe for commands ⬅️`;
        const btns = [quickReply('👑 Owner', p + 'owner')];
        if (owner) btns.push(urlButton('💬 Chat Owner', owner));
        btns.push(quickReply('🏓 Ping', p + 'ping'));
        cards.push(makeCard(info, btns));
    }

    // 2) Category cards: har category ek slide, us ki sari commands + ek Open button
    for (const c of pageCards) {
        const body = categoryBoxes(c.cat, c.commands, c.parts > 1 ? `${c.part}/${c.parts}` : '').join('\n');
        cards.push(makeCard(body, [quickReply(`📂 Open ${catLabel(c.cat).toUpperCase()}`, `${p}menu ${c.cat}`)]));
    }

    // 3) Navigation card
    if (totalPages > 1) {
        const next = page % totalPages + 1;
        const body = page < totalPages
            ? `《 📝 MORE 》\n\nPage ${page}/${totalPages}\n➡️ Continue to the next page`
            : `《 ✅ END 》\n\nPage ${page}/${totalPages}\nSab commands dikha di gayi hain.`;
        const btns = [];
        const nav = catFilter ? `${p}menu ${catFilter} ` : `${p}menu `;
        if (page < totalPages) btns.push(quickReply('➡️ Next Page', nav + next));
        btns.push(quickReply('🏠 First Page', nav + '1'));
        if (catFilter) btns.push(quickReply('📂 All Categories', `${p}menu list`));
        cards.push(makeCard(body, btns));
    }

    return IM.create({
        body: IM.Body.create({ text: `*${botName()}* — Page ${page}/${totalPages}` }),
        footer: IM.Footer.create({ text: footerText() }),
        carouselMessage: IM.CarouselMessage.fromObject({ cards, messageVersion: 1 })
    });
}

// Carousel bhejta hai. Success par true, fail par false (throw nahi karta).
// ---------- CATEGORY VIEW: commands sirf text me, neeche 4 link buttons (links yahan se badlein) ----------
const CATEGORY_LINK_BUTTONS = [
    { button: '🌐 PORTFOLIO',        url: 'https://amanullah5911.vercel.app' },
    { button: '🧰 TOOLKIT',          url: 'https://google.com/search?q=aman-tools46' },
    { button: '▶️ YOUTUBE CHANNEL',  url: 'https://youtube.com/@amantechzone5911' },
    { button: '📢 VIEW CHANNEL',     url: 'https://whatsapp.com/channel/0029Vb8Hsxs72WU1Dx57eu1q' }
];

// ---------- CATEGORY LIST STYLE ----------
//  ╭━═❲ 𝐈𝐌𝐀𝐆𝐄
//  ┣┬⟡ 𝙱ʟᴜʀ
//  ┋├⟡ 𝙼ᴇᴍᴇᴍᴀᴋᴇʀ <ᴛᴇxᴛ>
//  ┋╰⟡ 𝚆ᴀᴛᴇʀᴍᴀʀᴋ <ᴛᴇxᴛ>
//  ╰┉┉┉┉┉┉┉┉┉┉┉┉┉┉┉┉❥
const SMALLCAPS = { a:'ᴀ', b:'ʙ', c:'ᴄ', d:'ᴅ', e:'ᴇ', f:'ꜰ', g:'ɢ', h:'ʜ', i:'ɪ', j:'ᴊ', k:'ᴋ', l:'ʟ', m:'ᴍ', n:'ɴ', o:'ᴏ', p:'ᴘ', q:'ǫ', r:'ʀ', s:'s', t:'ᴛ', u:'ᴜ', v:'ᴠ', w:'ᴡ', x:'x', y:'ʏ', z:'ᴢ' };
const smallCaps = (t) => [...String(t).toLowerCase()].map(ch => SMALLCAPS[ch] || ch).join('');
const boldText = (t) => [...String(t).toUpperCase()].map(ch => {
    if (ch >= 'A' && ch <= 'Z') return String.fromCodePoint(0x1D400 + ch.charCodeAt(0) - 65);
    if (ch >= '0' && ch <= '9') return String.fromCodePoint(0x1D7CE + ch.charCodeAt(0) - 48);
    return ch;
}).join('');
function styleCmdName(name) {
    const chars = [...String(name)];
    const f = chars[0].toLowerCase();
    const first = (f >= 'a' && f <= 'z') ? String.fromCodePoint(0x1D670 + f.charCodeAt(0) - 97) : chars[0];
    return first + smallCaps(chars.slice(1).join(''));
}
function categoryBoxes(cat, names, label) {
    // jin commands ki `use` me <...> hai unka hint saath dikhao (jaise Ai <question>)
    const hints = {};
    for (const c of commands) {
        if (!c.pattern || !c.use) continue;
        const m = String(c.use).match(/<[^<>]+>/g);
        // ek se zyada <...> wali lambi commands (jaise <top text> <bottom text>) ek hi chhota <text> dikhayein
        if (m) hints[c.pattern] = m.length > 1 ? '<text>' : m[0];
    }
    const rows = names.map(n => styleCmdName(n) + (hints[n] ? ' ' + smallCaps(hints[n]) : ''));
    const MAX = 3000, groups = [];
    let cur = [], len = 0;
    for (const r of rows) {
        if (cur.length && len + r.length + 8 > MAX) { groups.push(cur); cur = []; len = 0; }
        cur.push(r); len += r.length + 8;
    }
    groups.push(cur);
    return groups.map((g, gi) => {
        const title = boldText(catLabel(cat)) + (label ? ` · ${label}` : (groups.length > 1 ? ` · ${gi + 1}/${groups.length}` : ''));
        const last = g.length - 1;
        const lines = g.map((r, i) => {
            const mark = g.length === 1 ? '┣╰⟡' : i === 0 ? '┣┬⟡' : i === last ? '┋╰⟡' : '┋├⟡';
            return `${mark} ${r}`;
        });
        return `╭━═❲ ${title}\n${lines.join('\n')}\n╰${'┉'.repeat(16)}❥`;
    });
}

async function sendCategoryView(conn, mek, from, cat) {
    const baileys = require('@whiskeysockets/baileys');
    const { proto, prepareWAMessageMedia, generateWAMessageFromContent } = baileys;
    const IM = proto.Message.InteractiveMessage;
    const p = PREFIX();
    const { grouped } = groupCommands();
    if (!grouped[cat]) return false;
    const list = grouped[cat].slice().sort((a, b) => a.localeCompare(b));
    // lambi category ho to kai hisson me; aakhri hissa image + buttons ke saath
    const boxes = categoryBoxes(cat, list);
    for (let i = 0; i < boxes.length - 1; i++) {
        await conn.sendMessage(from, { text: boxes[i] }, { quoted: mek });
    }
    const body = boxes[boxes.length - 1];

    let header = IM.Header.fromObject({ title: '', subtitle: '', hasMediaAttachment: false });
    try {
        const imageMessage = await getHeaderMedia(conn, prepareWAMessageMedia);
        header = IM.Header.fromObject({ title: '', subtitle: '', hasMediaAttachment: true, imageMessage });
    } catch (_) { /* image ke bina bhi chalega */ }

    const interactive = IM.create({
        header,
        body: IM.Body.create({ text: body }),
        footer: IM.Footer.create({ text: footerText() }),
        nativeFlowMessage: IM.NativeFlowMessage.fromObject({ buttons: [pairButton(), ...CATEGORY_LINK_BUTTONS.map(b => urlButton(b.button, b.url))] })
    });
    const msg = generateWAMessageFromContent(from, {
        viewOnceMessage: { message: { messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 }, interactiveMessage: interactive } }
    }, { quoted: mek, userJid: conn.user && conn.user.id });
    await relayInteractive(conn, from, msg);
    return true;
}

async function sendCarouselMenu(conn, mek, m, ctx, pageArg, catFilter) {
    const from = (ctx && ctx.from) || m.chat;
    if (blockedInGroup(from)) return false;
    // Category par tap/type: commands text me + 4 link buttons (carousel nahi)
    if (catFilter) {
        try { if (await sendCategoryView(conn, mek, from, catFilter)) return true; }
        catch (e) { console.error('category view error:', e && e.message); }
    }
    const { cards, total } = buildCategoryCards(catFilter);
    const totalPages = Math.max(1, Math.ceil(cards.length / CARDS_PER_PAGE));
    let page = parseInt(pageArg, 10);
    if (!Number.isFinite(page) || page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    const pageCards = cards.slice((page - 1) * CARDS_PER_PAGE, page * CARDS_PER_PAGE);
    try {
        const baileys = require('@whiskeysockets/baileys');
        const interactive = await buildCarousel(conn, page, pageCards, total, totalPages, baileys, catFilter);
        const msg = baileys.generateWAMessageFromContent(from, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                    interactiveMessage: interactive
                }
            }
        }, { quoted: mek, userJid: conn.user && conn.user.id });
        await relayInteractive(conn, from, msg);
        return true;
    } catch (e) {
        console.error('carousel menu error:', e && e.message);
        sendCarouselMenu.lastFallback = textMenu(page, pageCards, total, totalPages);
        return false;
    }
}

// ---------- OWNER CARD (links yahan se badlein) ----------
const OWNER_LINKS = [
    { name: 'YOUTUBE',        button: '▶️ YouTube',         url: 'https://www.youtube.com/@amantechzone5911' },
    { name: 'TELEGRAM',       button: '✈️ Telegram',        url: 'https://t.me/amaantechzone' },
    { name: 'TIKTOK',         button: '🎵 TikTok',          url: 'https://www.tiktok.com/@amanullah.736' },
    { name: 'AMAN TOOLKIT',   button: '🧰 Aman Toolkit',    url: 'https://www.google.com/search?q=aman-tools46' },
    { name: 'AMAN PORTFOLIO', button: '🌐 Aman Portfolio',  url: 'https://amanullah5911.vercel.app' }
];

// Body text mein links bhi hain (WhatsApp unhe khud tappable bana deta hai), buttons alag se
function ownerCardText() {
    const link = ownerLink();
    let t = `👑 *OWNER — ${config.OWNER_NAME || 'Owner'}*\n━━━━━━━━━━━━━━━━━━\n`;
    if (link) t += `💬 *WHATSAPP*\n+${ownerNumberIntl()}\n${link}\n\n`;
    t += OWNER_LINKS.map(l => `*${l.name}*\n${l.url}`).join('\n\n');
    t += `\n━━━━━━━━━━━━━━━━━━\n${footerText()}`;
    return t;
}

async function sendOwnerCard(conn, jid, quoted) {
    if (blockedInGroup(jid)) return false;
    try {
        const baileys = require('@whiskeysockets/baileys');
        const { proto, prepareWAMessageMedia, generateWAMessageFromContent } = baileys;
        const IM = proto.Message.InteractiveMessage;
        const buttons = [];
        const link = ownerLink(true);
        if (link) buttons.push(urlButton('💬 Chat Owner', link));
        for (const l of OWNER_LINKS) buttons.push(urlButton(l.button, l.url));

        // Connect message par image zaroor chahiye: fresh login par upload slow hota hai,
        // isliye lamba timeout (25s) aur 3 koshishein. Normal menu me purana 4s timeout.
        let header = IM.Header.fromObject({ title: '', subtitle: '', hasMediaAttachment: false });
        const tries = (opts && opts.connectMode) ? 3 : 1;
        // Connect message par pehle video (agar set ho), na ho ya fail ho to image
        let gotVideo = false;
        const vsrc = (opts && opts.connectMode) ? connectVideoSource() : null;
        if (vsrc) {
            for (let t = 1; t <= 2 && !gotVideo; t++) {
                try {
                    const up = await Promise.race([
                        prepareWAMessageMedia({ video: vsrc, mimetype: 'video/mp4' }, { upload: conn.waUploadToServer }),
                        new Promise((_, rej) => setTimeout(() => rej(new Error('video upload timeout')), 90000))
                    ]);
                    header = IM.Header.fromObject({ title: '', subtitle: '', hasMediaAttachment: true, videoMessage: up.videoMessage });
                    gotVideo = true;
                } catch (e) {
                    console.warn(`[CONNECT-VIDEO] attempt ${t}/2 failed:`, e && e.message);
                }
            }
        }
        for (let t = 1; t <= tries && !gotVideo; t++) {
            try {
                const imageMessage = await getHeaderMedia(conn, prepareWAMessageMedia, (opts && opts.connectMode) ? 25000 : undefined);
                header = IM.Header.fromObject({ title: '', subtitle: '', hasMediaAttachment: true, imageMessage });
                break;
            } catch (e) {
                console.warn(`[CONNECT-IMG] image upload attempt ${t}/${tries} failed:`, e && e.message);
                if (t < tries) await new Promise(r => setTimeout(r, 1500));
            }
        }

        const interactive = IM.create({
            header,
            body: IM.Body.create({ text: ownerCardText() }),
            footer: IM.Footer.create({ text: footerText() }),
            nativeFlowMessage: IM.NativeFlowMessage.fromObject({ buttons })
        });
        const msg = generateWAMessageFromContent(jid, {
            viewOnceMessage: { message: { messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 }, interactiveMessage: interactive } }
        }, { quoted, userJid: conn.user && conn.user.id });
        await relayInteractive(conn, jid, msg);
        return true;
    } catch (e) {
        console.error('owner card error:', e && e.message);
        return false;
    }
}

// Saari categories ek tappable list mein (connect message ke neeche aur ".menu list" par)
async function sendCategoryPicker(conn, jid, quoted, bodyText, opts) {
    if (blockedInGroup(jid)) return false;
    try {
        const baileys = require('@whiskeysockets/baileys');
        const { proto, prepareWAMessageMedia, generateWAMessageFromContent } = baileys;
        const IM = proto.Message.InteractiveMessage;
        const p = PREFIX();
        const { grouped, cats, total } = groupCommands();
        const channelLink = config.CHANNEL_LINK || (config.AUTO_FOLLOW_CHANNELS && config.AUTO_FOLLOW_CHANNELS[0]) || '';

        let header = IM.Header.fromObject({ title: '', subtitle: '', hasMediaAttachment: false });
        // Connect message par photo zaroori hai: 4s timeout kam padta tha (naya session + remote image), isliye 20s x 2 try
        const isConnect = !!(opts && opts.connectMode);
        let gotImage = false;
        for (let a = 1; a <= (isConnect ? 2 : 1) && !gotImage; a++) {
            try {
                const imageMessage = await getHeaderMedia(conn, prepareWAMessageMedia, isConnect ? 20000 : undefined);
                header = IM.Header.fromObject({ title: '', subtitle: '', hasMediaAttachment: true, imageMessage });
                gotImage = true;
            } catch (e) { if (isConnect) console.error(`connect image upload attempt ${a} failed:`, e && e.message); }
        }
        // Photo na upload ho to connect message yahan se na bhejo -> main.js photo + caption wala message bhejega
        if (isConnect && !gotImage) return false;

        const send = async (body, buttons, withHeader) => {
            const interactive = IM.create({
                header: withHeader ? header : IM.Header.fromObject({ title: '', subtitle: '', hasMediaAttachment: false }),
                body: IM.Body.create({ text: body }),
                footer: IM.Footer.create({ text: (opts && opts.footer) || footerText() }),
                nativeFlowMessage: IM.NativeFlowMessage.fromObject({ buttons })
            });
            const msg = generateWAMessageFromContent(jid, {
                viewOnceMessage: { message: { messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 }, interactiveMessage: interactive } }
            }, { quoted, userJid: conn.user && conn.user.id });
            await relayInteractive(conn, jid, msg);
        };

        // Connect message: 3 button — Pair + Categories + View Channel
        if (opts && opts.connectMode) {
            const buttons = [pairButton(), quickReply('📂 Categories', p + 'menu list')];
            if (channelLink) buttons.push(urlButton('📢 View Channel', channelLink));
            await send(bodyText || `*${botName()}*\n📂 Categories (${cats.length}) · ${total} commands`, buttons, true);
            return true;
        }

        // Categories: har category ek tappable button (ek message mein max 10 button)
        const PER_MSG = 10;
        const catButtons = cats.map(c => quickReply(`${CATEGORY_ICONS[c] || '📌'} ${catLabel(c).toUpperCase()} (${grouped[c].length})`, `${p}menu ${c}`));
        const chunks = [];
        // pehle message me Pair button + 9 categories (max 10 button), baaki me 10-10
        const firstCats = catButtons.splice(0, PER_MSG - 1);
        chunks.push([pairButton(), ...firstCats]);
        for (let i = 0; i < catButtons.length; i += PER_MSG) chunks.push(catButtons.slice(i, i + PER_MSG));
        for (let i = 0; i < chunks.length; i++) {
            const body = i === 0
                ? (bodyText || `*${botName()}*\n📂 Categories (${cats.length}) · ${total} commands\nKisi bhi category par tap karo 👇`)
                : `📂 Categories (${i + 1}/${chunks.length}) 👇`;
            await send(body, chunks[i], i === 0);
        }
        return true;
    } catch (e) {
        console.error('category picker error:', e && e.message);
        return false;
    }
}

// Menu voice: lib/menuvoice.js (mp3 -> ogg/opus convert karke bhejta hai)
const { sendMenuVoice: _sendMenuVoice } = require('../lib/menuvoice');
function sendMenuVoice(conn, from, quoted) { _sendMenuVoice(conn, from, quoted); }

cmd({
    pattern: 'cmenu',
    alias: ['swipemenu', 'cardmenu', 'cmenu1'],
    use: '.cmenu  |  .cmenu <page>',
    desc: 'Swipe-able card menu with tappable buttons',
    category: 'system',
    react: '📜',
    filename: __filename
}, async (conn, mek, m, ctx) => {
    const from = ctx.from || m.chat;
    const arg = (ctx.args && ctx.args[0]) || (ctx.q || '').trim();
    const ok = await sendCarouselMenu(conn, mek, m, ctx, arg);
    if (!ok) await conn.sendMessage(from, { text: sendCarouselMenu.lastFallback }, { quoted: mek });
    sendMenuVoice(conn, from, mek);
});

// Simple tappable-button message (admin panel ke liye). Success par true, fail par false.
async function sendButtons(conn, jid, quoted, body, buttons) {
    try {
        const { proto, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
        const IM = proto.Message.InteractiveMessage;
        const interactive = IM.create({
            header: IM.Header.fromObject({ title: '', subtitle: '', hasMediaAttachment: false }),
            body: IM.Body.create({ text: body }),
            footer: IM.Footer.create({ text: footerText() }),
            nativeFlowMessage: IM.NativeFlowMessage.fromObject({ buttons })
        });
        const msg = generateWAMessageFromContent(jid, {
            viewOnceMessage: { message: { messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 }, interactiveMessage: interactive } }
        }, { quoted, userJid: conn.user && conn.user.id });
        await relayInteractive(conn, jid, msg);
        return true;
    } catch (e) { console.error('sendButtons error:', e && e.message); return false; }
}

module.exports = { buildCategoryCards, sendCarouselMenu, sendCategoryPicker, groupCommands, sendOwnerCard, sendOwnerContact, ownerCardText, OWNER_LINKS, CATEGORY_ICONS, categoryBoxes, quickReply, urlButton, sendButtons };
