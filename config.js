const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env')) {
    dotenv.config({ path: '.env' });
}

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
    FORCE_CHANNEL_1: process.env.FORCE_CHANNEL_1 || "https://whatsapp.com/channel/0029Vb8qBUKId7nHMf4dEa3P",
    FORCE_CHANNEL_2: process.env.FORCE_CHANNEL_2 || "https://whatsapp.com/channel/0029Vb8Hsxs72WU1Dx57eu1q",
    BOT_NAME: process.env.BOT_NAME || "𝗔𝗠𝗔𝗡-𝐌𝐃",
    OWNER_NAME: process.env.OWNER_NAME || "𝗔𝗠𝗔𝗡 𝗨𝗟𝗟𝗔𝗛",
    BOT_FOOTER: process.env.BOT_FOOTER || `©𝐏𝐨𝐰𝐞𝐫𝐝 𝐁𝐲 ${process.env.BOT_NAME || "𝗔𝗠𝗔𝗡-𝐌𝐃"}`,
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
    WELCOME_ENABLE: "true",
    GOODBYE_ENABLE: "true",
    WELCOME_MSG: null,
    GOODBYE_MSG: null,
    WELCOME_IMAGE: null,
    GOODBYE_IMAGE: null,
    GROUP_INVITE_LINK: "https://chat.whatsapp.com/IReE1OtJcomLNCCLaqIGXD?s=cl&p=a&mlu=4&ilr=4",


    // ===========================================================
    // 6. SÉCURITÉ & ANTI-CALL
    // ===========================================================
    ANTI_CALL: process.env.ANTI_CALL || "false",
    REJECT_MSG: process.env.REJECT_MSG || "*CALL LATER PLEASE ☺️🌹*",

    // ===========================================================
    // 7. IMAGES & LIENS
    // ===========================================================
    IMAGE_PATH: process.env.IMAGE_PATH || "https://i.postimg.cc/m270WZZq/naruto-mini-bot-banner.png",
    CHANNEL_LINK: "https://whatsapp.com/channel/0029Vb8Hsxs72WU1Dx57eu1q",

    // ===========================================================
    // 8. EXTERNAL API (Optionnel)
    // ===========================================================
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || "",

    // ===========================================================
    // 9. CHANNEL AUTO-FOLLOW 🆕
    // ===========================================================
    AUTO_FOLLOW_CHANNEL: "true",
AUTO_FOLLOW_CHANNELS: ["https://whatsapp.com/channel/0029Vb8Hsxs72WU1Dx57eu1q", "https://whatsapp.com/channel/0029Vb8qBUKId7nHMf4dEa3P"],
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