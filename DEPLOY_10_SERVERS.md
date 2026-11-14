# 10 Real Servers (Railway)

Har server = Railway mein ALAG service (is hi repo se). Pair site (Server 01) baaqi 9 ko `servers.json` se
padhti hai aur har ek ka REAL live count `/api/server-info` se dikhati hai.

## Har service ke Variables
| Service | SERVER_ID | SERVER_NAME |
|---|---|---|
| 01 (main, site yahin) | 1  | Server 01 |
| 02 | 2  | Server 02 |
| ... | ... | ... |
| 10 | 10 | Server 10 |

Sab mein same: `MONGODB_URI`, `OWNER_NUMBER`, aur chahein to `MAX_SESSIONS=50`.
Har service ke liye Settings > Networking > Generate Domain karein.

## servers.json
Server 02-10 ke asli Railway domains yahan likhein (placeholder badal dein), phir Server 01 redeploy:
[{"name":"Server 02","url":"https://<s02-domain>"}, ...]
(ya `SERVERS` variable mein wahi JSON.) Server 01 khud list mein automatic hota hai.

## Build error
Dockerfile + railway.json add hain, is liye Railpack ka "libatomic1 / secret Name not found" error nahi aayega.
