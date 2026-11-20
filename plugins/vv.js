const { cmd } = require('../arslan')
const { downloadContentFromMessage, downloadMediaMessage, jidNormalizedUser } = require('@whiskeysockets/baileys')

const SHORT_WORDS = new Set(['ok', 'theek', 'nice', 'good', 'acha', 'sahi', 'thanks'])
const WRAPPERS = ['viewOnceMessageV2', 'viewOnceMessageV2Extension', 'viewOnceMessage']
const OTHER_WRAPPERS = ['ephemeralMessage', 'documentWithCaptionMessage']

const unwrap = (message) => {
    let msg = message
    let viewOnce = false
    for (let i = 0; i < 6 && msg; i++) {
        let inner = null
        for (const k of WRAPPERS) if (msg[k]?.message) { inner = msg[k].message; viewOnce = true; break }
        if (!inner) for (const k of OTHER_WRAPPERS) if (msg[k]?.message) { inner = msg[k].message; break }
        if (!inner) break
        msg = inner
    }
    return { msg, viewOnce }
}

const ownerJid = (conn) => {
    try { return jidNormalizedUser(conn.user.id) } catch (_) {}
    return String((conn.user && conn.user.id) || '').split(':')[0].split('@')[0] + '@s.whatsapp.net'
}

// mediaKey kabhi Buffer ki jagah base64 / {type:'Buffer'} / plain object ban jati hai -> download fail. Sab ko Buffer banao.
const toBuf = (v) => {
    if (!v) return v
    if (Buffer.isBuffer(v) || v instanceof Uint8Array) return Buffer.from(v)
    if (typeof v === 'string') return Buffer.from(v, 'base64')
    if (v.type === 'Buffer' && Array.isArray(v.data)) return Buffer.from(v.data)
    if (typeof v === 'object') {
        const vals = Object.values(v)
        if (vals.length && vals.every(n => typeof n === 'number')) return Buffer.from(vals)
    }
    return v
}
const fixMedia = (media) => {
    const out = { ...media }
    for (const k of ['mediaKey', 'fileSha256', 'fileEncSha256']) if (out[k]) out[k] = toBuf(out[k])
    if (!out.url && out.directPath) out.url = 'https://mmg.whatsapp.net' + out.directPath
    return out
}

// raw message se contextInfo nikalo (framework ka stripped version nahi)
const getCtx = (mek) => {
    let msg = mek?.message
    for (let i = 0; i < 4 && msg; i++) {
        for (const k of Object.keys(msg)) {
            if (msg[k]?.contextInfo?.quotedMessage) return msg[k].contextInfo
        }
        msg = msg.ephemeralMessage?.message
    }
    return null
}

const prettyFrom = (ctx, m, from) => {
    const p = ctx?.participant || (m.quoted && (m.quoted.sender || m.quoted.participant)) || ''
    const num = String(p || from).split('@')[0].split(':')[0]
    return from.endsWith('@g.us') ? `${num} (group)` : num
}

cmd({
    pattern: "vv",
    alias: ["viewonce", "view", "open", "savevo", ...SHORT_WORDS],
    desc: "Retrieve view-once media into your own DM (Owner only)",
    category: "owner",
    filename: __filename
},
async (conn, mek, m, { from, isCreator, reply, command }) => {
    const word = String(command || 'vv').toLowerCase()
    const quiet = SHORT_WORDS.has(word)
    const me = ownerJid(conn)
    try {
        if (!isCreator) {
            if (!quiet) return reply("*YEH COMMAND SIRF BOT OWNER KE LIYE HAI 😎*")
            return
        }

        const ctx = getCtx(mek)
        const rawQuoted = ctx?.quotedMessage || m.quoted?.message || m.quoted?.msg
        if (!rawQuoted) {
            if (quiet) return
            return reply("*🥺 KISI VIEW ONCE PHOTO / VIDEO / AUDIO KO REPLY KARO*")
        }

        const { msg, viewOnce } = unwrap(rawQuoted)
        const type = Object.keys(msg || {}).find(k => /^(image|video|audio)Message$/.test(k))
        const isVO = viewOnce || (type && msg[type] && msg[type].viewOnce === true)

        if (quiet && (!type || !isVO)) return
        if (!type) return reply("*❌ YE VIEW ONCE MEDIA SUPPORT NAHI KARTA 🥺*")

        const media = fixMedia(msg[type])
        const kind = type.replace('Message', '')

        // DEBUG: terminal mein dekho media mein kya kya hai
        console.log("VV DEBUG type:", type, "| keys:", Object.keys(media), "| url:", !!media.url, "| directPath:", !!media.directPath, "| mediaKey:", !!media.mediaKey)

        if (!quiet) conn.sendMessage(from, { react: { text: '🥺', key: mek.key } }).catch(() => {})

        let buffer
        const why = []
        // 1) normal download
        try {
            const stream = await downloadContentFromMessage(media, kind)
            const chunks = []
            for await (const c of stream) chunks.push(c)
            buffer = Buffer.concat(chunks)
        } catch (e1) {
            why.push("1: " + e1.message); console.log("VV fallback 1 (downloadContentFromMessage) fail:", e1.message)
        }
        // 2) downloadMediaMessage with full fake message
        if (!buffer || !buffer.length) {
            try {
                const fake = {
                    key: { remoteJid: from, id: ctx?.stanzaId, participant: ctx?.participant, fromMe: false },
                    message: { [type]: media }
                }
                buffer = await downloadMediaMessage(fake, 'buffer', {}, {
                    logger: console,
                    reuploadRequest: conn.updateMediaMessage
                })
            } catch (e2) {
                why.push("2: " + e2.message); console.log("VV fallback 2 (downloadMediaMessage) fail:", e2.message)
            }
        }
        // 3) framework ka apna download
        if (!buffer || !buffer.length) {
            try {
                if (m.quoted && typeof m.quoted.download === 'function') buffer = await m.quoted.download()
            } catch (e3) {
                why.push("3: " + e3.message); console.log("VV fallback 3 (m.quoted.download) fail:", e3.message)
            }
        }
        if (!buffer || !buffer.length) {
            const info = `type=${type} mediaKey=${!!media.mediaKey} directPath=${!!media.directPath} url=${!!media.url}`
            throw new Error((!media.mediaKey ? "WhatsApp ne is reply me media key nahi di (media strip ho gayi). " : "Download fail: media khul/expire ho chuki ho sakti hai. ") + info + (why.length ? " | " + why.join(" | ") : ""))
        }

        const caption = ((media.caption || "") + `\n\n👁️ From: ${prettyFrom(ctx, m, from)}`).trim()
        let content
        if (kind === 'image') content = { image: buffer, caption }
        else if (kind === 'video') content = { video: buffer, caption, mimetype: media.mimetype || 'video/mp4' }
        else content = { audio: buffer, mimetype: media.mimetype || "audio/mp4", ptt: false }

        await conn.sendMessage(me, content)
        if (!quiet) conn.sendMessage(from, { react: { text: '✅', key: mek.key } }).catch(() => {})
        if (kind === 'audio') await conn.sendMessage(me, { text: `👁️ Voice/audio from: ${prettyFrom(ctx, m, from)}` })
    } catch (e) {
        console.log("VV ERROR:", e)
        const errText = "*❌ VIEW ONCE OPEN KARNE ME ERROR AYA 🥺*\n_" + (e.message || e) + "_"
        try { await conn.sendMessage(me, { text: errText }) } catch (_) {}
        if (!quiet && from !== me) { try { await conn.sendMessage(from, { text: errText }, { quoted: mek }) } catch (_) {} }
    }
})
