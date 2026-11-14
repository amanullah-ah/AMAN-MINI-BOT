<div align="center">

<br>

<img src="https://readme-typing-svg.herokuapp.com?font=Orbitron&weight=900&size=45&duration=3500&pause=500&color=F80000;FF7F00;FFFF00;00FF00;0000FF;4B0082;9400D3&center=true&vCenter=true&width=850&height=120&lines=AMAN+MINI+BOT;THE+ULTIMATE+WHATSAPP+BOT;SPEED+%7C%7C+POWER+%7C%7C+RELIABILITY" alt="Typing SVG" />

<br>
<br>

<!-- PURE COLORFUL GRADIENT DIVIDER -->
<div style="height: 10px; background: linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3); border-radius: 5px; margin-bottom: 20px;"></div>

<p align="center">
  <!-- STATS BADGE -->
  <a href="https://github.com/rizolegend5-art/RIZO-MINI-BOT">
    <img src="https://img.shields.io/badge/STATUS-OPERATIONAL-00FF00?style=for-the-badge&logo=roblox&logoColor=white&labelColor=101010" alt="Status" />
  </a>
  <!-- LANGUAGE BADGE -->
  <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript">
    <img src="https://img.shields.io/badge/LANGUAGE-NODE.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white&labelColor=101010" alt="Language" />
  </a>
   <!-- VERSION BADGE -->
  <a href="https://github.com/rizolegend5-art/RIZO-MINI-BOT/releases">
    <img src="https://img.shields.io/badge/VERSION-1.5.0%20(BETA)-FF33CC?style=for-the-badge&logo=semver&logoColor=white&labelColor=101010" alt="Version" />
  </a>
   <!-- LICENSE BADGE -->
  <a href="https://github.com/rizolegend5-art/RIZO-MINI-BOT/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/LICENSE-MPL--2.0-007ACC?style=for-the-badge&logo=mozilla&logoColor=white&labelColor=101010" alt="License" />
  </a>
</p>

</div>

---

## 🌐 About The Project

**AMAN MINI BOT** is not just another bot; it's a powerhouse of efficiency designed for the modern WhatsApp user. Built from the ground up by **AMAN**, a top-tier developer, this bot leverages cutting-edge technology to provide unparalleled speed, stability, and features. It's engineered to handle high-volume interactions while remaining lightweight and responsive. Whether for personal use, group management, or advanced automation, AMAN MINI BOT delivers.

---

## ✨ Core Features & Capabilities

Our feature set is curated for performance. Here is what makes AMAN MINI BOT stand out:

### ⚙️ Advanced Automation
*   **Auto-Responder:** Configure custom triggers and responses for any scenario.
*   **Welcome/Goodbye:** Automatically greet new members or bid farewell with fully customizable messages and media.
*   **Scheduled Messages:** Plan announcements and reminders in advance.

### 🛡️ Pro-Grade Group Management
*   **Smart Moderation:** Detect and handle spam, bad words, and unwanted links automatically.
*   **Admin Tools:** Kick, promote, demote, and manage members with simple commands.
*   **Anti-Fake:** Prevent users from specific regions or with virtual numbers from joining.

### 📥 Multi-Source Media Downloader
Download content directly within WhatsApp from popular platforms:
*   <img src="https://img.shields.io/badge/YouTube-FF0000?style=flat-square&logo=youtube&logoColor=white"/> **YouTube:** Video & Audio.
*   <img src="https://img.shields.io/badge/Instagram-E4405F?style=flat-square&logo=instagram&logoColor=white"/> **Instagram:** Reels, Posts, and IGTV.
*   <img src="https://img.shields.io/badge/TikTok-000000?style=flat-square&logo=tiktok&logoColor=white"/> **TikTok:** Watermark-free videos.
*   <img src="https://img.shields.io/badge/Twitter-1DA1F2?style=flat-square&logo=twitter&logoColor=white"/> **Twitter:** Media tweets.
*   <img src="https://img.shields.io/badge/Facebook-1877F2?style=flat-square&logo=facebook&logoColor=white"/> **Facebook:** Watch videos.

### 🎮 Fun & Interactive
*   **Games:** Play integrated games like Tic-Tac-Toe, Truth or Dare, and more.
*   **Sticker Maker:** Convert any image, video, or GIF into a WhatsApp sticker instantly.
*   **AI Integration:** Ask questions and get AI-powered responses directly in chat.

---

## 🚀 One-Click Deployment

Deploying AMAN MINI BOT is effortless. Choose your preferred platform and click the button below.

<p align="center">
  <a href="https://heroku.com/deploy?template=https://github.com/rizolegend5-art/RIZO-MINI-BOT">
    <img src="https://www.herokucdn.com/deploy/button.svg" alt="Deploy to Heroku" width="200">
  </a>
   &nbsp;&nbsp;&nbsp;
  <a href="https://railway.app/new/template?template=https://github.com/rizolegend5-art/RIZO-MINI-BOT">
    <img src="https://railway.app/button.svg" alt="Deploy on Railway" width="200">
  </a>
    &nbsp;&nbsp;&nbsp;
   <a href="https://render.com/deploy?repo=https://github.com/rizolegend5-art/RIZO-MINI-BOT">
    <img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render" width="200">
  </a>
</p>

---

## 🛠️ Manual Installation Guide

For users who prefer total control, follow these steps to run the bot locally or on a VPS (Termux compatible).

### 1. Prerequisites
Ensure you have the following installed:
*   **Node.js** (v14 or higher)
*   **Git**
*   **FFmpeg** (Required for media processing)

### 2. Steps
```bash
# 1. Clone the repository
$ git clone [https://github.com/rizolegend5-art/RIZO-MINI-BOT.git](https://github.com/rizolegend5-art/RIZO-MINI-BOT.git)
$ cd RIZO-MINI-BOT

# 2. Install dependencies
$ npm install

# 3. Configure the bot
# Rename config.example.js to config.js and edit with your credentials.
$ cp config.example.js config.js

# 4. Start the bot
$ npm start


## 🔴 AMAN Live Control Panel

A private live monitoring dashboard is available at `/panel` on the same Railway domain as the pairing page.

### Enable it on Railway
1. Open the existing Railway service → **Variables**.
2. Add `AMAN_PANEL_TOKEN` with a long, random secret value (at least 32 random characters). Do not put the real value in GitHub or `.env.example`.
3. Redeploy the service.
4. Open `https://YOUR-RAILWAY-DOMAIN/panel` and enter the same token.

### Included live data
- Backend liveness check (`/api/health`)
- Protected process metrics (`/api/panel/metrics`): process uptime, Node memory, runtime version, active Baileys sessions
- Protected recent application log buffer (`/api/panel/logs`)
- Auto-refresh every five seconds; connected WhatsApp numbers are masked in the UI

### Important limitations
- The log buffer is in memory and resets on restart; use persistent log storage for history.
- Node process RSS/heap are process metrics. OS memory and load averages may describe the host/container environment and are not a substitute for Railway's service-level metrics.
- The dashboard does not expose controls to disconnect sessions or execute commands.
- Keep `AMAN_PANEL_TOKEN` private. This is an additional monitoring feature; it does not replace Railway access controls or a full admin authentication system.


## Current setup and command permissions

The WhatsApp account used to pair a bot session is automatically its owner. Optional `OWNER_NUMBER` / `OWNER_NUMBERS` values can add configured owner accounts; set them only in your host's private environment variables, not in this ZIP.

Useful environment variables:

- `BOT_NAME` — visible bot name; default: `AMAN Mini Bot`.
- `BOT_FOOTER` — optional message footer.
- `IMAGE_PATH` — image used by menus and connection messages.
- `OWNER_NUMBER` / `OWNER_NUMBERS` — optional configured owner contact(s).
- `OWNER_DISPLAY_NUMBER` — optional owner-only display value; the public menu does not show owner numbers.
- `MONGODB_URI` — database connection for sessions and settings.
- `COBALT_API_URL` — optional URL for a Cobalt instance you own or are authorized to use; the bot no longer calls the public Cobalt endpoint by default.
- `COBALT_API_KEY` — optional Cobalt instance key; store it as a private deployment secret.
- `AMAN_PANEL_TOKEN` — optional private monitoring panel token.
- `ALYACHAN_API_KEY` — optional audio-download fallback key.
- `ISLAMIC_DL_API_KEY` — optional key for the Islamic video-download provider.

Run `npm install`, set environment variables in your hosting provider's secret store, then run `npm start`. Run `npm run check:all` for the JavaScript syntax check. Group/admin commands are limited to group admins and the paired bot owner; some actions also require the bot itself to be a group admin.

Duplicate command registrations now resolve to one canonical command instead of exposing plugin filenames in the menu. The menu puts everyday commands first and fun/emotion commands later. The ping command sends one result message, and song playback sends its thumbnail before attempting the audio download.

Third-party downloader/API availability and live WhatsApp behavior depend on the deployment environment. Source checks do not guarantee those external services are online.

## Utility commands and menu

- `.menu` opens the compact command dashboard; `.menu tools 2` opens a category page and `.menu all 2` browses every listed command. Existing command aliases still work.
- `.currency 100 USD PKR` converts using the latest published reference rate.
- `.define serendipity` looks up an English definition.
- `.unit 10 km mi` converts length, weight, or temperature without an external API.
