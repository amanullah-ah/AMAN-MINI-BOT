// ===========================================================
//  aman.js — AMAN-MD ka SINGLE branding + design file
//  Bot ka naam, owner, footers, newsletter (channel) IDs, links, image,
//  menu design, CONNECTED message, command-reply frame, fake contact card —
//  sab yahin se badlo. Baqi files isi se padhti hain.
//  (BOT_NAME, OWNER_NAME, BOT_FOOTER, FORCE_CHANNEL_1/2, IMAGE_PATH .env se bhi override ho sakte hain)
// ===========================================================
const env = process.env;

// ─────────── 1. NAAM ───────────
const BOT_NAME   = env.BOT_NAME   || "𝗔𝗠𝗔𝗡-𝐌𝐈𝐍𝐈-𝐁𝐎𝐓";
const OWNER_NAME = env.OWNER_NAME || "𝗔𝗠𝗔𝗡 𝗨𝗟𝗟𝗔𝗛";
const SERVICE_NAME = "𝗔𝗠𝗔𝗡-𝐌𝐈𝐍𝐈-𝐁𝐎𝐓";            // /api/health aur /api/status mein
const LOG_TAG      = "𝗔𝗠𝗔𝗡-𝐌𝐈𝐍𝐈-𝐁𝐎𝐓";                 // console log ka [TAG]
const PING_MESSAGE = "ᴀᴍᴀɴ ᴍɪɴɪ ʙᴏᴛ ɪs ʀᴜɴɴɪɴɢ 🔥";      // /ping ka message
const OTP_TITLE    = "𝗔𝗠𝗔𝗡-𝐌𝐃 — 𝐂𝐨𝐧𝐟𝐢𝐧𝐠 𝐔𝐩𝐝𝐚𝐭𝐞";
const STICKER_AUTHOR = "𝗔𝗠𝗔𝗡-𝐌𝐃";

// ─────────── 2. FOOTERS ───────────
const FOOTER_POWERED    = "𝐏𝐨𝐰𝐞𝐫𝐝 𝐁𝐲 𝗔𝗠𝗔𝗡-𝐓𝐄𝐂𝐇";      // har command reply ke neeche
const FOOTER_DOWNLOADED = "𝐃𝐨𝐰𝐧𝐥𝐨𝐚𝐝𝐞𝐝 𝐁𝐲 𝗔𝗠𝗔𝗡-𝐓𝐄𝐂𝐇";   // download commands ke neeche
const DOWNLOAD_CATEGORIES = ["download", "downloader"];   // in categories par FOOTER_DOWNLOADED lagta hai
const poweredBy = (name) => `𝐏𝐨𝐰𝐞𝐫𝐝 𝐁𝐲 ${name || BOT_NAME}`;
const BOT_FOOTER = env.BOT_FOOTER || poweredBy(BOT_NAME);   // plugins ka config.BOT_FOOTER

// ─────────── 3. NEWSLETTER (CHANNEL) IDs + LINKS ───────────
const UPDATE_CHANNEL_JID = "120363407510749622@newsletter";   // menu mein dikhne wala update channel
const AUTO_REACT_CHANNELS = [                                   // in channels par auto-react default
    "120363429588994223@newsletter",
    "120363407510749622@newsletter"
];
const FORCE_CHANNEL_1 = env.FORCE_CHANNEL_1 || "https://whatsapp.com/channel/0029VbDezmtCMY0C1QFOrg1U";
const FORCE_CHANNEL_2 = env.FORCE_CHANNEL_2 || "https://whatsapp.com/channel/0029Vb8Hsxs72WU1Dx57eu1q";
const CHANNEL_LINK    = "https://whatsapp.com/channel/0029Vb8Hsxs72WU1Dx57eu1q";
const GROUP_INVITE_LINK = "https://chat.whatsapp.com/IReE1OtJcomLNCCLaqIGXD?s=cl&p=a&mlu=4&ilr=4";

// ─────────── 4. IMAGE ───────────
const IMAGE_PATH = env.IMAGE_PATH || "https://i.postimg.cc/RFpBBRrz/AMAN-MINI-BOT.png";

// ─────────── 5. FAKE CONTACT CARDS (quoted bubble) ───────────
const FAKE_CONTACT = {
    OFFICIAL_NAME: "𝗔𝗠𝗔𝗡-𝐓𝐄𝐂𝐇-𝐎𝐅𝐅𝐈𝐂𝐀𝐋",      // lib/fakevCard.js
    DISPLAY_NAME: "𝗔𝗠𝗔𝗡-𝐌𝐃",                 // main.js quoted card
    VCARD_NAME: "𝗔𝗠𝗔𝗡 𝐔𝐋𝐋𝐀𝐇",
    QUOTED_TEXT: "©𝗔𝗠𝗔𝗡-𝐌𝐈𝐍𝐈-𝐁𝐎𝐓"
};

// ─────────── 6. COMMAND-REPLY FRAME (lib/frame.js) ───────────
const FRAME = {
    TOP: "╭┉┉┉┉┉┉┉┉┉┉┉┉┉┉┉┉┉❥",
    HEAD: "┋✯╭━───────────━⊷",
    TITLE_PREFIX: "┋✯┣═━❲ ",
    TITLE_SUFFIX: " ❳",
    LINE_PREFIX: "┋✯┃ ",
    LINE_EMPTY: "┋✯┃",
    FOOT: "┋✯╰━───────────━⊷",
    BOTTOM: "╰┉┉┉┉┉┉┉┉┉┉┉┉┉┉┉┉┉❥",
    DEFAULT_TITLE: "𝐀𝐌𝐀𝐍-𝐓𝐄𝐂𝐇-𝐌𝐈𝐍𝐈"
};

// ─────────── 7. CONNECTED MESSAGE (bot connect hone par) ───────────
// Placeholders: {OWNER} {UPTIME} {PREFIX} {MODE} {COUNT} {VERSION}
const CONNECTED = {
    OWNER_FALLBACK: "𝗔𝗠𝗔𝗡 𝗨𝗟𝗟𝗔𝗛",
    LINES: [
        "╭━𓊈⚝𝗔𝗠𝗔𝗡 𝗧𝗘𝗖𝗛 𝗠𝗗⚝𓊉━┈⊷",
        "┃ 👑 𝗢𝘄𝗻𝗲𝗿: {OWNER}",
        "┃ 🟢 𝗦𝘁𝗮𝘁𝘂𝘀: 𝗖𝗼𝗻𝗻𝗲𝗰𝘁𝗲𝗱",
        "┃ ⚙️ 𝗦𝘆𝘀𝘁𝗲𝗺: 𝗔𝗰𝘁𝗶𝘃𝗲",
        "┃ 🌐 𝗦𝗲𝗿𝘃𝗲𝗿: 𝗥𝘂𝗻𝗻𝗶𝗻𝗴",
        "┃ 🔥 𝗠𝗼𝗱𝘂𝗹𝗲𝘀: 𝗔𝗰𝘁𝗶𝘃𝗲",
        "┃ 📱 𝗕𝗮𝗶𝗹𝗲𝘆𝘀: 𝗠𝘂𝗹𝘁𝗶 𝗗𝗲𝘃𝗶𝗰𝗲",
        "┃ ⏳ 𝗨𝗽𝘁𝗶𝗺𝗲: {UPTIME}",
        "┃ 🔑 𝗣𝗿𝗲𝗳𝗶𝘅: 『{PREFIX}』",
        "┃ 🛡️ 𝗠𝗼𝗱𝗲: {MODE}",
        "┃ 📂 𝗧𝗼𝘁𝗮𝗹 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀: {COUNT}",
        "┃ 📦 𝗩𝗲𝗿𝘀𝗶𝗼𝗻: {VERSION}",
        "┣┬────────────────┈⊷",
        "┃├⟡𝙵𝙾𝙻𝙻𝙾𝚆 𝙾𝙵𝙵𝙸𝙲𝙰𝙻 𝐂𝐡𝐚𝐧𝐧𝐚𝐥",
        "┃└⟡𝙵𝙾𝚁 𝐁𝐨𝐭 𝙰𝙻𝙻 𝙽𝙴𝚆 𝚄𝙿𝙳𝙰𝚃𝙴𝚂",
        "┣┐𝟐 𝚃𝚈𝙿𝙴 𝐌𝐞𝐧𝐮 𝙸𝙽 𝐀𝐌𝐀𝐍-𝐌𝐃",
        "┃├⟡𝚃𝚈𝙿𝙴 .𝗺𝗲𝗻𝘂 𝙵𝙾𝚁 𝚃𝙰𝙿𝙰𝙱𝙻𝙴",
        "┃├⟡𝚃𝚈𝙿𝙴 .𝗰𝗺𝗲𝗻𝘂 𝙵𝙾𝚁 𝚂𝙻𝙸𝙳𝙴",
        "┃└⟡𝙲𝙻𝙸𝙲𝙺 𝐂𝐚𝐭𝐞𝐠𝐨𝐫𝐢𝐞𝐬 𝙱𝚄𝚃𝚃𝙾𝙽",
        "╰─────────────────┈⊷"
    ]
};

// ─────────── 8. MENU DESIGN (.menu) ───────────
const MENU = {
    // {BOT} {OWNER} {PLATFORM} {PREFIX} {VERSION} {UPTIME} {COUNT} {MODE}
    HEADER: [
        "╭━━〔⚝ {BOT} ⚝〕━━┈●",
        "┃ *𝐎𝚆𝙽𝙴𝚁:* {OWNER}",
        "┃ *𝐏𝚁𝙴𝙵𝙸𝚇:* {PREFIX}",
        "┃ *𝐔𝙿𝚃𝙸𝙼𝙴:* {UPTIME}",
        "┃ *𝐂𝙾𝙼𝙼𝙰𝙽𝙳𝚂:* {COUNT}",
        "┃ *𝐌𝙾𝙳𝙴:* {MODE}",
        "┃ *𝐕𝙴𝚁𝚂𝙸𝙾𝙽:* {VERSION}",
        "╰━━━━━━━━━━━━━━━┈●"
    ].join("\n"),

    ALL_TITLE: "> {TITLE}",                       // sari commands se pehle wali line
    ALL_TITLE_TEXT: "𝐀𝐥𝐥 𝐂𝐨𝐦𝐦𝐚𝐧𝐝𝐬 𝐁𝐲 𝐀𝐌𝐀𝐍-𝐓𝐄𝐂𝐇",

    // har category ka dabba (design: ╭━═❲ TITLE / ┣┬⟡ cmd / ┋├⟡ cmd / ┋╰⟡ cmd / ╰┉┉❥)
    CATEGORY_TOP:    "",                          // khali = is line ko skip karo
    CATEGORY_TITLE:  "╭╍╍═❲ {CAT}",
    COMMAND_FIRST:   "┣┬⟡ {CMD}",
    COMMAND_ONLY:    "┣╰⟡ {CMD}",   // category mein sirf ek command ho to
    COMMAND:         "┋├⟡ {CMD}",
    COMMAND_LAST:    "┋╰⟡ {CMD}",
    CATEGORY_BOTTOM: "╰┉┉┉┉┉┉┉┉┉┉┉┉┉┉┉┉❥",

    // ".menu list" likhne par sirf categories ki list is design mein aati hai
    LIST_TOP:    "╭╍╍╍╍╍╍╍╍╍╍┈⊷",
    LIST_TITLE:  "┣═❲ 𝗖𝗔𝗧𝗘𝗚𝗢𝗥𝗜𝗘𝗦",
    LIST_ITEM:   "┃{CAT}",
    LIST_BOTTOM: "╰╍╍╍╍╍╍╍╍╍╍┈⊷",
    LIST_PER_ROW: 2,

    USE_STATIC_MENU: true,   // true = neeche MENU_BLOCKS wali list (khud edit karein); false = commands se auto banega

    FOOTER: FOOTER_POWERED,   // null = config.BOT_FOOTER ya "© Powered by BOT"
    SORT_COMMANDS: true,     // true = A-Z, false = jaise plugins mein likhe hain
    SHOW_HIDDEN: false,      // true = dontAddCommandList wale commands bhi dikhao
    VIDEO_AS_GIF: false,      // true = video GIF ki tarah autoplay/loop; false = normal video
    MAX_CHARS: 3500          // ek message ki limit; zyada ho to menu khud agle message mein chala jata hai
};

module.exports = {
    BOT_NAME, OWNER_NAME, SERVICE_NAME, LOG_TAG, PING_MESSAGE, OTP_TITLE, STICKER_AUTHOR,
    FOOTER_POWERED, FOOTER_DOWNLOADED, DOWNLOAD_CATEGORIES, BOT_FOOTER, poweredBy,
    UPDATE_CHANNEL_JID, AUTO_REACT_CHANNELS, FORCE_CHANNEL_1, FORCE_CHANNEL_2, CHANNEL_LINK, GROUP_INVITE_LINK,
    IMAGE_PATH, FAKE_CONTACT, FRAME, CONNECTED, MENU
};
