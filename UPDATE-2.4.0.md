# AMAN Mini Bot 2.4.0

## Updates

- The paired WhatsApp account now has owner access. Owner-category commands are centrally protected.
- Group and admin command categories require a group admin or the bot owner.
- Duplicate commands no longer produce user-visible filename-suffixed command names; plugin loading is deterministic.
- The menu puts quick-use commands first and fun/emotion commands later.
- Ping now sends one result instead of repeatedly editing a message.
- Song playback sends the matching thumbnail before the audio download and uses shorter API/download wait limits.
- Premium access is based on the owner or a redeemable premium code.
- Bot branding and menu imagery can be set with `BOT_NAME` and `IMAGE_PATH`.

## Verification limits

JavaScript syntax and registry behavior are checked in the package. A live WhatsApp session, database connection, and third-party downloader services were not available for runtime verification.
