# Update 2.6.0

## Naya: `.sreacts`  (owner)
Bot se connected **saare sessions** channel post par react karte hain.
- `.sreacts <post-link>`              → har session random emoji
- `.sreacts <post-link> ❤️`           → sab sessions ❤️
- `.sreacts <post-link> ❤️ 🔥 😍`     → emojis sessions mein baant diye jate hain
- `.sreacts <post-link> ❤️ follow`    → har session pehle channel follow karke react kare

## Fix: `.arcadd` (premium/owner)
- Pehle channel ke code ko JID bana raha tha (galat) aur sirf 1 session se react karta tha.
- Ab link se asli channel JID resolve hota hai aur **saare connected sessions** react karte hain.

## Song / Video — API ke bina
`lib/media-dl.js`: yt-dlp (pehli baar GitHub se khud download) → ytdl-core → (last resort) purani APIs.
Ye commands ab local system use karti hain: `.song/.play`, `.video`, `.fb`, `.igdl`, islamic cartoon downloads.
Optional env: `YTDLP_COOKIES` (cookies.txt path), `YTDLP_PATH`, `YTDLP_EXTRA_ARGS`.

## Anime — nayi APIs
`lib/anime-api.js`: AniList + Jikan + Kitsu (search), nekos.best + waifu.pics + nekosia (random/gif).
Sab keyless, retry + automatic fallback. Dead waifu.im hata diya.

## Other
- `.randompic`, `.panda`: dead `source.unsplash.com` hata kar loremflickr/picsum lagaya.

## Premium system removed (2.6.1)
- Saari commands sab ke liye free hain. `.promo`, `.redeem`, `.premium`, `.premiumlookup` hata diye.
- Owner = jis WhatsApp account ne session pair kiya, sirf wahi apne session ka owner hai.
  (Config ke OWNER_NUMBER se mile hue extra owners ab har session par owner nahi bante.)
- `.sreacts` / `.arcadd` saare sessions (doosron ke accounts) par asar karti hain, is liye:
  OWNER_NUMBER set ho to sirf wahi host chala sakta hai; set na ho to koi bhi session owner chala sakta hai.
