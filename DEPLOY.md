# Deploy

The repo holds two deployables:

| Part | Where | Config |
| --- | --- | --- |
| Web app (Vite + React, repo root) | Vercel | `vercel.json` |
| Multiplayer server (`server/`, Node + `ws`, in-memory) | Render | `render.yaml` |

The web app works without the server. When the server answers `GET /health`,
the app shows the "Онлайн" mode.

## Render (server)

1. Push the repo to GitHub.
2. In Render, choose **New → Blueprint** and pick the repo. It reads `render.yaml`.
   Or create a **Web Service** by hand with:
   - Name: **`impostor-bg-server`** (this name gives the URL the app expects)
   - Runtime: Node, Root Directory: *(leave empty)*
   - Build command: `npm ci --prefix server`
   - Start command: `node server/index.js`
   - Health check path: `/health`
3. Check it works: `https://impostor-bg-server.onrender.com/health` should return `{"ok":true,...}`.

If Render gives a different URL (for example, the name was taken), set
`VITE_SERVER_URL=https://<your-url>` in Vercel's environment variables and redeploy.

The free plan sleeps after 15 minutes idle and takes about a minute to wake.
The app keeps probing in the background and shows "Онлайн" once the server is up.
Rooms live in memory, so a restart or sleep clears them.

## Vercel (web)

1. **Add New → Project** and import the repo. Root Directory: the repo root.
   `vercel.json` sets up the Vite build (`npm run build` → `dist`).
2. Optional: set the env var `VITE_SERVER_URL` (see above).

## Local

```bash
npm install && npm run dev                         # web, http://localhost:5173
npm ci --prefix server && node server/index.js     # server, http://localhost:8787
```

On localhost the app connects to `http://localhost:8787` automatically.
