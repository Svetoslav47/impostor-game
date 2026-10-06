# Online protocol

The server (`server/`) is optional. The web app probes it and only offers the
"Онлайн" mode when it answers. State lives in memory on the server only.

## Server URL

- Production: `https://impostor-bg-server.onrender.com` (Render service `impostor-bg-server`).
- Override with the `VITE_SERVER_URL` env var at build time.
- When the page runs on `localhost`, the default is `http://localhost:8787`.

## HTTP

`GET /health` → `200 {"ok":true}`. The client probes this with a ~4s timeout,
and on failure keeps retrying every 10s in the background (Render's free tier
cold-starts in up to a minute), showing the online tab as soon as it succeeds.

## WebSocket

Connect to the same origin with `ws(s)://` and path `/ws`. All messages are JSON.

### Client → server

| type | fields | who |
| --- | --- | --- |
| `create` | `name`, `settings: {impostorCount: 1\|2, categoryIds: string[]}` | anyone |
| `join` | `code` (4 digits), `name` | anyone |
| `resume` | `code`, `playerId` | reconnecting player (ids kept in `sessionStorage`) |
| `settings` | `settings` | host, lobby only |
| `start` | — | host; from `lobby` or `playing` (= new game, same settings) |
| `reveal` | — | host, while `playing` |
| `lobby` | — | host, while `playing`: everyone goes back to the lobby so settings can change |
| `leave` | — | anyone |

### Server → client

- `{type:"joined", code, playerId}` — after `create`, `join` or `resume` succeeds.
- `{type:"room", room}` — sent to everyone on every change:
  ```
  room = {
    code, hostId,
    players: [{id, name, connected}],   // join order
    settings: {impostorCount, categoryIds},
    phase: "lobby" | "countdown" | "playing",
    countdownMs,          // ms left when phase is "countdown"
    round,                // increments every game
    starterId, starterName,                    // set in "playing"
    revealed: null | {word, category, impostorIds, impostorNames}
  }
  ```
- `{type:"card", round, card}` — private, only to each player, when `playing` starts
  (and again on `resume`). Players who joined mid-round get no card that round.
  ```
  card = {role:"crew", word} | {role:"impostor", hint}   // no category: it gave the impostor too much
  ```
- `{type:"error", message}` — message is Bulgarian, ready to show.
- `{type:"left"}` — confirms `leave`; the client goes back to the start screen.

### Rules

- Codes are 4 random digits, unique among live rooms.
- At least 3 connected players to start; 2 impostors need at least 5.
- `start` → phase `countdown` for 5s → phase `playing`, cards dealt, random starter.
- If the host leaves or stays disconnected for 30s, the next connected player becomes host.
- In the lobby, a player disconnected for 30s is removed. Mid-game they are kept.
- Rooms with nobody connected are deleted after 10 minutes.
- Names are trimmed and capped at 20 characters; duplicates get " 2", " 3", and so on.
