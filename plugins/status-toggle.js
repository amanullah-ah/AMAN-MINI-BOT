// plugins/status-toggle.js — .status command (owner only)
//   .status              -> view / like ki current state
//   .status view on|off  -> status auto-view (seen) on/off
//   .status like on|off  -> status auto-like (react) on/off
// Sirf wahi ek setting save hoti hai (poora config nahi).

const { cmd } = require('../arslan');
const { getUserConfigFromMongoDB, updateUserConfigInMongoDB } = require('../lib/database');

const KEYS = { view: 'AUTO_VIEW_STATUS', like: 'AUTO_LIKE_STATUS' };
const LABEL = { view: '👁️ Status View', like: '❤️ Status Like' };
const isOn = (v) => String(v) === 'true';
const word = (v) => (isOn(v) ? 'ON ✅' : 'OFF ❌');

cmd({
    pattern: 'status',
    alias: ['statusset', 'statussetting'],
    desc: 'Status auto view/like on-off (.status view on | .status like off)',
    use: '.status  |  .status view on  |  .status like off',
    category: 'settings',
    ownerOnly: true,
    react: '📲',
    filename: __filename
}, async (conn, mek, m, { args, isOwner, reply, botNumber, config }) => {
    if (!isOwner) return reply('🚫 Owner only!');
    const num = String(botNumber || '');
    const P = (config && config.PREFIX) || '.';

    let cur = {};
    try { cur = (await getUserConfigFromMongoDB(num)) || {}; } catch (_) {}

    const what = String(args[0] || '').toLowerCase();
    const val = String(args[1] || '').toLowerCase();

    if (!KEYS[what]) {
        return reply(
            `📲 *STATUS SETTINGS*\n\n` +
            `${LABEL.view}: *${word(cur.AUTO_VIEW_STATUS)}*\n` +
            `${LABEL.like}: *${word(cur.AUTO_LIKE_STATUS)}*\n\n` +
            `_Use:_\n${P}status view on / off\n${P}status like on / off`
        );
    }

    let next;
    if (['on', 'true', '1'].includes(val)) next = 'true';
    else if (['off', 'false', '0'].includes(val)) next = 'false';
    else return reply(`${LABEL[what]}: *${word(cur[KEYS[what]])}*\n\n${P}status ${what} on\n${P}status ${what} off`);

    try {
        const updated = { ...cur, [KEYS[what]]: next };
        await updateUserConfigInMongoDB(num, updated);
        return reply(`${LABEL[what]} ab *${word(next)}*`);
    } catch (e) {
        return reply('❌ Save nahi hua: ' + (e && e.message));
    }
});
