# 𝗔𝗠𝗔𝗡-𝐌𝐃 AntiLink Commands

Admin-only configuration commands:

- `.antilink` — show current status/help
- `.antilink on` — enable protection
- `.antilink off` — disable protection
- `.antilink action delete` — delete link + warn message
- `.antilink action warn` — delete link, warn member, remove after limit
- `.antilink action kick` — delete link and remove member
- `.antilink limit 3` — set warning limit (1–20)
- `.antilink whitelist add youtube.com` — allow a domain
- `.antilink whitelist remove youtube.com` — remove it from whitelist
- `.antilink whitelist list` — show whitelist
- `.antilink reset` — reset the group's AntiLink settings
- `.antilinkreset` — reset one member's warning count (reply/mention)

The settings are stored per group in `data/antilink.json` and survive restarts.

Protected users: group admins and the bot owner are ignored by AntiLink.
