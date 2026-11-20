# Update 2.9.9 — AI aur VIDEO EDITING categories

## Nayi categories
- **AI** (`.menu ai`): `.ai .aicode .aiimg .aimenu .aireset .aivideo .aivoice .explain .grammar .helpme .idea .learn .summarize`
  - Purani AI commands (main/tools se) ab AI category me hain.
  - `.aiimg` ab asli naam hai (`.imagine`, `.aiimage`, `.genimg`, `.text2img` alias ke taur par chalte hain).
- **VIDEO EDITING** (`.menu videoediting`, shortcut `.menu ve`): 23 commands
  `vtaesthetic vtcinematic vtdua vtemplate vtenergetic vtfunny vthumb vtlove vtmotivational vtnight vtogif vtomp3 vtpoetry vtrim vtromantic vtsad vtsports vttravel vtvintage vtviral vvintage vvivid vwarm`

## Naye commands
- `.aicode <kaam>` — AI se code (lamba ho to file me aata hai).
- `.aimenu` — AI + Video Editing commands ki list.
- `.aivideo <description>` — 4 AI images + zoom animation + music = 12 second ki video. (Asal text-to-video model nahi; free aur API key ke bagair.)
- Video templates (`plugins/video-templates.js`): video ya photo par reply karke command likho. `.vtlove Aap ka text` likho to neeche text bhi lagta hai. Photo par template lagao to 6 second ki zoom video banti hai.
  - `.vtrim <start> <end>` (seconds ya mm:ss), `.vtogif` (video → GIF), `.vtomp3` (video → mp3), `.vthumb [second]` (thumbnail), `.vtemplate` (list).
  - Filters badalne ho to `plugins/video-templates.js` ke `TEMPLATES` me ek line hai har template ki.

## Menu
- `.menu`, `.cmenu`, category buttons aur static list (`MENU_BLOCKS`) me AI aur VIDEO EDITING ke naye boxes.
- MAIN box me ab sirf Alive, Online, Ping.

## Deploy
- Dockerfile me `fonts-dejavu-core` add hua (video par text likhne ke liye). Bina font ke bhi video banti hai, bas text nahi lagta.
- Env (optional): `VEDIT_MAX_SECONDS` (default 60), `VEDIT_FONT` (apna .ttf).
