// lib/copybtn.js — tappable "Copy" button (WhatsApp native-flow cta_copy) jo baqi replies jaisa
// frame (┋✯┣═━❲ TITLE ❳) aur footer (©Powerd By ...) use karta hai.
// Interactive message sendMessage se nahi jata, isliye main.js ka frame/footer yahan khud lagate hain.
const { frameText } = require('./frame');

const { FOOTER_POWERED } = require('../aman');

// Returns true agar button wala message chala gaya, warna false (caller plain reply bheje).
async function sendCopyButton(conn, jid, quoted, { body, title, copy, label, id }) {
    try {
        const { proto, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
        const IM = proto.Message.InteractiveMessage;
        const interactive = IM.create({
            body: IM.Body.create({ text: frameText(String(body || ''), title) }),
            footer: IM.Footer.create({ text: FOOTER_POWERED }),
            header: IM.Header.fromObject({ title: '', subtitle: '', hasMediaAttachment: false }),
            nativeFlowMessage: IM.NativeFlowMessage.fromObject({
                buttons: [{
                    name: 'cta_copy',
                    buttonParamsJson: JSON.stringify({ display_text: label || '📋 Copy', id: id || 'copy_text', copy_code: String(copy) })
                }]
            })
        });
        const msg = generateWAMessageFromContent(jid, {
            viewOnceMessage: { message: { messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 }, interactiveMessage: interactive } }
        }, { quoted, userJid: conn.user && conn.user.id });
        await conn.relayMessage(jid, msg.message, {
            messageId: msg.key.id,
            additionalNodes: [{
                tag: 'biz', attrs: {},
                content: [{ tag: 'interactive', attrs: { type: 'native_flow', v: '1' },
                    content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }] }]
            }]
        });
        return true;
    } catch (e) {
        console.error('[COPYBTN] failed:', e && e.message);
        return false;
    }
}

module.exports = { sendCopyButton, FOOTER_POWERED };
