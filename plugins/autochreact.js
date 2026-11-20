const { cmd } = require('../arslan');
const config = require('../config');
const reactor = require('../lib/reactor');
const store = require('../lib/auto-chreact');
const { isBotHost } = require('../lib/premium-check');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function splitEmojis(str) {
    try {
        const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
        return [...seg.segment(str)].map(s => s.segment).filter(e => /\S/.test(e));
    } catch { return Array.from(str).filter(e => /\S/.test(e)); }
}

cmd({
  pattern: 'autochreact',
  alias: ['autochannelreact', 'acr'],
  desc: 'Meri channel post par saare connected bots auto react karein',
  category: 'tools',
  react: '💫',
  use: '.autochreact add <channel link> | remove | list | on | off | emoji ❤️ 🔥',
  filename: __filename
}, async (conn, mek, m, ctx) => {
  const P = config.PREFIX || '.';
  if (!isBotHost(ctx)) return ctx.reply('*❌ Ye command sirf bot owner ke liye hai.*');

  const args = (ctx.q || '').trim().split(/\s+/).filter(Boolean);
  const sub = (args[0] || '').toLowerCase();
  const st = store.get();

  if (!sub || sub === 'list' || sub === 'status') {
    return ctx.reply(
`💫 *AUTO CHANNEL REACT*
Status : *${st.enabled ? 'ON ✅' : 'OFF ⛔'}*
Connected bots : *${global.activeSockets ? global.activeSockets.size : 0}*

📢 Channels (${st.channels.length}):
${st.channels.map((j, i) => `${i + 1}. \`${j}\``).join('\n') || '— koi nahi —'}

😀 Emojis: ${st.emojis.join(' ')}

*Commands*
${P}autochreact add <channel link>
${P}autochreact remove <channel link / jid>
${P}autochreact emoji ❤️ 🔥 😍
${P}autochreact on / off`);
  }

  if (sub === 'on' || sub === 'off') {
    store.setEnabled(sub === 'on');
    return ctx.reply(`💫 Auto channel react *${sub.toUpperCase()}* ho gaya.`);
  }

  if (sub === 'emoji' || sub === 'emojis') {
    const list = splitEmojis(args.slice(1).join(''));
    if (!list.length) return ctx.reply(`❌ Emoji do.\nExample: *${P}autochreact emoji ❤️ 🔥 😍*`);
    store.setEmojis(list.slice(0, 30));
    return ctx.reply(`✅ Emojis set: ${store.get().emojis.join(' ')}`);
  }

  if (sub === 'add' || sub === 'remove' || sub === 'del') {
    const target = args[1];
    if (!target) return ctx.reply(`❌ Channel link ya JID do.\nExample: *${P}autochreact add https://whatsapp.com/channel/XXXX*`);

    let jid = /@newsletter$/i.test(target) ? target : null;
    if (!jid) {
      const r = await reactor.resolveChannelLink(conn, target);
      if (!r.ok) return ctx.reply(`❌ Channel resolve nahi hua: ${r.error}`);
      jid = r.channelJid;
    }

    if (sub !== 'add') {
      store.removeChannel(jid);
      return ctx.reply(`🗑️ Remove ho gaya: \`${jid}\``);
    }

    store.addChannel(jid);
    await ctx.reply(`✅ Channel add ho gaya: \`${jid}\`\n⏳ Ab saare connected bots ko ye channel follow karwa raha hoon (posts receive karne ke liye)...`);

    // Jo session channel follow nahi karta use post ka update hi nahi milta, isliye sab ko follow karwao
    let ok = 0, fail = 0;
    for (const sock of (global.activeSockets ? global.activeSockets.values() : [])) {
      try {
        if (typeof sock.newsletterFollow === 'function') { await sock.newsletterFollow(jid); ok++; }
      } catch (_) { fail++; }
      await sleep(1200);
    }
    return ctx.reply(`📢 Follow done — ✅ ${ok} | ❌ ${fail}\nAb is channel ki har nayi post par saare bots auto react karenge.`);
  }

  return ctx.reply(`❌ Samajh nahi aaya. *${P}autochreact* likh kar help dekho.`);
});
