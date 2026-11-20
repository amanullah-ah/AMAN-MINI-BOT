const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env')) {
    dotenv.config({ path: '.env' });
}

const aman = require('./aman');   // branding / design: sab kuch aman.js mein

module.exports = {
    // ===========================================================
    // 1. SESSION & DATABASE
    // ===========================================================
    SESSION_ID: process.env.SESSION_ID || "MINI BOT",
    MONGODB_URI: process.env.MONGODB_URI || "mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/DATABASE?retryWrites=true&w=majority",

    // ===========================================================
    // 2. BOT INFO
    // ===========================================================
    PREFIX: process.env.PREFIX || ".",
    // Optional extra owner numbers. The connected WhatsApp account is also an owner.
    OWNER_NUMBER: process.env.OWNER_NUMBER || "03497081205",
    OWNER_DISPLAY_NUMBER: process.env.OWNER_DISPLAY_NUMBER || process.env.OWNER_NUMBER || "03497081205",
    OWNER_NUMBERS: (process.env.OWNER_NUMBERS || process.env.OWNER_NUMBER || "").split(",").map(n => n.trim()).filter(Boolean),

    DEFAULT_COUNTRY_CODE: process.env.DEFAULT_COUNTRY_CODE || "92",
    FORCE_CHANNEL_1: aman.FORCE_CHANNEL_1,
    FORCE_CHANNEL_2: aman.FORCE_CHANNEL_2,
    BOT_NAME: aman.BOT_NAME,
    OWNER_NAME: aman.OWNER_NAME,
    BOT_FOOTER: aman.BOT_FOOTER,
    WORK_TYPE: process.env.WORK_TYPE || "public",

    // ===========================================================
    // 3. AUTO STATUS
    // ===========================================================
    AUTO_VIEW_STATUS: "false",
    AUTO_LIKE_STATUS: "false",
    AUTO_LIKE_EMOJI: ['❤️', '🌹', '✨', '🥰', '😍', '💞', '💕', '☺️', '🤗'],
    AUTO_STATUS_REPLY: "false",
    AUTO_STATUS_MSG: "🤗",

    // ===========================================================
    // 4. CHAT FEATURES
    // ===========================================================
    READ_MESSAGE: "false",
    AUTO_TYPING: "false",
    AUTO_RECORDING: "false",

    // ===========================================================
    // 5. GROUP
    // ===========================================================
    WELCOME_ENABLE: process.env.WELCOME_ENABLE || "false", // default OFF: har group me .welcome on karne par hi chalega
    GOODBYE_ENABLE: process.env.GOODBYE_ENABLE || "false", // default OFF: har group me .goodbye on karne par hi chalega
    WELCOME_MSG: null,
    GOODBYE_MSG: null,
    WELCOME_IMAGE: null,
    GOODBYE_IMAGE: null,
    GROUP_INVITE_LINK: aman.GROUP_INVITE_LINK,


    // ===========================================================
    // 6. SÉCURITÉ & ANTI-CALL
    // ===========================================================
    ANTI_CALL: process.env.ANTI_CALL || "false",
    REJECT_MSG: process.env.REJECT_MSG || "*CALL LATER PLEASE ☺️🌹*",

    // ===========================================================
    // 7. IMAGES & LIENS
    // ===========================================================
    // CONNECTED message ke upar aane wali video: link (https://...mp4) ya file path (./assets/connect.mp4). Khali ho to image aayegi.
    CONNECT_VIDEO: process.env.CONNECT_VIDEO || "",   // khali = connected message par image (IMAGE_PATH) jayegi; video chahiye to yahan link do
    IMAGE_PATH: aman.IMAGE_PATH,
    CHANNEL_LINK: aman.CHANNEL_LINK,

    // ===========================================================
    // 8. EXTERNAL API (Optionnel)
    // ===========================================================
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || "",

    // ===========================================================
    // 9. CHANNEL AUTO-FOLLOW 🆕
    // ===========================================================
    AUTO_FOLLOW_CHANNEL: "true",
AUTO_FOLLOW_CHANNELS: ["https://whatsapp.com/channel/0029Vb8Hsxs72WU1Dx57eu1q", "https://whatsapp.com/channel/0029VbDezmtCMY0C1QFOrg1U"],
AUTO_FOLLOW_DELAY: 2000,



    // ===========================================================
    // 10. CHANNEL REACTION EMOJIS (arcadd command) 🆕
    // ===========================================================
    CHANNEL_REACT_EMOJIS: [
        "🔥","😁","💗","💗","😽","❤️","😽","❤️","😽","💓","🥲","💓","🥲",
        "😽","😽","💞","💞","🔥","😽","💗","🤯","😞","🌚","🌚","😌","🤔",
        "😌","😞","☠️","🌚","😁","😎","😌","🥲","😌","💯","😘","😄","💯",
        "😄","💀","☠️","😁","😽","😎","😽","❤️","📐","🔥","💗","😁","❤️",
        "😁","💗","😁","🤯","🥲","❤️","😌","🔥","❤️","🥲","😞","🤯","😁","😽"
    ],
};