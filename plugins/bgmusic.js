// plugins/bgmusic.js — .bgmusic on | off  (owner only)
// ON hone par .tts / .jarvis / .raju / .aivoice ki har voice ke peeche assets/bgmusic/ ki music chalti hai.

const { cmd } = require('../arslan');
const bg = require('../lib/bgmusic');

const word = (v) => (v ? 'ON ✅' : 'OFF ❌');

cmd({
    pattern: 'bgmusic',
    alias: ['bgm', 'voicemusic'],
    desc: 'Voice ke background par music on/off aur volume (1-10)',
    use: '.bgmusic on | .bgmusic off | .bgmusic vol 5',
    category: 'settings',
    ownerOnly: true,
    react: '🎵',
    filename: __filename
}, async (conn, mek, m, { args, isOwner, reply, botNumber, config }) => {
    if (!isOwner) return reply('🚫 Owner only!');
    const P = (config && config.PREFIX) || '.';
    const val = String(args[0] || '').toLowerCase();
    const cur = await bg.isOn(conn, botNumber);
    const level = await bg.getLevel(conn, botNumber);
    const count = bg.tracks().length;

    if (['vol', 'volume', 'v'].includes(val)) {
        const n = parseInt(args[1], 10);
        if (!(n >= 1 && n <= 10)) {
            return reply(`🔊 Music volume abhi: *${level}/10*\n\n${P}bgmusic vol 1  — bohat halki\n${P}bgmusic vol 5  — medium\n${P}bgmusic vol 10 — tez\n\n_1 se 10 tak number likho._`);
        }
        try {
            await bg.setLevel(conn, botNumber, n);
            return reply(`🔊 Music volume ab *${n}/10*` + (cur ? '' : `\n\n_Music abhi OFF hai, ${P}bgmusic on likho._`));
        } catch (e) {
            return reply('❌ Save nahi hua: ' + (e && e.message));
        }
    }

    if (!['on', 'off', 'true', 'false', '1', '0'].includes(val)) {
        return reply(
            `🎵 *VOICE BACKGROUND MUSIC*\n\n` +
            `Abhi: *${word(cur)}*\n` +
            `Volume: *${level}/10*\n` +
            `Music files: *${count}*\n\n` +
            `${P}bgmusic on  — voice ke peeche music\n` +
            `${P}bgmusic off — sirf voice\n` +
            `${P}bgmusic vol 5 — music ki awaaz (1-10)`
        );
    }

    const on = ['on', 'true', '1'].includes(val);
    if (on && !count) return reply('❌ assets/bgmusic/ folder mein koi music file nahi mili.');
    try {
        await bg.setOn(conn, botNumber, on);
        return reply(
            `🎵 Background music ab *${word(on)}*` +
            (on ? `\nVolume: *${level}/10*\n\n_.tts, .jarvis, .raju aur .aivoice ki har voice par ${count} mein se random music lagegi._` : '')
        );
    } catch (e) {
        return reply('❌ Save nahi hua: ' + (e && e.message));
    }
});
