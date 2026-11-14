// main.js
// 𝗔𝗠𝗔𝗡-𝐌𝐃 — Updated with anti-spam + loop guards

const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    jidNormalizedUser,
    Browsers,
    DisconnectReason,
    jidDecode,
    downloadContentFromMessage,
    getContentType,
    fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const { arslanmd } = require('./lib/system');
const config = require('./config');
const SESSION_ROOT = process.env.SESSION_DIR || require('path').join(__dirname, 'session');
const events = require('./arslan');
const { sms } = require('./lib/msg');
const {
    connectdb,
    connectdbForever,
    saveSessionToMongoDB,
    getSessionFromMongoDB,
    deleteSessionFromMongoDB,
    getUserConfigFromMongoDB,
    updateUserConfigInMongoDB,
    addNumberToMongoDB,
    removeNumberFromMongoDB,
    getAllNumbersFromMongoDB,
    setNumberShard,
    getShardMap,
    saveOTPToMongoDB,
    verifyOTPFromMongoDB,
    incrementStats,
    getStatsForNumber,
} = require('./lib/database');
const { handleAntidelete } = require('./lib/antidelete');

const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const pino = require('pino');
const crypto = require('crypto');
const FileType = require('file-type');
const axios = require('axios');
const moment = require('moment-timezone');

// ---------- AUTO FOOTER (har command ke reply par) ----------
// Download commands (category: download / downloader) -> FOOTER_DOWNLOADED, baqi sab -FOOTER_POWERED
const { AsyncLocalStorage } = require('async_hooks');
const footerStore = new AsyncLocalStorage();
const FOOTER_POWERED = '©𝐏𝐨𝐰𝐞𝐫𝐝 𝐁𝐲 𝗔𝗠𝗔𝗡 𝗨𝗟𝗟𝗔𝗛';
const FOOTER_DOWNLOADED = '©𝐃𝐨𝐰𝐧𝐥𝐨𝐚𝐝𝐞𝐝 𝐁𝐲 𝗔𝗠𝗔𝗡 𝗨𝗟𝗟𝗔𝗛';
const DOWNLOAD_CATEGORIES = ['download', 'downloader'];   // aur category yahan add kar sakte hain
const footerFor = (category) => DOWNLOAD_CATEGORIES.includes(String(category || '').toLowerCase()) ? FOOTER_DOWNLOADED : FOOTER_POWERED;
const escapeRegExp = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function applyFooter(content, footer) {
    if (!content || typeof content !== 'object' || !footer) return content;
    if (content.__noFooter) { const { __noFooter, ...rest } = content; return rest; }   // menu ke beech wale messages
    if (content.react || content.delete || content.edit || content.poll || content.forward || content.sticker || content.audio) return content;
    const line = `> ${footer}`;
    const hasOurFooter = (t) => typeof t === 'string' && (t.includes(FOOTER_POWERED) || t.includes(FOOTER_DOWNLOADED));
    // plugin ka purana footer (config.BOT_FOOTER / "© Powered by ...") end se hata do taake double footer na ho
    const stripOld = (t) => {
        let out = String(t || '');
        for (const old of [config.BOT_FOOTER, `©𝐏𝐨𝐰𝐞𝐫𝐝 𝐁𝐲 ${config.BOT_NAME || '𝗔𝗠𝗔𝗡-𝐌𝐃'}`]) {
            if (old) out = out.replace(new RegExp(`\\s*(>\\s*)?${escapeRegExp(old)}\\s*$`), '');
        }
        return out;
    };
    if (typeof content.text === 'string') {
        if (hasOurFooter(content.text)) return content;
        const base = stripOld(content.text);
        return { ...content, text: base ? `${base}\n\n${line}` : line };
    }
    if (content.image || content.video || content.document) {
        const cap = typeof content.caption === 'string' ? content.caption : '';
        if (hasOurFooter(cap)) return content;
        const base = stripOld(cap);
        return { ...content, caption: base ? `${base}\n\n${line}` : line };
    }
    return content;
}

const prefix = config.PREFIX;
const mode = config.MODE || config.WORK_TYPE;
const router = express.Router();

// ═══════════════════════════════════════════
//  🛑 GLOBAL ANTI-SPAM STATE
// ═══════════════════════════════════════════
if (!global.__processedMsgIds) global.__processedMsgIds = new Map();
// Custom pairing code: naam + random baqi. Code hamesha 8 characters ka hota hai.
// WhatsApp sirf ye characters leta hai: 1-9 aur A-Z (bina I, L, O, U) — 0 bhi nahi.
// Env PAIR_CODE_PREFIX me naam likho (max 8 letters). 8 letters = poora fixed code (AMANHIBA → AMAN-HIBA), kam letters = naam + random (AHMAD → AHMAD7KQ). Khali ho to normal random code.
function buildCustomPairCode() {
    const ALPHA = '123456789ABCDEFGHJKLMNPQRSTVWXYZ';
    const prefix = String(process.env.PAIR_CODE_PREFIX === undefined ? 'AMANHIBA' : process.env.PAIR_CODE_PREFIX)
        .toUpperCase().split('').filter(c => ALPHA.includes(c)).join('').slice(0, 8);
    if (!prefix) return undefined;
    let code = prefix;
    while (code.length < 8) code += ALPHA[Math.floor(Math.random() * ALPHA.length)];
    return code;
}

if (!global.__greetedNumbers) global.__greetedNumbers = new Set();

// Bounded in-memory panel log buffer; never store credentials or message contents.
const panelLogs = [];
const PANEL_LOG_LIMIT = 300;
const panelStartedAt = Date.now();

function addPanelLog(level, message) {
    panelLogs.push({ time: new Date().toISOString(), level, message: String(message).slice(0, 500) });
    if (panelLogs.length > PANEL_LOG_LIMIT) panelLogs.shift();
}

function maskNumber(number) {
    const n = String(number || '').replace(/\\D/g, '');
    return n.length > 4 ? `${n.slice(0, 2)}••••••${n.slice(-2)}` : '••••';
}

function requirePanelAuth(req, res, next) {
    const configured = process.env.AMAN_PANEL_TOKEN || process.env.RIZO_PANEL_TOKEN;   // purana naam bhi chalega
    if (!configured) {
        return res.status(503).json({ error: 'Panel is not configured. Set AMAN_PANEL_TOKEN in Railway Variables.' });
    }
    const supplied = Buffer.from(String(req.get('x-panel-token') || ''), 'utf8');
    const expected = Buffer.from(configured, 'utf8');
    const cryptoSafe = supplied.length === expected.length &&
        crypto.timingSafeEqual(supplied, expected);
    if (!cryptoSafe) return res.status(401).json({ error: 'Unauthorized' });
    next();
}

// ===========================================================
// 🆕 OWNER NUMBERS — config se (multi-number support)
// ===========================================================
const OWNER_NUMBERS = [...new Set([
    ...(Array.isArray(config.OWNER_NUMBERS) ? config.OWNER_NUMBERS : []),
    config.OWNER_NUMBER,
    ...(process.env.OWNER_NUMBERS || '').split(',')
].map(normalizeOwnerNumber).filter(Boolean))];

function normalizeOwnerNumber(value) {
    let raw = String(value || '').trim();
    if (raw.includes('@')) raw = raw.split('@')[0];
    if (raw.includes(':')) raw = raw.split(':')[0];
    let number = raw.replace(/\D/g, '');
    if (number.startsWith('00')) number = number.slice(2);
    if (number.startsWith('920') && number.length === 13) number = '92' + number.slice(3);
    if (number.startsWith('0')) number = '92' + number.slice(1);
    if (number.length === 10 && number.startsWith('3')) number = '92' + number;
    return number;
}

function isOwnerNumberCheck(number, alternate) {
    const candidates = [number, alternate].map(normalizeOwnerNumber).filter(Boolean);
    return candidates.some(clean => OWNER_NUMBERS.includes(clean));
}

function normalizeParticipantJid(value) {
    if (!value) return '';
    try { return jidNormalizedUser(String(value)).toLowerCase(); }
    catch (_) { return String(value).replace(/:\d+(?=@)/, '').toLowerCase(); }
}

function sameParticipant(a, b) {
    const aa = normalizeParticipantJid(a), bb = normalizeParticipantJid(b);
    if (!aa || !bb) return false;
    if (aa === bb) return true;
    return normalizeOwnerNumber(aa) === normalizeOwnerNumber(bb) &&
        Boolean(normalizeOwnerNumber(aa));
}

function unwrapMessageContent(message) {
    let current = message;
    for (let i = 0; i < 5 && current; i++) {
        const type = getContentType(current);
        if (!type) break;
        if (type === 'ephemeralMessage') current = current.ephemeralMessage?.message;
        else if (type === 'viewOnceMessage' || type === 'viewOnceMessageV2' || type === 'viewOnceMessageV2Extension') current = current[type]?.message;
        else if (type === 'documentWithCaptionMessage') current = current.documentWithCaptionMessage?.message;
        else if (type === 'editedMessage') current = current.editedMessage?.message;
        else break;
    }
    return current || message;
}

function extractTextBody(message) {
    const content = unwrapMessageContent(message);
    if (!content) return '';
    const type = getContentType(content);
    const node = content[type] || {};
    if (type === 'conversation') return content.conversation || '';
    if (type === 'extendedTextMessage') return node.text || '';
    if (['imageMessage', 'videoMessage', 'documentMessage'].includes(type)) return node.caption || '';
    if (type === 'buttonsResponseMessage') return node.selectedButtonId || node.selectedDisplayText || '';
    if (type === 'listResponseMessage') return node.singleSelectReply?.selectedRowId || node.title || '';
    if (type === 'templateButtonReplyMessage') return node.selectedId || node.selectedDisplayText || '';
    if (type === 'interactiveResponseMessage') {
        const params = node.nativeFlowResponseMessage?.paramsJson;
        if (params) { try { const parsed = JSON.parse(params); return parsed.id || parsed.row_id || parsed.selected_id || ''; } catch (_) {} }
    }
    return '';
}

connectdbForever();

const activeSockets = new Map();
global.activeSockets = activeSockets;

const socketCreationTime = new Map();
const autoFollowedChannels = new Set();

// ===========================================================
// AUTO-FOLLOW
// ===========================================================
function newsletterInviteCode(value) {
    try {
        const url = new URL(String(value || ''));
        if (url.protocol !== 'https:' || !/^(www\.)?whatsapp\.com$/i.test(url.hostname)) return null;
        const parts = url.pathname.split('/').filter(Boolean);
        return parts[0] === 'channel' && /^[A-Za-z0-9_-]{5,100}$/.test(parts[1] || '') ? parts[1] : null;
    } catch (_) { return null; }
}

async function autoFollowConfiguredChannels(socket, number) {
    const links = [config.FORCE_CHANNEL_1, config.FORCE_CHANNEL_2].filter(Boolean);
    const ids = Array.isArray(config.AUTO_FOLLOW_CHANNELS) ? config.AUTO_FOLLOW_CHANNELS : [];

    const enabled = String(config.AUTO_FOLLOW_CHANNEL || 'true') === 'true';
    if (!enabled) return;
    if (!links.length && !ids.length) return;

    if (typeof socket.newsletterMetadata !== 'function' || typeof socket.newsletterFollow !== 'function') {
        arslanLog('Auto-follow unavailable in this Baileys version.', 'warning');
        return;
    }

    const delayMs = Number(config.AUTO_FOLLOW_DELAY || 2000);
    const allJids = new Set();

    for (const link of [...new Set(links)]) {
        const inviteCode = newsletterInviteCode(link);
        if (!inviteCode) continue;
        try {
            const metadata = await socket.newsletterMetadata('invite', inviteCode);
            const jid = metadata && (metadata.id || metadata.jid);
            if (jid && String(jid).endsWith('@newsletter')) allJids.add(jid);
        } catch (error) {
            arslanLog(`Metadata fetch failed for ${link}: ${error.message}`, 'warning');
        }
    }

    for (const id of [...new Set(ids)]) {
        const cleanId = String(id).trim();
        if (!cleanId) continue;
        const jid = cleanId.endsWith('@newsletter') ? cleanId : `${cleanId}@newsletter`;
        allJids.add(jid);
    }

    for (const jid of allJids) {
        const followKey = `${number}:${jid}`;
        if (autoFollowedChannels.has(followKey)) continue;
        try {
            await socket.newsletterFollow(jid);
            autoFollowedChannels.add(followKey);
            arslanLog(`✅ Auto-followed: ${jid} for ${number}`, 'success');
            await delay(delayMs);
        } catch (error) {
            arslanLog(`Auto-follow failed for ${jid}: ${error.message}`, 'warning');
        }
    }
}

function createarslanStore() {
    const store = {
        messages: {},
        bind(ev) {
            ev.on('messages.upsert', ({ messages }) => {
                for (const msg of messages) {
                    const jid = msg.key && msg.key.remoteJid;
                    if (!jid) continue;
                    if (!store.messages[jid]) store.messages[jid] = [];
                    store.messages[jid].push(msg);
                    if (store.messages[jid].length > 200) store.messages[jid].shift();
                }
            });
        },
        async loadMessage(jid, id) {
            if (!store.messages[jid]) return null;
            return store.messages[jid].find(m => m.key && m.key.id === id) || null;
        }
    };
    return store;
}

const createSerial = (size) => crypto.randomBytes(size).toString('hex').slice(0, size);

const getGroupAdmins = (participants) => {
    const admins = [];
    for (const participant of (participants || [])) {
        if (participant.admin == null) continue;
        for (const jid of [participant.id, participant.jid, participant.phoneNumber, participant.lid]) {
            if (jid && !admins.includes(jid)) admins.push(jid);
        }
    }
    return admins;
};

function isNumberAlreadyConnected(number) {
    const s = activeSockets.get(number.replace(/[^0-9]/g, ''));
    return !!(s && s.user);
}

function dropSocket(n) {
    const s = activeSockets.get(n);
    if (s) {
        try { s.ev.removeAllListeners(); } catch (_) {}
        try { s.ws.close(); } catch (_) {}
    }
    activeSockets.delete(n);
    socketCreationTime.delete(n);
}

const restartCounts = new Map();

// ===========================================================
// SPEED & SAFETY HELPERS
// ===========================================================
// 1) Group metadata cache — before, EVERY group message did a live groupMetadata() query
//    (slow, and a classic WhatsApp rate-limit / ban trigger when many sessions are online).
const groupMetaCache = new Map();           // "number|jid" -> { at, meta }
const GROUP_META_TTL_MS = 5 * 60 * 1000;
const groupMetaFailed = new Map();
async function getGroupMetaCached(conn, number, jid) {
    const key = `${number}|${jid}`;
    const hit = groupMetaCache.get(key);
    if (hit && Date.now() - hit.at < GROUP_META_TTL_MS) return hit.meta;
    // Group info atak jaye to command 60s na ruke: 5s timeout, fail hone par 30s tak dobara try nahi
    const failedAt = groupMetaFailed.get(key);
    if (failedAt && Date.now() - failedAt < 30000) throw new Error('group metadata recently failed');
    let meta;
    try {
        meta = await Promise.race([
            conn.groupMetadata(jid),
            new Promise((_, rej) => setTimeout(() => rej(new Error('group metadata timeout')), 5000))
        ]);
    } catch (e) { groupMetaFailed.set(key, Date.now()); throw e; }
    groupMetaCache.set(key, { at: Date.now(), meta });
    if (groupMetaCache.size > 3000) {
        const cutoff = Date.now() - GROUP_META_TTL_MS;
        for (const [k, v] of groupMetaCache) if (v.at < cutoff) groupMetaCache.delete(k);
    }
    return meta;
}
const invalidateGroupMeta = (number, jid) => groupMetaCache.delete(`${number}|${jid}`);

// 2) Auto status-like is limited per session (mass automatic reactions get numbers banned)
const STATUS_LIKES_PER_HOUR = Number(process.env.STATUS_LIKES_PER_HOUR || 20);
const statusLikeLog = new Map();
function canLikeStatus(number) {
    const now = Date.now();
    const recent = (statusLikeLog.get(number) || []).filter(t => now - t < 3600000);
    if (recent.length >= STATUS_LIKES_PER_HOUR) { statusLikeLog.set(number, recent); return false; }
    recent.push(now);
    statusLikeLog.set(number, recent);
    return true;
}

// 3) Outgoing messages are spaced 0.5–1.0 s apart per session (like a human, not a flood)
// Gap env se badal sakte hain: SEND_GAP_MIN_MS (default 250) + random SEND_GAP_JITTER_MS (default 250). 0 = koi gap nahi
const SEND_GAP_MIN = Math.max(0, Number(process.env.SEND_GAP_MIN_MS ?? 250));
const SEND_GAP_JITTER = Math.max(1, Number(process.env.SEND_GAP_JITTER_MS ?? 250));
function applySendThrottle(conn) {
    if (conn.__throttled) return;
    conn.__throttled = true;
    const originalSend = conn.sendMessage.bind(conn);
    let nextAt = 0;
    conn.sendMessage = async (jid, content, options) => {
        // Reactions / presence ko spacing ki zaroorat nahi (reply ko late karte the)
        const isLight = content && typeof content === 'object' && (content.react || content.delete);
        if (!isLight) {
            const now = Date.now();
            const at = Math.max(now, nextAt);
            nextAt = at + SEND_GAP_MIN + Math.floor(Math.random() * SEND_GAP_JITTER);
            if (at > now) await delay(at - now);
        }
        const st = footerStore.getStore();
        if (st && jid === st.jid) content = applyFooter(content, st.footer);
        else if (content && content.__noFooter) { const { __noFooter, ...rest } = content; content = rest; }
        return originalSend(jid, content, options);
    };
}

// 4) WhatsApp Web version is cached (it used to be downloaded on every single connect)
let waVersionCache = { at: 0, version: null };
async function getWaVersion() {
    if (waVersionCache.version && Date.now() - waVersionCache.at < 6 * 3600 * 1000) return waVersionCache.version;
    try {
        const v = (await fetchLatestBaileysVersion()).version;
        waVersionCache = { at: Date.now(), version: v };
        return v;
    } catch (_) {
        return waVersionCache.version || [2, 3000, 1033105955];
    }
}

// 5) /code (pair website): same number can ask for a new code only every 20 s
const pairCodeCooldown = new Map();

// ---------- multi-server pairing site ----------
// Run several copies of this bot (different hosts). Each copy has its own SERVER_ID / SERVER_NAME /
// MAX_SESSIONS. The pair website lists them and shows REAL live numbers from each one.
const SERVER_ID = String(process.env.SERVER_ID || '1');
const SERVER_NAME = process.env.SERVER_NAME || `Server ${SERVER_ID.padStart(2, '0')}`;
const MAX_SESSIONS = Math.max(1, Number(process.env.MAX_SESSIONS || 50));
const connectedCount = () => Array.from(activeSockets.keys()).filter(isNumberAlreadyConnected).length;


// ---------- LOGICAL SERVERS (10 servers, ONE url) ----------
// One process, one URL. The pair site shows LOGICAL_SERVERS servers; every user picks one and the number
// is registered on it. Live counts are REAL: number of connected sessions assigned to each logical server.
const LOGICAL_SERVERS = Math.min(50, Math.max(1, Number(process.env.LOGICAL_SERVERS || 10)));
const LOGICAL_CAPACITY = Math.max(1, Number(process.env.LOGICAL_CAPACITY || 25));
const shardOf = new Map();   // number -> '1'..'N'
const shardFile = path.join(__dirname, 'data', 'shards.json');
try { for (const [n, sh] of Object.entries(JSON.parse(fs.readFileSync(shardFile, 'utf8')))) shardOf.set(n, String(sh)); } catch (_) {}
function saveShardFile() { try { fs.writeFileSync(shardFile, JSON.stringify(Object.fromEntries(shardOf))); } catch (_) {} }
function validShard(v) { const n = parseInt(v, 10); return n >= 1 && n <= LOGICAL_SERVERS ? String(n) : null; }
function assignShard(number, shard) {
    const sh = validShard(shard) || shardOf.get(number) || '1';
    shardOf.set(number, sh); saveShardFile();
    setNumberShard(number, sh).catch(() => {});
    return sh;
}
function shardActive(sh) {
    let c = 0;
    for (const n of activeSockets.keys()) if (isNumberAlreadyConnected(n) && (shardOf.get(n) || '1') === sh) c++;
    return c;
}
function logicalServerList() {
    const out = [];
    for (let i = 1; i <= LOGICAL_SERVERS; i++) {
        const id = String(i), active = shardActive(id);
        out.push({ id, name: `Server ${id.padStart(2, '0')}`, url: '', online: true, active, capacity: LOGICAL_CAPACITY, full: active >= LOGICAL_CAPACITY });
    }
    return out;
}
getShardMap().then(rows => { for (const [n, sh] of rows) if (!shardOf.has(n)) shardOf.set(n, String(sh)); }).catch(() => {});

function extraServers() {
    // SERVERS='[{"name":"Server 02","url":"https://bot2.example.com"}]'  or a servers.json file
    let list = [];
    try {
        if (process.env.SERVERS) list = JSON.parse(process.env.SERVERS);
        else if (fs.existsSync(path.join(__dirname, 'servers.json'))) list = JSON.parse(fs.readFileSync(path.join(__dirname, 'servers.json'), 'utf8'));
    } catch (e) { arslanLog(`servers list invalid: ${e.message}`, 'warning'); }
    return (Array.isArray(list) ? list : [])
        .filter(x => x && typeof x.url === 'string' && /^https?:\/\//i.test(x.url))
        .map(x => ({ name: String(x.name || x.url).slice(0, 40), url: x.url.replace(/\/+$/, '') }));
}

// Admin endpoints are closed unless ADMIN_TOKEN is set and sent (?token= or x-admin-token)
function requireAdmin(req, res, next) {
    const token = String(process.env.ADMIN_TOKEN || '');
    if (!token) return res.status(403).json({ error: 'Disabled', message: 'ADMIN_TOKEN set karein tab ye endpoint chalega.' });
    const sent = String(req.query.token || req.headers['x-admin-token'] || '');
    if (sent !== token) return res.status(401).json({ error: 'Unauthorized' });
    next();
}

function getConnectionStatus(number) {
    const n = number.replace(/[^0-9]/g, '');
    const isConnected = isNumberAlreadyConnected(n);
    const connectionTime = socketCreationTime.get(n);
    return {
        isConnected,
        connectionTime: connectionTime ? new Date(connectionTime).toLocaleString() : null,
        uptime: connectionTime ? Math.floor((Date.now() - connectionTime) / 1000) : 0
    };
}

function arslanLog(message, type = 'info') {
    const icons = { info: '📝', success: '✅', error: '❌', warning: '⚠️', debug: '🐛' };
    const timestamp = new Date().toISOString();
    console.log(`${icons[type] || '📝'} [𝗔𝗠𝗔𝗡-𝐌𝐃] ${timestamp}: ${message}`);
    addPanelLog(type, message);
}

const { handleGroupParticipants } = require('./lib/welcome');
const { getBotPic } = require('./lib/botpic');
// Load Plugins
const pluginsDir = path.join(__dirname, 'plugins');
if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir, { recursive: true });
const pluginFiles = fs.readdirSync(pluginsDir)
    .filter(f => f.endsWith('.js') && f.toLowerCase() !== 'nsfw-girls.js')
    .sort((a, b) => a.localeCompare(b));
arslanLog(`Loading ${pluginFiles.length} plugins...`, 'info');
for (const file of pluginFiles) {
    try { require(path.join(pluginsDir, file)); }
    catch (e) { arslanLog(`Failed to load plugin ${file}: ${e.message}`, 'error'); }
}

async function setupCallHandlers(socket, number) {
    socket.ev.on('call', async (calls) => {
        try {
            const userConfig = await getUserConfigFromMongoDB(number);
            if (userConfig.ANTI_CALL !== 'true') return;
            for (const call of calls) {
                if (call.status !== 'offer') continue;
                await socket.rejectCall(call.id, call.from);
                await socket.sendMessage(call.from, {
                    text: userConfig.REJECT_MSG || config.REJECT_MSG
                });
            }
        } catch (err) {
            arslanLog(`Anti-call error for ${number}: ${err.message}`, 'error');
        }
    });
}

// ═══════════════════════════════════════════
//  🛑 AUTO RESTART WITH THROTTLE
// ═══════════════════════════════════════════
// ===========================================================
// SESSION KEEPER — sessions stay connected until the USER really logs out
//  • reconnect forever with exponential backoff (no "3 attempts then give up")
//  • only a real logout (401 / device removed) deletes a session
//  • "connection replaced" (old + new deployment overlap) waits and retries
//  • a watchdog re-connects anything that is registered but offline
// ===========================================================
const reconnectTimers = new Map();   // number -> timeout handle
const blockedUntil = new Map();      // number -> timestamp (banned / replaced cool-down)

function scheduleReconnect(number, wait, reason) {
    const n = String(number).replace(/[^0-9]/g, '');
    if (reconnectTimers.has(n)) return;                 // already scheduled
    arslanLog(`Reconnecting ${n} in ${Math.round(wait / 1000)}s (${reason})`, 'warning');
    const t = setTimeout(async () => {
        reconnectTimers.delete(n);
        if (isNumberAlreadyConnected(n)) return;
        try {
            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes, setHeader: () => {}, json: () => {} };
            await arslanPair(n, mockRes);
        } catch (e) {
            arslanLog(`Reconnection failed for ${n}: ${e.message}`, 'error');
            scheduleReconnect(n, 30000, 'retry after error');
        }
    }, wait);
    reconnectTimers.set(n, t);
}

function setupAutoRestart(socket, number) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');

    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') { restartCounts.set(sanitizedNumber, 0); blockedUntil.delete(sanitizedNumber); return; }
        if (connection !== 'close') return;

        const statusCode = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode;
        const errorMessage = lastDisconnect && lastDisconnect.error && lastDisconnect.error.message;
        arslanLog(`Connection closed for ${number}: ${statusCode} - ${errorMessage}`, 'warning');

        // 1) The user logged this device out from the phone -> the session is really gone
        if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
            dropSocket(sanitizedNumber);
            restartCounts.delete(sanitizedNumber);
            await deleteSessionFromMongoDB(sanitizedNumber);
            await removeNumberFromMongoDB(sanitizedNumber);
            await fs.remove(path.join(SESSION_ROOT, `session_${sanitizedNumber}`)).catch(() => {});
            arslanLog(`${sanitizedNumber} logged out by user — session removed`, 'info');
            return;
        }

        // 2) Pairing was never completed (code not entered) -> nothing to keep alive
        const registered = !!(socket.authState && socket.authState.creds && socket.authState.creds.registered);
        if (!registered && statusCode !== DisconnectReason.restartRequired) {
            dropSocket(sanitizedNumber);
            return;
        }

        dropSocket(sanitizedNumber);

        // 3) Same session opened somewhere else (old deployment still running) -> back off, then retry
        if (statusCode === DisconnectReason.connectionReplaced || statusCode === 440) {
            blockedUntil.set(sanitizedNumber, Date.now() + 90000);
            return scheduleReconnect(sanitizedNumber, 90000, 'connection replaced');
        }

        // 4) Banned / forbidden -> try again only rarely
        if (statusCode === 403) {
            blockedUntil.set(sanitizedNumber, Date.now() + 3600000);
            return scheduleReconnect(sanitizedNumber, 3600000, 'forbidden (403)');
        }

        // 5) Everything else (timeouts, network, server restarts) is temporary -> keep trying forever
        const attempts = (restartCounts.get(sanitizedNumber) || 0) + 1;
        restartCounts.set(sanitizedNumber, attempts);
        const wait = statusCode === DisconnectReason.restartRequired
            ? 1000
            : Math.min(5000 * Math.pow(2, Math.min(attempts - 1, 6)), 300000) + Math.floor(Math.random() * 2000);
        scheduleReconnect(sanitizedNumber, wait, `attempt ${attempts}`);
    });
}

async function arslanPair(number, res = null) {
    let connectionLockKey;
    const sanitizedNumber = number.replace(/[^0-9]/g, '');

    try {
        const sessionPath = path.join(SESSION_ROOT, `session_${sanitizedNumber}`);

        if (activeSockets.has(sanitizedNumber) && !isNumberAlreadyConnected(sanitizedNumber)) {
            dropSocket(sanitizedNumber);
        }

        if (isNumberAlreadyConnected(sanitizedNumber)) {
            const status = getConnectionStatus(sanitizedNumber);
            if (res && !res.headersSent) {
                return res.json({ status: 'already_connected', message: 'Number is already connected', connectionTime: status.connectionTime, uptime: `${status.uptime} sec` });
            }
            return;
        }

        connectionLockKey = `arslan_lock_${sanitizedNumber}`;
        if (global[connectionLockKey]) {
            if (res && !res.headersSent) return res.json({ status: 'connection_in_progress' });
            return;
        }
        global[connectionLockKey] = true;

        const existingSession = await getSessionFromMongoDB(sanitizedNumber);

        const localCredsPath = path.join(sessionPath, 'creds.json');
        let localRegistered = false;
        if (fs.existsSync(localCredsPath)) {
            try { localRegistered = !!JSON.parse(fs.readFileSync(localCredsPath, 'utf8')).registered; } catch (_) {}
        }

        if (localRegistered) {
            arslanLog(`Using local session for ${sanitizedNumber}`, 'info');
            if (!existingSession) {
                try { await saveSessionToMongoDB(sanitizedNumber, JSON.parse(fs.readFileSync(localCredsPath, 'utf8'))); } catch (_) {}
            }
        } else if (existingSession) {
            fs.ensureDirSync(sessionPath);
            fs.writeFileSync(localCredsPath, JSON.stringify(existingSession, null, 2));
            arslanLog(`Restored session from MongoDB for ${sanitizedNumber}`, 'success');
        } else {
            arslanLog(`No session for ${sanitizedNumber} — new pairing required`, 'info');
            if (fs.existsSync(sessionPath)) await fs.remove(sessionPath);
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'fatal' : 'debug' });

        const arslanStore = createarslanStore();

        const waVersion = await getWaVersion();

        const conn = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            logger: pino({ level: "silent" }),
            version: waVersion,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 20000,
            retryRequestDelayMs: 250,
            maxMsgRetryCount: 3,
            cachedGroupMetadata: async (jid) => { const hit = groupMetaCache.get(`${sanitizedNumber}|${jid}`); return hit ? hit.meta : undefined; },
            // 🛑 ANTI-SPAM: false — bot apne messages ko dobara process nahi karega
            emitOwnEvents: false,
            fireInitQueries: true,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            browser: Browsers.ubuntu('Chrome'),
            getMessage: async (key) => {
                const msg = await arslanStore.loadMessage(key.remoteJid, key.id);
                // unknown message -> undefined (a fake placeholder text here was re-sent to chats on every retry = spam)
                return msg && msg.message ? msg.message : undefined;
            }
        });

        socketCreationTime.set(sanitizedNumber, Date.now());
        activeSockets.set(sanitizedNumber, conn);
        arslanStore.bind(conn.ev);

        setupCallHandlers(conn, number);
        setupAutoRestart(conn, number);

        conn.decodeJid = jid => {
            if (!jid) return jid;
            if (/:\d+@/gi.test(jid)) {
                const decode = jidDecode(jid) || {};
                return (decode.user && decode.server && decode.user + '@' + decode.server) || jid;
            }
            return jid;
        };

        conn.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
            const quoted = message.msg ? message.msg : message;
            const mime = (message.msg || message).mimetype || '';
            const messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
            const stream = await downloadContentFromMessage(quoted, messageType);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            let ext = 'bin';
            try {
                let ft = FileType;
                if (typeof ft?.fromBuffer === 'function') {
                    const type = await ft.fromBuffer(buffer);
                    if (type?.ext) ext = type.ext;
                } else if (typeof ft?.fileTypeFromBuffer === 'function') {
                    const type = await ft.fileTypeFromBuffer(buffer);
                    if (type?.ext) ext = type.ext;
                } else if (typeof ft === 'function') {
                    const type = await ft(buffer);
                    if (type?.ext) ext = type.ext;
                } else {
                    throw new Error('No file-type function');
                }
            } catch (_) {
                if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
                else if (mime.includes('png')) ext = 'png';
                else if (mime.includes('webp')) ext = 'webp';
                else if (mime.includes('gif')) ext = 'gif';
                else if (mime.includes('mp4')) ext = 'mp4';
                else if (mime.includes('mp3') || mime.includes('mpeg')) ext = 'mp3';
                else if (mime.includes('ogg')) ext = 'ogg';
                else if (mime.includes('pdf')) ext = 'pdf';
                else ext = 'bin';
            }

            const trueFileName = attachExtension ? `${filename}.${ext}` : filename;
            await fs.writeFileSync(trueFileName, buffer);
            return trueFileName;
        };

        // 🆕 Captured HERE, once, before pairing is even requested — this is the only
        // reliable signal that this is a brand-new login. `existingSession` (looked up
        // a few lines above) can already be true even on a fresh number: an earlier
        // pairing attempt that later timed out still fires `creds.update` once and
        // saves partial credentials, which made the greeting below never fire again.
        const isFreshLogin = !conn.authState.creds.registered;
        // FIX: after the pairing code is entered WhatsApp forces a restart (515), so the
        // socket that finally reaches 'open' is a NEW one with creds.registered = true.
        // Remember the fresh login across that restart, otherwise the greeting never fires.
        if (!global.__pendingGreet) global.__pendingGreet = new Set();
        if (isFreshLogin) global.__pendingGreet.add(sanitizedNumber);

        if (!conn.authState.creds.registered) {
            arslanLog(`🔐 Starting NEW pairing for ${sanitizedNumber}`, 'info');
            try {
                let code = null, lastErr = null;
                for (let attempt = 1; attempt <= 3 && !code; attempt++) {
                    try {
                        await delay(attempt === 1 ? 1500 : 2500);
                        code = await conn.requestPairingCode(sanitizedNumber, buildCustomPairCode());
                    } catch (e) {
                        lastErr = e;
                        arslanLog(`Pairing code attempt ${attempt}/3 failed: ${e.message}`, 'warning');
                    }
                }
                if (!code) throw lastErr || new Error('Pairing code not received');
                if (/^[A-Z0-9]{8}$/i.test(code)) code = code.slice(0, 4) + '-' + code.slice(4); // AMAN-HIBA format
                arslanLog(`Pairing Code: ${code}`, 'success');
                if (res && !res.headersSent) {
                    res.send({ code, status: 'new_pairing' });
                }
            } catch (error) {
                arslanLog(`Failed to request pairing code: ${error.message}`, 'error');
                if (res && !res.headersSent) {
                    res.status(500).send({ error: 'Failed to get pairing code', message: String((error && error.message) || error || 'Unknown error') });
                }
                throw error;
            }
        } else {
            if (res && !res.headersSent) {
                res.json({ status: 'reconnecting', message: 'Reconnecting with existing session' });
            }
        }

        applySendThrottle(conn);

        conn.ev.on('creds.update', async () => {
            await saveCreds();
            const fileContent = await fs.readFile(path.join(sessionPath, 'creds.json'), 'utf8');
            const creds = JSON.parse(fileContent);
            const existingSessionCheck = await getSessionFromMongoDB(sanitizedNumber);
            const isNewSession = !existingSessionCheck;
            await saveSessionToMongoDB(sanitizedNumber, creds);
            if (isNewSession) {
                arslanLog(`🎉 NEW user ${sanitizedNumber} registered!`, 'success');
            }
        });

        // Welcome / goodbye (DP card + shayari) — settings live in lib/welcome.js
        conn.ev.on('groups.update', (updates) => {
            for (const u of updates || []) if (u && u.id) invalidateGroupMeta(sanitizedNumber, u.id);
        });
        conn.ev.on('group-participants.update', async (update) => {
            invalidateGroupMeta(sanitizedNumber, update.id);
            try { await handleGroupParticipants(conn, update); }
            catch (e) { arslanLog(`Welcome error: ${e.message}`, 'error'); }
        });

        conn.ev.on('messages.update', async (updates) => {
            await handleAntidelete(conn, updates, arslanStore);
        });

        // ═══════════════════════════════════════════
        //  🛑 CONNECTION UPDATE — greeting sirf ek baar
        // ═══════════════════════════════════════════
        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'open') {
                await arslanmd(conn);
                arslanLog(`Connected: ${sanitizedNumber}`, 'success');

                autoFollowConfiguredChannels(conn, sanitizedNumber).catch(error => {
                    arslanLog(`Auto-follow task failed: ${error.message}`, 'warning');
                });

                const userJid = jidNormalizedUser(conn.user.id);
                await addNumberToMongoDB(sanitizedNumber);

                // 🛑 Greeting sirf ek baar per boot session per number
                if (global.__pendingGreet && global.__pendingGreet.has(sanitizedNumber) && !global.__greetedNumbers.has(sanitizedNumber)) {
                    global.__pendingGreet.delete(sanitizedNumber);
                    global.__greetedNumbers.add(sanitizedNumber);
                    await delay(2500); // let the fresh session settle before sending
                    const greetText = `\n╭────────────────◇\n│✦ *${config.BOT_NAME || '𝗔𝗠𝗔𝗡-𝐌𝐃-𝐁𝐎𝐓'} — CONNECTED* 🔥\n│✦ Type *${prefix}menu* see all commands 💫\n│✦ Prefix 『 ${prefix} 』  Mode 〔${mode}〕\n╰────────────────○\n${config.BOT_FOOTER || `©𝐏𝐨𝐰𝐞𝐫𝐝 𝐁𝐲 ${config.BOT_NAME || '𝗔𝗠𝗔𝗡-𝐌𝐃-𝐁𝐎𝐓'}`}`;
                    let greeted = false;
                    for (let attempt = 1; attempt <= 3 && !greeted; attempt++) {
                        try {
                            // 📂 CONNECTED message ke andar hi tappable categories (ek hi message). Fail ho to purana image message.
                            let sentInteractive = false;
                            try { sentInteractive = await require('./plugins/carousel-menu').sendCategoryPicker(conn, userJid, undefined, greetText, { connectMode: true }); } catch (_) {}
                            if (!sentInteractive) await conn.sendMessage(userJid, { image: getBotPic(conn), caption: greetText });
                            greeted = true;
                        } catch (e) {
                            arslanLog(`Greeting (image) attempt ${attempt} failed: ${e.message}`, 'warning');
                            // image URL may be down -> fall back to plain text
                            try {
                                await conn.sendMessage(userJid, { text: greetText });
                                greeted = true;
                            } catch (e2) {
                                arslanLog(`Greeting (text) attempt ${attempt} failed: ${e2.message}`, 'warning');
                                await delay(2000);
                            }
                        }
                    }
                }
            }
            if (connection === 'close') {
                const reason = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode;
                if (reason === DisconnectReason.loggedOut) arslanLog(`Session logged out.`, 'error');
            }
        });

        // ===========================================================
        //  🆕 MESSAGE HANDLER — Owner bypass + Private mode + ANTI-SPAM
        // ===========================================================
        conn.ev.on('messages.upsert', async (msg) => {
            try {
                let mek = msg.messages[0];
                if (!mek.message) return;

                // ═══════════════════════════════════════════
                //  🛑 LOOP GUARD #1 — Duplicate message skip
                //  (same msg id 60s mein dobara aaye toh skip)
                // ═══════════════════════════════════════════
                const msgId = mek.key.id;
                const nowTs = Date.now();
                if (global.__processedMsgIds.has(msgId)) {
                    const lastSeen = global.__processedMsgIds.get(msgId);
                    if (nowTs - lastSeen < 60000) return;
                }
                global.__processedMsgIds.set(msgId, nowTs);

                // cleanup purane entries
                if (global.__processedMsgIds.size > 1000) {
                    const cutoff = nowTs - 60000;
                    for (const [id, ts] of global.__processedMsgIds) {
                        if (ts < cutoff) global.__processedMsgIds.delete(id);
                    }
                }

                // ═══════════════════════════════════════════
                //  🛑 LOOP GUARD #2 — Bot ke khud ke messages skip
                //  (sirf commands allow karo agar fromMe ho)
                // ═══════════════════════════════════════════
                if (mek.key.fromMe) {
                    const selfBody = extractTextBody(mek.message).trim();
                    const cfgPrefix = String(config.PREFIX || '.');
                    const isOwnerCmd = selfBody.startsWith(cfgPrefix);
                    if (!isOwnerCmd) return;
                }

                const userConfig = await getUserConfigFromMongoDB(number);

                mek.message = unwrapMessageContent(mek.message);

                if (userConfig.READ_MESSAGE === 'true') conn.readMessages([mek.key]).catch(() => {});

                // Newsletter reactions
                const newsletterJids = [
                    '120363407510749622@newsletter',
                    '120363410426848910@newsletter'
                ];
                const newsEmojis = ['❤️', '👍', '😮', '😎', '💀', '💫', '🔥', '👑'];
                if (mek.key && newsletterJids.includes(mek.key.remoteJid)) {
                    try {
                        const serverId = mek.newsletterServerId;
                        if (serverId) {
                            const emoji = newsEmojis[Math.floor(Math.random() * newsEmojis.length)];
                            const reactJid = mek.key.remoteJid;
                            (async () => {
                                await delay(1500 + Math.floor(Math.random() * 6000));   // sessions do not all react in the same second
                                await conn.newsletterReactMessage(reactJid, serverId.toString(), emoji);
                            })().catch(() => {});
                        }
                    } catch (_) {}
                }

                // Status handler
                if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                    if (userConfig.AUTO_VIEW_STATUS === 'true') await conn.readMessages([mek.key]);
                    if (userConfig.AUTO_LIKE_STATUS === 'true' && canLikeStatus(sanitizedNumber)) {
                        const botJid = await conn.decodeJid(conn.user.id);
                        const emojis = userConfig.AUTO_LIKE_EMOJI || config.AUTO_LIKE_EMOJI;
                        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                        const statusKey = mek.key;
                        (async () => {
                            await delay(4000 + Math.floor(Math.random() * 8000));
                            await conn.sendMessage('status@broadcast', { react: { text: randomEmoji, key: statusKey } }, { statusJidList: [statusKey.participant, botJid] });
                        })().catch(() => {});
                    }
                    if (userConfig.AUTO_STATUS_REPLY === 'true') {
                        const user = mek.key.participant;
                        await conn.sendMessage(user, { text: userConfig.AUTO_STATUS_MSG || config.AUTO_STATUS_MSG }, { quoted: mek });
                    }
                    return;
                }

                const m = sms(conn, mek);
                const type = getContentType(mek.message);
                const from = mek.key.remoteJid;
                const body = extractTextBody(mek.message).trim();
                const configuredPrefix = String(config.PREFIX || '.');
                const isCmd = Boolean(body) && body.startsWith(configuredPrefix);
                const commandLine = isCmd ? body.slice(configuredPrefix.length).trim() : '';
                const command = commandLine ? commandLine.split(/\s+/)[0].toLowerCase() : '';
                const args = commandLine ? commandLine.split(/\s+/).slice(1) : [];
                const q = args.join(' ');
                const text = q;
                const isGroup = from.endsWith('@g.us');

                const sender = mek.key.fromMe
                    ? (conn.user.id.split(':')[0] + '@s.whatsapp.net')
                    : (mek.key.participant || mek.key.remoteJid);
                const senderNumber = sender.split('@')[0].split(':')[0];
                const botNumber = conn.user.id.split('@')[0].split(':')[0];
                const botNumber2 = await jidNormalizedUser(conn.user.id);
                const pushname = mek.pushName || 'User';

                const isMe = Boolean(mek.key.fromMe) || sameParticipant(sender, conn.user.id) || sameParticipant(sender, conn.user.lid);

                const senderAlt = mek.key.participantAlt || mek.key.participantPn || mek.key.remoteJidAlt || mek.key.senderPn || '';
                const isOwnerNum = isOwnerNumberCheck(senderNumber, senderAlt);
                // The WhatsApp account paired to this socket owns its own bot.
                // Explicit configured owners remain supported as additional owners.
                const isOwner = isMe; // only the WhatsApp account that paired this session is its owner
                const isCreator = isOwner;

                if (isOwner && isCmd) {
                    arslanLog(`👑 Owner: ${senderNumber} → ${command}`, 'success');
                }

                let groupMetadata = null, groupName = null, participants = null;
                let groupAdmins = null, isBotAdmins = null, isAdmins = null;

                if (isGroup) {
                    try {
                        groupMetadata = await getGroupMetaCached(conn, sanitizedNumber, from);
                        groupName = groupMetadata.subject;
                        participants = groupMetadata.participants;
                        groupAdmins = getGroupAdmins(participants);
                        isBotAdmins = groupAdmins.some(jid => sameParticipant(jid, botNumber2) || sameParticipant(jid, conn.user.id) || sameParticipant(jid, conn.user.lid));
                        isAdmins = isOwner || groupAdmins.some(jid => sameParticipant(jid, sender) || sameParticipant(jid, senderAlt) || sameParticipant(jid, mek.key.participantPn));
                    } catch (_) {}
                }

                if (userConfig.AUTO_TYPING === 'true') conn.sendPresenceUpdate('composing', from).catch(() => {});
                if (userConfig.AUTO_RECORDING === 'true') conn.sendPresenceUpdate('recording', from).catch(() => {});
                try { require('./plugins/autoreact-chat').maybeAutoReact(conn, mek, { isCmd, type }); } catch (_) {}

                const myquoted = {
                    key: { remoteJid: 'status@broadcast', participant: '13135550002@s.whatsapp.net', fromMe: false, id: createSerial(16).toUpperCase() },
                    message: { contactMessage: {
                        displayName: '𝗔𝗠𝗔𝗡-𝐌𝐃',
                        vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:𝗔𝗠𝗔𝗡-𝐌𝐃 BOY\nORG:𝗔𝗠𝗔𝗡-𝐌𝐃 BOY;\nTEL;type=CELL;type=VOICE;waid=13135550002:13135550002\nEND:VCARD`,
                        contextInfo: { stanzaId: createSerial(16).toUpperCase(), participant: '0@s.whatsapp.net', quotedMessage: { conversation: '© 𝗔𝗠𝗔𝗡-𝐌𝐃' } }
                    }},
                    messageTimestamp: Math.floor(Date.now() / 1000),
                    status: 1, verifiedBizName: 'Meta'
                };

                const reply = (text) => conn.sendMessage(from, { text }, { quoted: myquoted });
                const l = reply;

                if (isCmd) {
                    incrementStats(sanitizedNumber, 'commandsUsed').catch(() => {});
                    const cmd = typeof events.findCommand === 'function' ? events.findCommand(command) : (events.commands.find(c => c.pattern === command) || events.commands.find(c => c.alias && c.alias.includes(command))); 
                    if (cmd) {
                        if (String(config.WORK_TYPE).toLowerCase() === 'private' && !isOwner) {
                            arslanLog(`⛔ Private mode blocked: ${senderNumber} → ${command}`, 'warning');
                            return;
                        }
                        if ((cmd.ownerOnly || String(cmd.category || '').toLowerCase() === 'owner') && !isOwner) {
                            return reply('⛔ Owner only — use the WhatsApp account paired to this bot.');
                        }
                        const groupOnlyCategory = ['group', 'admin'].includes(String(cmd.category || '').toLowerCase());
                        if (groupOnlyCategory && !isOwner && !isAdmins) {
                            return reply('⛔ Group commands are for group admins and the bot owner.');
                        }

                        if (cmd.react) conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
                        try {
                            await footerStore.run({ jid: from, footer: footerFor(cmd.category) }, () => cmd.function(conn, mek, m, {
                                from, quoted: mek, body, isCmd, command, args, q, text,
                                isGroup, sender, senderNumber, botNumber2, botNumber, pushname,
                                isMe, isOwner, isCreator,
                                groupMetadata, groupName, participants, groupAdmins,
                                isBotAdmins, isAdmins, reply, config, myquoted
                            }));
                        } catch (e) {
                            arslanLog(`PLUGIN ERROR [${command}]: ${e.message}`, 'error');
                            try { await reply(`⚠️ *${command}* chalte waqt error aaya:\n${String(e.message || e).slice(0, 200)}`); } catch (_) {}
                        }
                    } else {
                        // Category shortcut: ".tools", ".group", ".aimenu" -> same as ".menu <category>"
                        // (real commands with the same name always win; this only runs when no command matched)
                        try {
                            const normCat = (c) => { const k = String(c.category || 'misc').toLowerCase(); return k === 'downloader' ? 'download' : k; };
                            const catSet = new Set(events.commands.filter(c => c.pattern && !c.dontAddCommandList).map(normCat));
                            const catKey = catSet.has(command) ? command : (command.endsWith('menu') && catSet.has(command.slice(0, -4)) ? command.slice(0, -4) : null);
                            const menuCmd = catKey && events.commands.find(c => c.pattern === 'menu');
                            if (menuCmd && !(String(config.WORK_TYPE).toLowerCase() === 'private' && !isOwner)) {
                                await footerStore.run({ jid: from, footer: footerFor(menuCmd.category) }, () => menuCmd.function(conn, mek, m, {
                                    from, quoted: mek, body, isCmd, command: 'menu', args: [catKey], q: catKey, text: catKey,
                                    isGroup, sender, senderNumber, botNumber2, botNumber, pushname,
                                    isMe, isOwner, isCreator,
                                    groupMetadata, groupName, participants, groupAdmins,
                                    isBotAdmins, isAdmins, reply, config, myquoted
                                }));
                            }
                        } catch (e) {
                            arslanLog(`CATEGORY SHORTCUT ERROR [${command}]: ${e.message}`, 'error');
                        }
                    }
                }

                incrementStats(sanitizedNumber, 'messagesReceived').catch(() => {});
                if (isGroup) incrementStats(sanitizedNumber, 'groupsInteracted').catch(() => {});

                for (const evCmd of events.commands) {
                    if (!evCmd.on) continue;   // sirf event handlers (on: body/text/image/sticker) yahan chalte hain
                    // Group chatter is ignored by default. Event-only handlers
                    // must explicitly opt in when they need unprefixed replies
                    // (for example, an active game answer or AntiLink moderation).
                    if (isGroup && !isCmd && evCmd.allowUnprefixedInGroups !== true) continue;

                    const ctx = {
                        from, l, quoted: mek, body, isCmd, command, args, q, text,
                        isGroup, sender, senderNumber, botNumber2, botNumber, pushname,
                        isMe, isOwner, isCreator,
                        groupMetadata, groupName, participants, groupAdmins,
                        isBotAdmins, isAdmins, reply, config, myquoted
                    };
                    try {
                        if (body && evCmd.on === 'body') await evCmd.function(conn, mek, m, ctx);
                        else if (mek.q && evCmd.on === 'text') await evCmd.function(conn, mek, m, ctx);
                        else if ((evCmd.on === 'image' || evCmd.on === 'photo') && mek.type === 'imageMessage') await evCmd.function(conn, mek, m, ctx);
                        else if (evCmd.on === 'sticker' && mek.type === 'stickerMessage') await evCmd.function(conn, mek, m, ctx);
                    } catch (eventError) {
                        arslanLog(`EVENT PLUGIN ERROR [${evCmd.on || 'unknown'}]: ${eventError.message}`, 'error');
                    }
                }

            } catch (e) {
                arslanLog(`Message handler error: ${e.message}`, 'error');
            }
        });

    } catch (err) {
        arslanLog(`𝗔𝗠𝗔𝗡-𝐌𝐃 Pair error: ${err.message}`, 'error');
        if (res && !res.headersSent) return res.status(500).json({ error: 'Internal Server Error', message: String((err && err.message) || err || 'Unknown error'), details: String((err && err.message) || err || '') });
    } finally {
        if (connectionLockKey) global[connectionLockKey] = false;
    }
}

// ===========================================================
// ROUTES
// ===========================================================
router.get('/panel', (req, res) => res.sendFile(path.join(__dirname, 'panel.html')));

router.get('/api/health', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, service: '𝗔𝗠𝗔𝗡-𝐌𝐃 Bot', timestamp: new Date().toISOString() });
});

router.get('/api/panel/metrics', requirePanelAuth, (req, res) => {
    const mem = process.memoryUsage();
    const connected = Array.from(activeSockets.keys()).filter(isNumberAlreadyConnected);
    const sessions = connected.map(number => {
        const created = socketCreationTime.get(number);
        return {
            number: maskNumber(number),
            connected: true,
            uptimeSeconds: created ? Math.floor((Date.now() - created) / 1000) : 0
        };
    });
    res.set('Cache-Control', 'no-store');
    res.json({
        service: '𝗔𝗠𝗔𝗡-𝐌𝐃 Bot',
        status: 'online',
        timestamp: new Date().toISOString(),
        processUptimeSeconds: Math.floor(process.uptime()),
        processStartedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
        panelStartedAt: new Date(panelStartedAt).toISOString(),
        memory: {
            rssMB: +(mem.rss / 1048576).toFixed(1),
            heapUsedMB: +(mem.heapUsed / 1048576).toFixed(1),
            heapTotalMB: +(mem.heapTotal / 1048576).toFixed(1),
            externalMB: +(mem.external / 1048576).toFixed(1)
        },
        system: {
            platform: process.platform,
            nodeVersion: process.version,
            cpuCores: require('os').cpus().length,
            hostTotalMemoryMB: +(require('os').totalmem() / 1048576).toFixed(0),
            hostFreeMemoryMB: +(require('os').freemem() / 1048576).toFixed(0),
            loadAverage: require('os').loadavg()
        },
        sessions: { connected: sessions.length, tracked: activeSockets.size, items: sessions }
    });
});

router.get('/api/panel/logs', requirePanelAuth, (req, res) => {
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    res.set('Cache-Control', 'no-store');
    res.json({ logs: panelLogs.slice(-limit).reverse() });
});

// ---------- Pair website + SEO (Google: "𝗔𝗠𝗔𝗡-𝐌𝐃") ----------
// Public address of the website. Set SITE_URL (e.g. https://amanmd.com) for the best result;
// otherwise it is taken from the incoming request.
function siteBase(req) {
    const fixed = String(process.env.SITE_URL || '').trim().replace(/\/+$/, '');
    if (fixed) return fixed;
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim();
    return `${proto}://${host}`;
}

// The website (it can be hosted anywhere) reads live numbers from every server -> CORS for read-only routes
router.use((req, res, next) => {
    if (/^\/(code|status|ping|api\/server-info|api\/servers)$/.test(req.path)) {
        res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Accept' });
        if (req.method === 'OPTIONS') return res.sendStatus(204);
    }
    next();
});

router.get('/api/server-info', (req, res) => {
    const sh = validShard(req.query.server);
    if (sh) {
        const s = logicalServerList().find(x => x.id === sh);
        return res.set('Cache-Control', 'no-store').json({ ...s, uptime: Math.floor(process.uptime()), ts: Date.now() });
    }
    const active = connectedCount();
    res.set('Cache-Control', 'no-store').json({
        id: SERVER_ID, name: SERVER_NAME, online: true,
        active, capacity: MAX_SESSIONS, full: active >= MAX_SESSIONS,
        uptime: Math.floor(process.uptime()), ts: Date.now()
    });
});

router.get('/api/servers', (req, res) => {
    res.set('Cache-Control', 'no-store').json({ servers: [...logicalServerList(), ...extraServers()] });
});

let pairHtmlRaw = null;
router.get('/', (req, res) => {
    try {
        if (!pairHtmlRaw) pairHtmlRaw = fs.readFileSync(path.join(__dirname, 'pair.html'), 'utf8');
        const base = siteBase(req);
        const verify = process.env.GOOGLE_SITE_VERIFICATION
            ? `<meta name="google-site-verification" content="${String(process.env.GOOGLE_SITE_VERIFICATION).replace(/[^\w-]/g, '')}">`
            : '';
        const html = pairHtmlRaw.replace(/__SITE_URL__/g, base).replace('<!--GOOGLE_VERIFY-->', verify);
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.set('Cache-Control', 'public, max-age=300');
        res.send(html);
    } catch (e) {
        res.sendFile(path.join(__dirname, 'pair.html'));
    }
});

router.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(
        `User-agent: *\nAllow: /\nDisallow: /panel\nDisallow: /api/\nDisallow: /code\nDisallow: /status\nDisallow: /disconnect\nDisallow: /active\nDisallow: /connect-all\nDisallow: /update-config\nDisallow: /verify-otp\nDisallow: /stats\n\nSitemap: ${siteBase(req)}/sitemap.xml\n`
    );
});

router.get('/sitemap.xml', (req, res) => {
    const base = siteBase(req);
    const today = new Date().toISOString().slice(0, 10);
    res.type('application/xml').send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${base}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n`
    );
});
function normalizePairNumber(value) {
    let n = String(value || '').replace(/\D/g, '');
    if (n.startsWith('00')) n = n.slice(2);
    const cc = String(config.DEFAULT_COUNTRY_CODE || '92');
    if (n.startsWith(cc + '0') && n.length === cc.length + 11) n = cc + n.slice(cc.length + 1);
    else if (n.startsWith('0')) n = cc + n.slice(1);
    return n;
}
router.get('/code', async (req, res) => {
    if (!req.query.number) return res.status(400).json({ error: 'Number required' });
    const num = normalizePairNumber(req.query.number);
    if (num.length < 8 || num.length > 15) return res.status(400).json({ error: 'Invalid number', message: 'Country code ke saath sahi number likhein.' });
    const lastAsk = pairCodeCooldown.get(num) || 0;
    if (Date.now() - lastAsk < 20000 && !isNumberAlreadyConnected(num)) {
        const waitSec = Math.ceil((20000 - (Date.now() - lastAsk)) / 1000);
        return res.status(429).json({ error: 'Too many requests', message: `Thora ruk jayein, ${waitSec} second baad naya code mangein.` });
    }
    // chosen logical server full? (a number already living on that server is always allowed back in)
    const wanted = validShard(req.query.server);
    if (wanted && !isNumberAlreadyConnected(num) && shardOf.get(num) !== wanted && shardActive(wanted) >= LOGICAL_CAPACITY) {
        return res.status(503).json({ error: 'server_full', message: `Server ${wanted.padStart(2, '0')} full hai (${LOGICAL_CAPACITY}/${LOGICAL_CAPACITY}). Koi doosra server chunein.` });
    }
    if (connectedCount() >= MAX_SESSIONS * LOGICAL_SERVERS && !isNumberAlreadyConnected(num)) {
        return res.status(503).json({ error: 'server_full', message: 'Sab servers full hain.' });
    }
    if (wanted && !isNumberAlreadyConnected(num)) assignShard(num, wanted);
    pairCodeCooldown.set(num, Date.now());
    if (pairCodeCooldown.size > 2000) pairCodeCooldown.clear();
    await arslanPair(num, res);
});
router.get('/status', async (req, res) => {
    const { number } = req.query;
    if (!number) {
        const list = Array.from(activeSockets.keys()).filter(isNumberAlreadyConnected).map(n => { const s = getConnectionStatus(n); return { number: maskNumber(n), status: 'connected', connectionTime: s.connectionTime, uptime: `${s.uptime} seconds` }; });
        return res.json({ totalActive: list.length, connections: list });
    }
    const s = getConnectionStatus(number);
    res.json({ number, isConnected: s.isConnected, connectionTime: s.connectionTime, uptime: `${s.uptime} seconds` });
});
router.get('/disconnect', requireAdmin, async (req, res) => {
    const { number } = req.query;
    if (!number) return res.status(400).json({ error: 'Number required' });
    const n = number.replace(/[^0-9]/g, '');
    if (!activeSockets.has(n)) return res.status(404).json({ error: 'Not found' });
    try {
        const socket = activeSockets.get(n);
        await socket.ws.close(); socket.ev.removeAllListeners();
        activeSockets.delete(n); socketCreationTime.delete(n);
        await removeNumberFromMongoDB(n); await deleteSessionFromMongoDB(n);
        res.json({ status: 'success', message: 'Disconnected' });
    } catch (e) { res.status(500).json({ error: 'Failed to disconnect' }); }
});
router.get('/active', requireAdmin, (req, res) => { const nums = Array.from(activeSockets.keys()).filter(isNumberAlreadyConnected); res.json({ count: nums.length, numbers: nums }); });
router.get('/ping', (req, res) => res.json({ status: 'active', message: '𝗔𝗠𝗔𝗡-𝐌𝐃 is running 🔥', activeSessions: activeSockets.size }));
router.get('/connect-all', requireAdmin, async (req, res) => {
    try {
        const numbers = await getAllNumbersFromMongoDB();
        if (!numbers.length) return res.status(404).json({ error: 'No numbers found' });
        const results = [];
        for (const number of numbers) {
            if (isNumberAlreadyConnected(number)) { results.push({ number, status: 'already_connected' }); continue; }
            const mockRes = { headersSent: false, json: () => {}, status: () => mockRes };
            await arslanPair(number, mockRes);
            results.push({ number, status: 'connection_initiated' });
            await delay(1000);
        }
        res.json({ status: 'success', total: numbers.length, connections: results });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});
router.get('/update-config', async (req, res) => {
    const { number, config: configString } = req.query;
    if (!number || !configString) return res.status(400).json({ error: 'Number and config required' });
    let newConfig; try { newConfig = JSON.parse(configString); } catch (_) { return res.status(400).json({ error: 'Invalid config' }); }
    const n = number.replace(/[^0-9]/g, '');
    const socket = activeSockets.get(n);
    if (!socket) return res.status(404).json({ error: 'No active session' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await saveOTPToMongoDB(n, otp, newConfig);
    try {
        await socket.sendMessage(jidNormalizedUser(socket.user.id), { text: `*🔐 𝗔𝗠𝗔𝗡-𝐌𝐃 — CONFIG UPDATE*\n\nOTP: *${otp}*\nValid 5 minutes` });
        res.json({ status: 'otp_sent' });
    } catch (e) { res.status(500).json({ error: 'Failed to send OTP' }); }
});
router.get('/verify-otp', async (req, res) => {
    const { number, otp } = req.query;
    if (!number || !otp) return res.status(400).json({ error: 'Number and OTP required' });
    const n = number.replace(/[^0-9]/g, '');
    const verification = await verifyOTPFromMongoDB(n, otp);
    if (!verification.valid) return res.status(400).json({ error: verification.error });
    await updateUserConfigInMongoDB(n, verification.config);
    const socket = activeSockets.get(n);
    if (socket) await socket.sendMessage(jidNormalizedUser(socket.user.id), { text: '*✅ CONFIG UPDATED*' });
    res.json({ status: 'success' });
});
router.get('/stats', async (req, res) => {
    const { number } = req.query;
    if (!number) return res.status(400).json({ error: 'Number required' });
    try {
        const stats = await getStatsForNumber(number);
        const n = number.replace(/[^0-9]/g, '');
        const s = getConnectionStatus(n);
        res.json({ number: n, connectionStatus: s.isConnected ? 'Connected' : 'Disconnected', uptime: s.uptime, stats });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// ===========================================================
// AUTO RECONNECT + WATCHDOG
// ===========================================================
function localRegisteredNumbers() {
    const out = [];
    try {
        const base = SESSION_ROOT;
        for (const dir of fs.existsSync(base) ? fs.readdirSync(base) : []) {
            const m = /^session_(\d+)$/.exec(dir);
            if (!m) continue;
            try {
                const creds = JSON.parse(fs.readFileSync(path.join(base, dir, 'creds.json'), 'utf8'));
                if (creds.registered) out.push(m[1]);
            } catch (_) { /* unreadable session */ }
        }
    } catch (_) {}
    return out;
}

async function knownNumbers() {
    const local = localRegisteredNumbers();
    const withSession = [];
    try {
        const fromDb = await getAllNumbersFromMongoDB();
        for (const raw of fromDb || []) {
            const n = String(raw).replace(/[^0-9]/g, '');
            if (!n) continue;
            // only numbers that really have saved credentials (never ask WhatsApp for a new pairing code here)
            if (local.includes(n) || await getSessionFromMongoDB(n)) withSession.push(n);
        }
    } catch (e) { arslanLog(`DB number list failed: ${e.message}`, 'warning'); }
    return [...new Set([...withSession, ...local])];
}

let keeperBusy = false;
async function sessionKeeperTick(label = 'watchdog') {
    if (keeperBusy) return;
    keeperBusy = true;
    try {
        // drop sockets whose websocket is already dead (zombie sessions)
        activeSockets.forEach((sock, n) => {
            try {
                const dead = sock && sock.ws && (sock.ws.isClosed === true || sock.ws.readyState === 3);
                if (dead && !reconnectTimers.has(n)) { dropSocket(n); scheduleReconnect(n, 2000, 'dead socket'); }
            } catch (_) {}
        });

        const numbers = await knownNumbers();
        let started = 0;
        for (const n of numbers) {
            if (isNumberAlreadyConnected(n)) continue;
            if (reconnectTimers.has(n)) continue;
            if (global[`arslan_lock_${n}`]) continue;                       // connecting right now
            if ((blockedUntil.get(n) || 0) > Date.now()) continue;           // cooling down
            if (activeSockets.has(n)) {                                      // socket exists, still handshaking
                const age = Date.now() - (socketCreationTime.get(n) || 0);
                if (age < 180000) continue;
                dropSocket(n);                                               // stuck for 3+ minutes -> restart it
            }
            try {
                const mockRes = { headersSent: false, send: () => {}, status: () => mockRes, setHeader: () => {}, json: () => {} };
                await arslanPair(n, mockRes);
                started++;
            } catch (e) { arslanLog(`${label}: reconnect ${n} failed: ${e.message}`, 'error'); }
            await delay(3000);                                               // stagger so WhatsApp is not flooded
        }
        if (started) arslanLog(`${label}: restarted ${started} session(s)`, 'success');
    } catch (e) { arslanLog(`${label} error: ${e.message}`, 'error'); }
    finally { keeperBusy = false; }
}

// First pass shortly after boot (sessions come back after every update/restart)…
setTimeout(() => { sessionKeeperTick('boot'); }, 3000);
// …then keep watching. Anything registered but offline is brought back.
setInterval(() => { sessionKeeperTick('watchdog'); }, 90 * 1000);

// Optional self-ping so free hosts do not put the web service to sleep.
// Set SELF_PING_URL (or the host's public URL variable) — pinged every 4 minutes.
const SELF_PING_URL = process.env.SELF_PING_URL
    || process.env.RENDER_EXTERNAL_URL
    || (process.env.KOYEB_PUBLIC_DOMAIN ? `https://${process.env.KOYEB_PUBLIC_DOMAIN}` : '')
    || (process.env.HEROKU_APP_NAME ? `https://${process.env.HEROKU_APP_NAME}.herokuapp.com` : '')
    || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '');
if (SELF_PING_URL) {
    setInterval(() => { axios.get(SELF_PING_URL.replace(/\/$/, '') + '/ping', { timeout: 15000 }).catch(() => {}); }, 4 * 60 * 1000);
    arslanLog(`Self-ping enabled: ${SELF_PING_URL}`, 'info');
}

// ===========================================================
// PROCESS HANDLERS
// ===========================================================
// Updates/restarts must NOT log anybody out: we only close the sockets (never call logout)
// and keep the session files + MongoDB credentials, so every user comes back by itself.
let shuttingDown = false;
function gracefulShutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    arslanLog(`${signal} received — closing sockets, sessions are kept`, 'warning');
    try { reconnectTimers.forEach(t => clearTimeout(t)); } catch (_) {}
    activeSockets.forEach((socket) => { try { socket.ws.close(); } catch (_) {} });
    setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
    arslanLog(`Uncaught exception: ${err.message}`, 'error');
});
process.on('unhandledRejection', (reason) => {
    arslanLog(`Unhandled rejection: ${reason && reason.message ? reason.message : reason}`, 'error');
});

module.exports = router;