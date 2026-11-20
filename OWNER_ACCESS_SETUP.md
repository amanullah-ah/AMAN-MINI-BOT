# Owner and group access

## Owner identity

The WhatsApp account paired to a session is automatically treated as that bot's owner. Owner commands work from that account, including when it sends a command in a group. `OWNER_NUMBER` and comma-separated `OWNER_NUMBERS` are optional extra owner accounts; configure them in your deployment's private environment variables and restart after changes.

The `.owner` contact command is owner-only and sends the contact card privately to the command sender. Public menus and bot information do not reveal the owner number.

## Group commands

Commands in the `group` and `admin` categories require a group admin or the paired bot owner. Actions that change group membership or settings still require the bot account to have the corresponding WhatsApp admin permission.

## Bot name and picture

Set `BOT_NAME` and `IMAGE_PATH` in the deployment environment to choose the default display name and menu/connection image. `.setbotname` changes the WhatsApp profile name and current-process command branding; set `BOT_NAME` to keep the name after a restart. `.setpp` changes the WhatsApp profile picture.

## Deployment checks

Keep `MONGODB_URI`, `ALYACHAN_API_KEY`, `ISLAMIC_DL_API_KEY`, and panel tokens in the deployment's secret/environment-variable store. Use `npm run check:all` for JavaScript syntax validation. Song and other third-party API services require a live deployment to verify; their uptime is not guaranteed by the source code.
