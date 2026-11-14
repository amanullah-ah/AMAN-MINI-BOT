# Update 2.7.0

## Naya: `.svotes` (sab ke liye)
Saare connected sessions channel poll par vote karte hain.
- `.svotes <poll-link> 1`        -> option 1 (pehla)
- `.svotes <poll-link> B`        -> option B (doosra)
- `.svotes <poll-link> Ali`      -> option ka naam
- `.svotes <poll-link> 1 2`      -> sessions dono options mein baant diye jate hain
- `.svotes <poll-link> A follow` -> pehle channel follow, phir vote
- `.svotes <poll-link> list`     -> poll ke options dikhata hai

## Change
- `.sreacts` / `.arcadd` ab host-only nahi: sab use kar sakte hain.

## Fix: `.islamiccartoon` — poori episode
- Pehle sirf watch link deta tha / download provider 15-30 sec ka preview deta tha.
- Ab local yt-dlp se *poori episode* download hoti hai (480p -> 360p -> 240p -> 144p, 250 MB tak).
- 90 MB se badi file document ki tarah jati hai.
- Download ke baad duration check hoti hai; agar file chhoti ho to "full" nahi kehta.
- Naya helper: `mediaDl.downloadFullVideoFile()` in `lib/media-dl.js`.

## `.sreacts` — reply mode
- Group/chat mein kisi message ko *reply* karke `.sreacts` (ya `.sreacts ❤️ 🔥`) likho -> saare sessions us message par react karte hain.
- Sirf wahi sessions react kar sakte hain jo us group mein maujood hon.

## `.sreacts sticker` — emoji ki sticker
- Message ko reply karke `.sreacts sticker ❤️ 🔥` -> har session emoji ki bani sticker us message ke neeche bhejta hai.
- Emoji image Twemoji (jsDelivr) se aati hai, sharp se 512x512 webp banti hai (server par internet chahiye).
- Note: WhatsApp ka asli "sticker reaction" (bubble ke corner wala) Baileys mein support nahi, is liye sticker reply ki tarah jati hai.

## Pair website (pair.html) — naya design + features
- Number auto-format: `03XX...` likhne par Pakistan (+92) khud lag jata hai, preview dikhta hai.
- Code 8 boxes mein dikhta hai, 2 minute ka countdown bar, expire hone par "Naya code" button.
- Connect hote hi page khud pakar leta hai (`/status` poll) aur "Bot connect ho gaya" dikhata hai.
- Live "Linked accounts" counter, last number yaad rakhta hai, Roman Urdu / English toggle.
- Features cards, Channel / Group buttons, FAQ ("code nahi aa raha").
- Backend: `/code` ab pairing code 3 dafa try karta hai aur local number normalise karta hai. Purana `/code` JSON format waisa hi hai.

## `.sreacts sticker` — animated circle
- Message ko reply karke `.sreacts sticker ❤️ 🔥 😍` -> emojis neeche se uthte hain, ek gol circle (ring) banate hain, phir ring ghoomti hai. Animated sticker sab sessions bhejte hain.
- Ring mein 8-14 emojis (sessions ki tadaad ke hisab se), diye hue emojis repeat hote hain.
- Purana single emoji sticker chahiye to: `.sreacts sticker static ❤️`
- Size WhatsApp ki 500 KB hadd ke andar rakhne ke liye khud quality kam karta hai. Pehli baar banne mein 1-20 second lag sakte hain, phir cache se foran.

## Fix round — svotes / sreacts / song / anime
- Plugin errors ab chat mein dikhte hain (pehle sirf console mein jate the, isi liye command "chup" lagta tha).
- `.svotes`: har network call par time limit (12-15s). Hang nahi hota, jawab aata hai. `.massvote` / `.autovote` ab isi ke alias hain.
- `plugins/massvote.js` hata diya: wo asal vote nahi karta tha, sirf nakli counter badhata tha.
- `.arcadd` ab `.sreacts` wala hi engine hai (channel link + group reply mode + sticker). `arcadd.js` hata diya.
- Song/video: YouTube ke 6 clients ek ek kar ke try hote hain (default, android_vr, tv, web_safari, mweb, ios), phir ytdl-core, phir SoundCloud. Fail hone par asal wajah chat mein.
- Naya `.nettest` (aur `.nettest yt`): server ka internet / yt-dlp / ffmpeg / YouTube check.
- `.waifu` / `.neko`: purana single-API handler (api-master-pack) hata kar 5-API chain (nekos.best, waifu.pics, nekosia, waifu.im, purrbot).

## Welcome / Goodbye + Bot picture
- Masla: welcome event `main.js` mein kabhi jura hi nahi tha, is liye welcome chalta hi nahi tha. Ab `group-participants.update` jura hai.
- Naya `lib/welcome.js` + `plugins/welcome-pro.js`: naye member ki DP card mein, Urdu shayari, 7 stylish fonts, har group ki alag settings (`data/welcome.json`).
- Commands: `.welcome on/off`, `.goodbye on/off`, `.setwelcome <text>`, `.setgoodbye <text>`, `.welcomefont 1-7`, `.shayari on/off`, `.setshayari <text>`, `.welcomepic on/off`, `.testwelcome`, `.testgoodbye`, `.welcomeinfo`.
- Placeholders: @user @group @count @date @time @shayari
- Bot picture: `.setbotpic` (photo reply / caption / link), `.resetbotpic`. Menu, alive aur connected message ab yehi picture use karte hain. `.setpp` (WhatsApp profile photo) bhi theek kiya.

## Welcome / Goodbye (naya) — `lib/welcome.js`, `plugins/welcome-pro.js`
- Pehle welcome event `main.js` mein jura hi nahi tha, is liye kabhi chalta nahi tha. Ab `group-participants.update` se chalta hai.
- Naye member ki DP ek ring wale card mein, sath caption (stylish fonts + Urdu shayari + tag). DP na ho to silhouette.
- Commands (group admin / owner): `.welcome on/off`, `.goodbye on/off`, `.setwelcome <text>`, `.setgoodbye <text>`, `.welcomefont 1-7`, `.shayari on/off`, `.setshayari <text>`, `.welcomepic on/off`, `.testwelcome`, `.testgoodbye`, `.welcomeinfo`.
- Text mein: @user @group @count @date @time @shayari. Settings har group ke liye alag, `data/welcome.json` mein.

## Bot picture
- `.setbotpic` (photo reply / photo ke sath caption / image link) -> menu, alive aur connected message ki picture badalti hai. `.resetbotpic` default par lata hai. Har session ki apni picture.
- `.setpp` theek kiya: ab `./tmp` folder ki zaroorat nahi (pehle ENOENT error aata tha). WhatsApp ki profile photo badalta hai.

## `.svotes` — sach
- Baileys 7.0.0-rc14 mein channel poll vote bhejne ka tareeqa nahi hai. Purane tareeqe (poll-update / send-message) andaze se bane the aur "Success" dikhate the lekin vote count nahi hota tha. Unhein band kar diya. Ab command saaf bata deta hai ke vote nahi ja sakta. Channel posts par reactions ke liye `.sreacts` use karein.

# 2.8.0 — Sessions hamesha connected + Google (𝗔𝗠𝗔𝗡-𝐌𝐃)

## Sessions off nahi hote (update / restart ke baad bhi)
- Pehle: 3 koshish ke baad session hamesha ke liye chhod diya jata tha; 30 second ke andar dobara disconnect ho to retry hi nahi hota tha; timeout (408) par drop; boot par sirf ek dafa reconnect; exit par local session folder khali ho jata tha.
- Ab: disconnect par hamesha dobara koshish (5s se 5 minute tak badhta intezar), koi hadd nahi.
- Sirf asli logout (user ne phone se device hata diya, 401) par session delete hota hai. Baqi sab masle (net, timeout, server restart) temporary maane jate hain.
- "Connection replaced" (purana + naya deployment ek sath) par 90 second ruk kar dobara.
- Watchdog har 90 second: jis number ki session saved hai magar offline hai usay wapas connect karta hai; atke hue / mare hue sockets restart karta hai. Sirf wo numbers jin ke credentials maujood hain (nayi pairing code kabhi nahi mangta).
- SIGTERM/SIGINT (deploy) par sockets sirf band hote hain, logout nahi, aur session files ab delete nahi hotin. Naya version start hote hi sab khud wapas aa jate hain.
- Free hosts ke liye self-ping: `SELF_PING_URL` (ya RENDER_EXTERNAL_URL / KOYEB_PUBLIC_DOMAIN / HEROKU_APP_NAME / RAILWAY_PUBLIC_DOMAIN) set ho to har 4 minute `/ping`.

## Google par "𝗔𝗠𝗔𝗡-𝐌𝐃"
- pair.html: title/description/keywords, canonical, Open Graph, Twitter card, JSON-LD (WebSite + WebApplication, naam "𝗔𝗠𝗔𝗡-𝐌𝐃" / "𝗔𝗠𝗔𝗡-𝐌𝐃"), H1 "𝗔𝗠𝗔𝗡-𝐌𝐃 Bot Pair", "𝗔𝗠𝗔𝗡-𝐌𝐃 kya hai?" text.
- `/robots.txt` aur `/sitemap.xml` khud ban jate hain.
- Env: `SITE_URL=https://aap-ka-domain` (best), `GOOGLE_SITE_VERIFICATION=<token>` (Search Console meta tag).

# 2.8.1 — Speed + account safety
## Slowness (kyun tha)
- Har incoming message (aur har contact ka status) par MongoDB se user config padha jata tha -> ab 30 second ka cache.
- Har group message par live `groupMetadata()` query hoti thi -> ab 5 minute ka cache (+ Baileys `cachedGroupMetadata`), group change par cache saaf.
- WhatsApp version har connect par download hota tha -> 6 ghante cache.
- `defaultQueryTimeoutMs: 0` (kabhi timeout nahi) -> 60 second.

## Ban ka khatra kam karne wale badlav
- config.js: AUTO_VIEW_STATUS / AUTO_LIKE_STATUS default ab "false". (Pehle "true" tha aur settings commands ye value user ke DB config mein save kar deti thi.)
- Status auto-like: hadd 20/ghanta per session (STATUS_LIKES_PER_HOUR), 4-12 second random delay.
- Har session ke outgoing messages ke beech 0.5-1.0 second ka gap.
- `markOnlineOnConnect` band; keep-alive 25s.
- Mass commands (`.sreacts`, `.svotes`): har chat mein 25 second cooldown, ek dafa mein max 40 sessions (MASS_MAX_SESSIONS), sessions ke beech 1.5s jitter.
- Newsletter auto-react sessions ek hi second mein nahi, 1.5-7.5 second jitter ke saath.
- Pair website: ek number ke liye naya code 20 second baad.

# 2.9.0 — Follow/Unfollow + multi-server pair website

## `.sfollow` / `.sunfollow`
- `.sfollow <channel-link>` : saare connected sessions channel follow karte hain. `.sunfollow <link>` : unfollow.
- Purane `.massfollow/.mf/.allfollow` aur `.massunfollow/.muf/.allunfollow` ab isi code par chalte hain (cooldown 60s, sessions ke beech 1.5-3s gap, max MASS_MAX_SESSIONS). `.followstats` waisa hi.
- `newsletterFollow/Unfollow` asli WhatsApp calls hain, result mein follow / pehle se follow / failed alag dikhta hai.

## Pair website: naya black-gold style + REAL servers
- 3 steps (Server -> Number -> Code), server grid: har server ka asli "active/capacity" (jaise 11/50), signal bars (asli response time se), FULL / OFFLINE, "N online". Sab se khali server khud select hota hai, user badal sakta hai. Dark / light mode, EN / Roman Urdu.
- Backend: `GET /api/server-info` (id, name, active, capacity, full), `GET /api/servers` (server list), read-only routes par CORS, `/code` capacity par 503 `server_full` deta hai.
- Env (har bot server ke liye): `SERVER_ID` (1, 2, 3...), `SERVER_NAME` ("Server 01"), `MAX_SESSIONS` (default 50).
- Doosre servers dikhane ke liye `servers.json` ya env `SERVERS`:
  `[{"name":"Server 02","url":"https://bot2.example.com"},{"name":"Server 03","url":"https://bot3.example.com"}]`
  Har extra server bhi yahi bot (naya deploy) hona chahiye. Ek hi MongoDB share ho sakta hai: har server sirf apne `SERVER_ID` ke numbers restore karta hai.
- Website kisi bhi jagah (jaise Vercel) host ho sakti hai: `servers.json` us ke saath rakhein, servers ke CORS khule hain.

## Security
- `/disconnect`, `/active`, `/connect-all` ab `ADMIN_TOKEN` maangte hain (`?token=` ya `x-admin-token`). Token set na ho to ye band hain.
- `/status` bina number ke ab numbers mask karke dikhata hai.
