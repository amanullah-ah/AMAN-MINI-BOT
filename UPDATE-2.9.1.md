# Update 2.9.1 — Downloads fix

## Kya theek hua (lib/media-dl.js)
- yt-dlp ko ab Node.js JS runtime diya jata hai (`--js-runtimes node`). Naye yt-dlp ko YouTube ke liye ye chahiye, warna song/video fail hoti thi.
- Fail hone par yt-dlp khud update hota hai aur ek baar dobara try karta hai.
- Badi file par yt-dlp chup chap file nahi banata tha (aur 6 clients bekaar try hote the). Ab saaf "TOO_BIG" error aata hai aur `.video` quality khud kam karta hai (720 -> 480 -> 360 -> 240).
- Cookies ab env se bhi: `YTDLP_COOKIES_B64` (cookies.txt ka base64) ya `YTDLP_COOKIES_TEXT`. Railway par file upload ki zaroorat nahi.
- Naya `explainError()`: asli wajah Roman Urdu mein.

## Chat mein ab wajah dikhti hai
`.video`, `.tiktok`, `.fb`, `.igdl` ab "download nahi hui" ke saath wajah bhi batate hain (IP block, purana yt-dlp, private video, network, badi file).

## Agar YouTube phir bhi block kare
Railway jaise datacenter IP ko YouTube aksar block karta hai. Browser (logged-in) se cookies.txt export karo, base64 banao
(`base64 -w0 cookies.txt`), aur Railway Variables mein `YTDLP_COOKIES_B64` daal ke redeploy karo.

## .vv — owner DM mode
- `.vv` ab view-once media sirf owner ke apne DM mein bhejta hai (chat mein nahi). Error bhi sirf owner ke DM mein.
- Naye short alias: `.ok .theek .nice .good .acha .sahi .thanks` — ye sirf tab kaam karte hain jab reply asli view-once media par ho. Warna bot kuch nahi karta aur in lafzon ka normal istemal nahi rukta.
- Caption mein "From: <number>" aata hai.

## Naya: .autoreact (har message par random emoji reaction)
- `.autoreact on` / `.autoreact off`. Bas itna. Private chat aur group dono mein chalta hai, emoji random.
- Alias: `.autoreacts`, `.areact`. Sirf owner. Setting `data/autoreact.json` mein save hoti hai (MongoDB nahi chahiye).
- Apne messages, commands, status aur channels par react nahi karta. Ek chat mein 4 second ka cooldown (flood se bachne ke liye).
- Plugin: `plugins/autoreact-chat.js`, hook `main.js` mein.

## .forwardall — naya (link + sab groups + admin channels)
- `.forwardall <channel post link>` -> aap ke sab groups aur un sab channels mein jin mein aap admin/owner ho, ek ke baad ek.
- Kisi message par reply karke `.forwardall` -> wo message forward hota hai. `.forwardall stop` -> rok do.
- Sirf isi account ke chats (pehle ye saare connected sessions ke groups mein bhej deta tha — hata diya).
- Har bhejne ke beech 4-9 second ka random gap, announce-only groups jahan aap admin nahi wahan skip, ek run mein max 300 chats (env: FORWARDALL_DELAY_MIN/MAX, FORWARDALL_MAX).
- Link text ki tarah jata hai (WhatsApp usay clickable link dikhata hai). Asli "forwarded" label wala forward sirf message par reply se hota hai.
- Channels Baileys se khud uthaye jate hain (sirf jin mein aap admin/owner ho).
- Purane do `forwardall` handlers (owner-panel-pro.js, power-pack.js) hata diye.

## Welcome / Goodbye card par owner ki photo
- `.setownerpic` (apni photo par reply, ya photo ke caption mein, ya `.setownerpic <link>`) — owner photo set.
- `.ownerpic on` / `off` — badge on/off; `.resetownerpic` — photo hata do.
- Har welcome aur goodbye card par member ki DP ke neeche-right kone par aap ki chhoti gol photo aati hai.
- Dekhne ke liye group mein `.testwelcome`. Photo `data/welcome-owner/` mein save hoti hai.

## Antidelete fix
Wajah: (1) `new-pack.js` mein isi naam ki doosri `.antidelete` thi jo sirf status dikhati thi aur asli command ko dba deti thi; (2) setting MongoDB par thi (aur MONGODB_URI placeholder hai); (3) delete pehchanne ka code galat stub type (68) dekhta tha, asli revoke type 1 hai; (4) pehle disabled chat par poori loop `return` ho jati thi.
- `.antidelete on` (usi chat mein), `.antidelete dm` (sirf owner ke DM mein), `.antidelete off`. Alias: `.antidel`, `.ad`.
- Setting `data/antidelete.json` mein, MongoDB ki zaroorat nahi. Sirf wahi messages recover hote hain jo bot ne online rehte hue dekhe (har chat ke aakhri 200).

## .dltest + behtar error hint
- `.dltest` (owner): yt-dlp install, version, JS runtime, ffmpeg, cookies ka haal batata hai aur ek asli YouTube check chalata hai (download kiye bina). Apna link: `.dltest <youtube link>`.
- Download fail hone par ab hint ke neeche asli error ki line (📋) bhi aati hai. "Unable to download" ko ab seedha network nahi samjha jata; 403/429 = IP block, name-resolution/timeouts = network.

## Categories mix
`misc`, `system`, `anime`, `games`, `emotions` ab sab `utility` category mein hain (arslan.js mein ek jagah se; bina category wali commands bhi `utility` mein). Menu, `.menu list` aur carousel mein ab `misc` nahi dikhta. `.menu misc` / `.menu anime` / `.menu games` / `.menu emotions` / `.menu system` likhne par `utility` khulta hai.

## Settings + Love = extra
`settings` aur `love` ek nayi category `extra` mein mila di gayi hain (arslan.js mein MERGED_CATEGORIES). `.menu settings` / `.menu love` likhne par `extra` khulta hai. Naam badalna ho to arslan.js, plugins/allmenu.js (CAT_ALIAS aur orders) aur plugins/carousel-menu.js mein `extra` badal do.

## Owner + Main = aman
`owner` aur `main` ki saari commands ek category `aman` mein hain. Zaroori: owner wali commands ab bhi sirf owner chala sakta hai (arslan.js `ownerOnly` flag lagata hai aur main.js wahi check karta hai); main wali public hi rehti hain. `.menu owner` / `.menu main` likhne par `aman` khulta hai.

## Image -> tools
`image` ki saari commands ab `tools` category mein hain. `.menu image` likhne par `tools` khulta hai.
