const { cmd } = require('../arslan');
const { getMode, setMode } = require('../lib/antidelete');

const num = (j) => String(j || '').split('@')[0].split(':')[0];

// .delete on / off / dm  -> Anti-Delete (delete hue messages wapas aayein)  [owner]
// .delete status         -> Anti-Delete ka status
// .delete (kisi message par reply karke) -> wo message sab ke liye delete
// Group mein dusron ke message delete karne ke liye bot ka admin hona zaroori hai.
cmd({
  pattern: 'delete',
  alias: ['del', 'dlt', 'dd'],
  desc: 'Delete on/off (anti-delete) + reply karke message delete',
  category: 'tools',
  react: '🗑️',
  use: '.delete on | off | dm | (reply karke)',
  filename: __filename
}, async (conn, mek, m, { from, q, isGroup, isOwner, isCreator, isAdmins, isBotAdmins, reply }) => {
  try {
    // ---- ON / OFF toggle (Anti-Delete) ----
    const a = String(q || '').trim().split(/\s+/)[0].toLowerCase();
    if (['on', 'off', 'dm', 'enable', 'disable', 'status'].includes(a)) {
      if (!(isOwner || isCreator)) return reply('*⛔ Ye setting sirf bot owner badal sakta hai.*');
      const label = { on: '🟢 ON (usi chat mein)', dm: '🟢 ON (sirf aap ke DM mein)', off: '🔴 OFF' };
      if (a === 'status') return reply(`*🗑️ DELETE (Anti-Delete):* ${label[getMode(conn)]}`);
      const mode = (a === 'enable') ? 'on' : (a === 'disable') ? 'off' : a;
      return setMode(conn, mode)
        ? reply(`*🗑️ DELETE ${mode.toUpperCase()} ho gaya*\n${label[mode]}\n\nDelete hua message ${mode === 'dm' ? 'sirf aap ke DM mein' : mode === 'on' ? 'usi chat mein' : 'ab wapas nahi aayega'}.`)
        : reply('❌ Save nahi hua.');
    }

    const ctxInfo = mek.message?.extendedTextMessage?.contextInfo
      || Object.values(mek.message || {}).map(v => v?.contextInfo).find(Boolean)
      || {};
    const stanzaId = ctxInfo.stanzaId;
    if (!stanzaId) return reply(`*🗑️ DELETE*\n\n• *.delete on* — delete hue messages wapas aayein\n• *.delete dm* — wapas sirf mere DM mein aayein\n• *.delete off* — band\n• *.delete status* — abhi ki setting: ${({ on: 'ON', dm: 'ON (DM)', off: 'OFF' })[getMode(conn)] || 'OFF'}\n• Kisi message par reply karke *.delete* — wo message delete`);

    const botIds = [conn.user?.id, conn.user?.lid].filter(Boolean).map(num);
    const author = ctxInfo.participant || (isGroup ? '' : from);
    const isBotMsg = botIds.includes(num(author));

    // Permission: owner hamesha; group mein admin bhi
    const allowed = isOwner || isCreator || (isGroup && isAdmins);
    if (!allowed) return reply('*⛔ Ye command sirf owner ya group admin ke liye hai.*');

    // Dusron ka message group mein delete karne ke liye bot admin hona chahiye
    if (isGroup && !isBotMsg && !isBotAdmins) {
      return reply('*⚠️ Bot ko pehle group admin banao, tab hi dusron ke messages delete honge.*');
    }
    // Private chat mein WhatsApp dusre ka message sab ke liye delete nahi karne deta
    if (!isGroup && !isBotMsg) {
      return reply('*⚠️ Private chat mein sirf bot ke apne bheje hue messages delete ho sakte hain.*');
    }

    const key = { remoteJid: from, id: stanzaId, fromMe: isBotMsg };
    if (isGroup && author) key.participant = author;

    await conn.sendMessage(from, { delete: key });
    // command wala message bhi saaf kar do (agar delete ho sake)
    try { await conn.sendMessage(from, { delete: mek.key }); } catch (_) {}
  } catch (e) {
    console.error('Delete Error:', e.message);
    return reply('*❌ Message delete nahi ho saka.*');
  }
});
