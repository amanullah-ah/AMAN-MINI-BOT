# MongoDB ke baghair (Fast Local Mode)

`MONGODB_URI` set na ho to bot khud local mode mein chalta hai: sessions, numbers, settings, stats sab
RAM + JSON files mein (bohat tez). Promo-code wale features sirf MongoDB ke saath chalte hain.

## Data restart/redeploy par ura na jaye
Railway ka disk har deploy par saaf ho jata hai. Isay rokne ke liye:
1. Service > Settings > Volumes > **New Volume**, mount path: `/data`
2. Variables mein add karein:
   - `DATA_DIR=/data/db`
   - `SESSION_DIR=/data/session`
Volume ke baghair har redeploy par numbers dobara pair karne padenge.
