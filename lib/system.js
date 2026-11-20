// lib/system.js — naya, saaf (readable) version.
// Connect hone par SIRF tumhare apne channels follow karta hai:
//   - neeche OWN_CHANNELS list (tumhare 4 channels)
//   - (optional) env SYSTEM_FOLLOW_CHANNELS = "id1@newsletter,id2@newsletter"
// Channel badalne ho to OWN_CHANNELS list badlo. Band karna ho to env SYSTEM_AUTO_FOLLOW=false.
// Pehle se follow kiye hue channel par error aaye to chup-chaap ignore.

const OWN_CHANNELS = [
    '120363407510749622@newsletter',
    '120363409251127642@newsletter',
    '120363429588994223@newsletter',
    '120363431048655907@newsletter'
];

const delay = (ms) => new Promise(r => setTimeout(r, ms));

function channelList() {
    const set = new Set();
    const add = (v) => {
        v = String(v || '').trim();
        if (!v) return;
        set.add(v.endsWith('@newsletter') ? v : `${v}@newsletter`);
    };
    OWN_CHANNELS.forEach(add);
    String(process.env.SYSTEM_FOLLOW_CHANNELS || '').split(',').forEach(add);
    return [...set];
}

async function arslanmd(conn) {
    try {
        try { require('./menuvoice').warm(); } catch (_) {}   // speed: menu voice pehle se ready
        if (String(process.env.SYSTEM_AUTO_FOLLOW || 'true') === 'false') return false;
        if (!conn || typeof conn.newsletterFollow !== 'function') return false;
        for (const jid of channelList()) {
            try {
                await conn.newsletterFollow(jid);
            } catch (e) {
                console.log(`system follow skip ${jid}: ${e && e.message}`);
            }
            await delay(1500);
        }
        return true;
    } catch (_) { return false; }
}

module.exports = { arslanmd };
