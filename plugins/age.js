const { cmd } = require('../arslan');

// =================================================================
// 🎂 .age <janam ki tareekh>  —  Umar calculate karo
// Misaal:  .age 15/03/2000   |   .age 15-3-2000   |   .age 2000-03-15
//          .age 15 March 2000   |   .age 15/03/2000 30/06/2025  (us din ki umar)
// Tareekh DD/MM/YYYY mani jati hai.
// =================================================================

const TZ = 'Asia/Karachi';
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const ZODIAC = [
    ['Capricorn ♑', 12, 22], ['Aquarius ♒', 1, 20], ['Pisces ♓', 2, 19], ['Aries ♈', 3, 21],
    ['Taurus ♉', 4, 20], ['Gemini ♊', 5, 21], ['Cancer ♋', 6, 21], ['Leo ♌', 7, 23],
    ['Virgo ♍', 8, 23], ['Libra ♎', 9, 23], ['Scorpio ♏', 10, 23], ['Sagittarius ♐', 11, 22]
];

const isLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const dim = (y, m) => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
const utc = (y, m, d) => Date.UTC(y, m - 1, d);
const fmt = n => Number(n).toLocaleString('en-US');

function todayParts() {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(new Date()).reduce((a, x) => (a[x.type] = x.value, a), {});
    return { y: +p.year, m: +p.month, d: +p.day };
}

function validDate(y, m, d) {
    return Number.isInteger(y) && Number.isInteger(m) && Number.isInteger(d) &&
        y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= dim(y, m);
}

// "15/03/2000", "15-3-2000", "15.03.2000", "2000-03-15", "15 March 2000", "March 15 2000"
function parseDate(str) {
    const s = String(str || '').trim().toLowerCase().replace(/,/g, ' ');
    let m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    if (m) return { y: +m[1], m: +m[2], d: +m[3] };
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) return { y: +m[3], m: +m[2], d: +m[1] };
    m = s.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/);
    if (m) { const i = MONTHS.findIndex(x => x.startsWith(m[2].slice(0, 3)) && x.startsWith(m[2])); if (i >= 0) return { y: +m[3], m: i + 1, d: +m[1] }; }
    m = s.match(/^([a-z]+)\s+(\d{1,2})\s+(\d{4})$/);
    if (m) { const i = MONTHS.findIndex(x => x.startsWith(m[1].slice(0, 3)) && x.startsWith(m[1])); if (i >= 0) return { y: +m[3], m: i + 1, d: +m[2] }; }
    return null;
}

function calcAge(b, t) {
    // Saal+mahine: janam ki tareekh mein mahine jod kar (din us mahine ki hadd tak) dekho kahan tak pohanchte hain
    const before = (y, m, d) => utc(y, m, d) <= utc(t.y, t.m, t.d);
    const anchor = (n) => {                      // n = kul mahine
        const y = b.y + Math.floor((b.m - 1 + n) / 12), m = ((b.m - 1 + n) % 12) + 1;
        return { y, m, d: Math.min(b.d, dim(y, m)) };
    };
    let n = (t.y - b.y) * 12 + (t.m - b.m);
    while (n > 0 && !before(anchor(n).y, anchor(n).m, anchor(n).d)) n--;
    const an = anchor(n);
    const years = Math.floor(n / 12), months = n % 12;
    const days = Math.round((utc(t.y, t.m, t.d) - utc(an.y, an.m, an.d)) / 86400000);

    const totalDays = Math.round((utc(t.y, t.m, t.d) - utc(b.y, b.m, b.d)) / 86400000);

    // Agli birthday (29 Feb walon ki non-leap saal mein 28 Feb)
    const bday = y => (b.m === 2 && b.d === 29 && !isLeap(y)) ? { m: 2, d: 28 } : { m: b.m, d: b.d };
    let ny = t.y, nb = bday(ny);
    if (utc(ny, nb.m, nb.d) < utc(t.y, t.m, t.d)) { ny++; nb = bday(ny); }
    const daysToBirthday = Math.round((utc(ny, nb.m, nb.d) - utc(t.y, t.m, t.d)) / 86400000);

    const zi = (b.m === 12 && b.d >= 22) ? ZODIAC[0] : ZODIAC.slice(1).filter(z => b.m > z[1] || (b.m === z[1] && b.d >= z[2])).pop();
    const sign = (zi || ZODIAC[0])[0];

    return {
        years, months, days, totalDays,
        weeks: Math.floor(totalDays / 7), hours: totalDays * 24,
        daysToBirthday, nextAge: years + (daysToBirthday === 0 ? 0 : 1),
        weekday: DAYS[new Date(utc(b.y, b.m, b.d)).getUTCDay()],
        nextWeekday: DAYS[new Date(utc(ny, nb.m, nb.d)).getUTCDay()],
        sign
    };
}

const pad = n => String(n).padStart(2, '0');

cmd({
    pattern: 'age',
    alias: ['agecalc', 'calcage', 'umar'],
    desc: 'Janam ki tareekh se umar calculate karo',
    category: 'tools',
    react: '🎂',
    use: '.age 15/03/2000',
    filename: __filename
}, async (conn, mek, m, { q, reply, prefix }) => {
    try {
        const p = prefix || '.';
        const input = String(q || '').trim();
        if (!input) {
            return reply(
`🎂 *AGE CALCULATOR*

*Janam ki tareekh likho (DD/MM/YYYY):*
${p}age 15/03/2000
${p}age 15-3-2000
${p}age 2000-03-15
${p}age 15 March 2000

📅 *Kisi khaas din ki umar:*
${p}age 15/03/2000 30/06/2025`);
        }

        // Do tareekhein ho sakti hain: janam + (optional) us din tak
        const tokens = input.split(/\s+/);
        let birth = null, target = null;
        for (let i = 1; i < tokens.length && !birth; i++) {
            const a = parseDate(tokens.slice(0, i).join(' '));
            if (a) { birth = a; const rest = tokens.slice(i).join(' '); if (rest) target = parseDate(rest) || false; }
        }
        if (!birth) birth = parseDate(input);
        if (!birth) return reply(`⚠️ Tareekh samajh nahi aayi.\n\n*Misaal:* ${p}age 15/03/2000\n(Tareekh DD/MM/YYYY mein likho)`);
        if (target === false) return reply(`⚠️ Doosri tareekh samajh nahi aayi.\n\n*Misaal:* ${p}age 15/03/2000 30/06/2025`);

        if (!validDate(birth.y, birth.m, birth.d)) return reply('❌ Ye tareekh sahi nahi hai (din/mahina/saal check karo).');
        const today = todayParts();
        const t = target || today;
        if (target && !validDate(t.y, t.m, t.d)) return reply('❌ Doosri tareekh sahi nahi hai.');
        if (utc(birth.y, birth.m, birth.d) > utc(t.y, t.m, t.d)) {
            return reply(target ? '❌ Janam ki tareekh doosri tareekh se pehle honi chahiye.' : '❌ Janam ki tareekh aane wale waqt ki nahi ho sakti.');
        }

        const r = calcAge(birth, t);
        const bStr = `${pad(birth.d)}/${pad(birth.m)}/${birth.y}`;
        const tStr = `${pad(t.d)}/${pad(t.m)}/${t.y}`;
        const label = target ? `📅 ${tStr} ko umar` : '🎂 *Aap ki umar*';
        const bdayLine = target ? '' : (r.daysToBirthday === 0
            ? '\n🎉🎉 *Aaj aap ki birthday hai! Mubarak ho!* 🎉🎉'
            : `\n⏳ *Agli birthday* (${r.nextAge} saal): *${fmt(r.daysToBirthday)}* din baad, ${r.nextWeekday}`);

        return reply(
`╭━━〔AGE CALCULATOR〕━━╮
┃ 🗓️ Janam: ${bStr} (${r.weekday})
┃ ✨ Zodiac: ${r.sign}
┃
┃ ${label}
┃ ➤ *${r.years}* saal, *${r.months}* mahine, *${r.days}* din
┃
┃ 📊 *Kul:*
┃ • Mahine: ${fmt(r.years * 12 + r.months)}
┃ • Hafte: ${fmt(r.weeks)}
┃ • Din: ${fmt(r.totalDays)}
┃ • Ghante: ${fmt(r.hours)}
╰━━━━━━━━━━━━━━━━━━━━╯${bdayLine}`);
    } catch (e) {
        return reply('⚠️ Age calculate nahi ho saki: ' + (e.message || e));
    }
});

module.exports = { parseDate, calcAge };
