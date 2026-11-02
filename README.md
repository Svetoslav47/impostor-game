# Impostor

A party word game for a group in one room. Every player gets the same secret word except the impostor, who only gets a one-word hint. Players take turns describing the word, then vote on who's bluffing.

Play it at **[impostor-game-two-alpha.vercel.app](https://impostor-game-two-alpha.vercel.app)**. The interface is in Bulgarian.

## Two ways to play

- **One phone.** Pass the phone around; each player holds their card to see their role, then hands it on.
- **Online.** The host creates a room with a 4-digit code and everyone joins from their own phone. Rooms run on a small WebSocket server and survive locked screens and page reloads: a player who drops out rejoins the same seat.

The host picks one or two impostors and the word categories (15 categories, about 450 words).

## Stack

| Part | Tech |
|---|---|
| Web app | React 19, TypeScript, Vite, deployed on Vercel |
| Online rooms | Node.js and `ws` (`server/`), deployed on Render; rooms are kept in memory |

The message format between app and server is in [`shared/PROTOCOL.md`](shared/PROTOCOL.md). Deployment steps are in [`DEPLOY.md`](DEPLOY.md).

## Run locally

```bash
# web app
npm install
npm run dev

# online server (optional, in a second terminal; listens on port 8787)
cd server
npm install
npm start
```

On `localhost` the app looks for the server at `http://localhost:8787`. Set `VITE_SERVER_URL` at build time to point it somewhere else. Without a server, only the one-phone mode is offered.

## License

MIT. See [LICENSE](LICENSE).
