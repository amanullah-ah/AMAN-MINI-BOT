# AMAN HELL-MD Update 2.3.0

## Fixes
- Fixed settings persistence import: `all-settings.js` called a nonexistent `updateUserConfig` export; it now calls `updateUserConfigInMongoDB`.
- Checks the database function result and gives a clearer Roman Urdu error when MongoDB persistence fails.
- Note: database-backed settings still require a valid `MONGODB_URI` and reachable MongoDB service.

## 20 new anime commands
`.animeinfo`, `.animeupcoming`, `.animetop`, `.animemovie`, `.animecharacters`, `.animegenre`, `.animeseason`, `.animegenres`, `.animebyyear`, `.animeairing`, `.animeova`, `.animespecial`, `.animemanga`, `.animepeople`, `.animefacts`, `.animevoice`, `.animepicture`, `.animehug`, `.animewave`, `.animehighfive`, `.animehandhold`.

The first 15 are metadata/search commands; last 5 are safe image/action commands. External APIs may be rate-limited or temporarily unavailable. Existing plugins were retained.
