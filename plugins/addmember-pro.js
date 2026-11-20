const { cmd } = require('../arslan');
const config = require('../config');
const fs = require('fs-extra');
const path = require('path');

// ===========================================================
// 1. ADDMEMBER — Normal add (existing + fix)
// ===========================================================

// ===========================================================
// 2. ADDMEMBER2 — Bulk add (multiple numbers)
// ===========================================================
cmd({
    pattern: 'addmember2',
    alias: ['addbulk', 'massadd'],
    desc: 'Admin: Multiple numbers ek saath add karo',
    category: 'group',
    react: '➕',
    use: '.addmember2 92311...,92322...,92333...',
    filename: __filename
}, async (conn, mek, m, ctx) => {
    if (!ctx.isGroup) return ctx.reply('❌ Group me use karo.');

    if (!ctx.isBotAdmins) {
        return ctx.reply('❌ *Bot admin nahi hai!*');
    }
    if (!ctx.isAdmins && !ctx.isOwner) {
        return ctx.reply('⛔ Admin only.');
    }

    // Numbers split karo
    const numbers = (ctx.q || '')
        .split(/[\s,]+/)
        .map(n => n.replace(/\D/g, ''))
        .filter(n => n.length >= 10);

    if (!numbers.length) {
        return ctx.reply(
            '📝 *Use:*\n' +
            '`.addmember2 9231111111,9232222222,9233333333`\n\n' +
            'Numbers comma ya space se alag karo.'
        );
    }

    if (numbers.length > 20) {
        return ctx.reply('❌ Max 20 numbers ek baar me.');
    }

    await ctx.reply(`➕ *${numbers.length}* numbers add kar raha hun…`);

    const results = { success: [], failed: [], already: [], private: [] };

    for (const num of numbers) {
        const jid = `${num}@s.whatsapp.net`;
        try {
            const meta = await conn.groupMetadata(ctx.from);
            if (meta.participants.some(p => p.id === jid)) {
                results.already.push(num);
                continue;
            }

            const res = await conn.groupParticipantsUpdate(ctx.from, [jid], 'add');
            const status = res?.[0]?.status;

            if (status === '200') results.success.push(num);
            else if (status === '403') results.private.push(num);
            else results.failed.push(`${num} (${status || 'fail'})`);

            await new Promise(r => setTimeout(r, 800));
        } catch (e) {
            results.failed.push(`${num} (${e.message})`);
        }
    }

    const lines = [
        '➕ *BULK ADD RESULT*',
        '',
        `✅ Success: *${results.success.length}*`,
        `⚠️ Already in group: *${results.already.length}*`,
        `🔒 Private setting: *${results.private.length}*`,
        `❌ Failed: *${results.failed.length}*`,
        '',
        results.success.length ? `✅ *Added:*\n${results.success.join(', ')}` : '',
        results.private.length ? `🔒 *Privacy block:*\n${results.private.join(', ')}` : '',
        results.failed.length ? `❌ *Failed:*\n${results.failed.slice(0, 5).join('\n')}` : ''
    ].filter(Boolean);

    return ctx.reply(lines.join('\n'));
});

// ===========================================================
// 3. ADDMEMBER3 — Number se add (format check ke saath)
// ===========================================================
cmd({
    pattern: 'addmember3',
    alias: ['addnum', 'addpro'],
    desc: 'Admin: Number add with validation',
    category: 'group',
    react: '🔍',
    use: '.addmember3 03XXXXXXXXX',
    filename: __filename
}, async (conn, mek, m, ctx) => {
    if (!ctx.isGroup) return ctx.reply('❌ Group only.');
    if (!ctx.isBotAdmins) return ctx.reply('❌ Bot admin nahi hai.');
    if (!ctx.isAdmins && !ctx.isOwner) return ctx.reply('⛔ Admin only.');

    let number = (ctx.q || '').replace(/\D/g, '');

    // Local format handle (03 → 92)
    if (number.startsWith('0')) {
        number = `${config.DEFAULT_COUNTRY_CODE}${number.slice(1)}`;
    }

    if (number.length < 10 || number.length > 15) {
        return ctx.reply(
            '❌ Invalid number format.\n\n' +
            '✅ *Sahi formats:*\n' +
            '• `923XXXXXXXXX` (international)\n' +
            '• `03XXXXXXXXX` (local → auto convert)\n' +
            '• `+92 3XX XXX XXXX`'
        );
    }

    const jid = `${number}@s.whatsapp.net`;

    try {
        await ctx.reply(`🔍 Checking *+${number}*…`);

        // Check number WhatsApp pe exist karta hai
        const [check] = await conn.onWhatsApp(jid).catch(() => [null]);
        if (!check?.exists) {
            return ctx.reply(`❌ *+${number}* WhatsApp pe exist nahi karta.`);
        }

        // Already in group?
        const meta = await conn.groupMetadata(ctx.from);
        if (meta.participants.some(p => p.id === jid)) {
            return ctx.reply(`⚠️ Ye number already group me hai.`);
        }

        // Add karo
        const res = await conn.groupParticipantsUpdate(ctx.from, [jid], 'add');
        const status = res?.[0]?.status;

        if (status === '200') {
            return ctx.reply(`✅ *+${number}* added successfully!`);
        } else if (status === '403') {
            return ctx.reply(
                `⚠️ Add nahi hua — *privacy setting*.\n\n` +
                `💡 Invite link:\n\`${config.PREFIX}ginvite\``
            );
        } else {
            return ctx.reply(`⚠️ Add fail. Status: *${status}*`);
        }
    } catch (e) {
        console.error('addmember3 error:', e.message);
        return ctx.reply(`❌ Error: ${e.message}`);
    }
});

// ===========================================================
// 4. CHECKNUM — Number valid hai ya nahi
// ===========================================================
cmd({
    pattern: 'checknum',
    alias: ['checknum', 'isnumber'],
    desc: 'Check karo number WhatsApp pe exist karta hai ya nahi',
    category: 'tools',
    react: '🔍',
    use: '.checknum 923XXXXXXXXX',
    filename: __filename
}, async (conn, mek, m, ctx) => {
    let number = (ctx.q || '').replace(/\D/g, '');
    if (number.startsWith('0')) number = `${config.DEFAULT_COUNTRY_CODE}${number.slice(1)}`;

    if (!number || number.length < 10) {
        return ctx.reply('Use: `.checknum 923XXXXXXXXX`');
    }

    try {
        const jid = `${number}@s.whatsapp.net`;
        const [check] = await conn.onWhatsApp(jid).catch(() => [null]);

        if (!check?.exists) {
            return ctx.reply(`❌ *+${number}* WhatsApp pe *exist nahi* karta.`);
        }

        // Try to get PP
        let pp = '';
        try { pp = await conn.profilePictureUrl(jid, 'image'); } catch {}

        return ctx.reply([
            '🔍 *NUMBER CHECK*',
            '',
            `📱 Number: *+${number}*`,
            `✅ WhatsApp: *Registered*`,
            `📛 JID: *${check.jid}*`,
            `🖼️ PP: *${pp ? 'Available' : 'Hidden'}*`,
            '',
            `💡 Ye number add ho sakta hai.`
        ].join('\n'));
    } catch (e) {
        return ctx.reply(`❌ Check fail: ${e.message}`);
    }
});

// ===========================================================
// 5. GROUPINVITE — Group ka invite link bhejo
// ===========================================================
