# Railway build error "failed to solve: secret Name not found" (apt libatomic1) comes from
# Railpack's auto-generated build. A plain Dockerfile skips Railpack completely.
FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

# git: some npm deps are fetched from github, python3/ffmpeg: yt-dlp + media tools
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates python3 ffmpeg libatomic1 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN npm install --omit=dev --no-audit --no-fund --legacy-peer-deps || npm install --omit=dev --no-audit --no-fund --legacy-peer-deps

EXPOSE 8000
CMD ["node", "index.js"]
