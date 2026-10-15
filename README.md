# Chain of Earths: multiplayer

A turn-based war across a chain of portal-linked parallel Earths, for 2 to 5 players in the browser.
One small Node.js server runs the game. Everyone else just opens a link.

## Run it

You need [Node.js](https://nodejs.org) 18 or newer.

```
npm install
npm start
```

Open http://localhost:8080, enter your name, and create a game. You get a link like `http://<host>/g/AB7KQ` to send to the other players.

Settings (environment variables):

| Variable   | Default  | Meaning                                  |
|------------|----------|------------------------------------------|
| `PORT`     | `8080`   | Port to listen on                        |
| `DATA_DIR` | `./data` | Where games are saved (one JSON per game)|

Games save after every quarter and every 15 seconds while orders are coming in, so restarting the server is safe.

## How a game works

- **Lobby.** The host picks 2–5 seats, an optional time limit per quarter, and whether to fill empty seats with computer realms. Players join with the code or link, a name, and a PIN. The same name and PIN gets you back into your seat from any device. Your browser also remembers your seat.
- **Simultaneous quarters.** Everyone gives orders during the same quarter, then presses **Ready**. The quarter resolves when every living player is ready, or when the time limit runs out. The time limit makes slow, play-by-mail games work: set it to 1 day and check in each evening.
- **Fog of war is enforced by the server.** Each player only receives what their own realm has seen: Earths, portals, towns, armies and deposits. Nobody can find the enemy by reading the page source.
- **Map.** Homes are about 15 Earths apart. Earths more than 5 off the main paths fracture and get monsters.
- **Victory.** A realm falls when it loses its capital. The last realm standing wins.
- **Dispatches.** The chat button in the top bar sends a message to every player.

## Putting it online

Any of these work. Pick whichever is easiest for you.

**Same house or LAN.** Run `npm start` on one computer. Others open `http://<that computer's local IP>:8080`. On Windows, find the IP with `ipconfig`; on macOS or Linux, use `ipconfig getifaddr en0` or `hostname -I`. Allow Node through the firewall if asked.

**Over the internet from your own PC, without opening router ports.** Leave the server running, then use a tunnel:
- Cloudflare Tunnel: `cloudflared tunnel --url http://localhost:8080`. It prints a public `https://….trycloudflare.com` address.
- ngrok: `ngrok http 8080`.
Send that address to your friends. The game only runs while your PC is on.

**A small always-on host.** This is best for games that run over days.
- **Render / Railway / Fly.io:** create a Node web service from this folder. The start command is `npm start`. Add a persistent disk or volume and set `DATA_DIR` to its mount path, or saved games will vanish when the service redeploys.
- **Any VPS** (DigitalOcean, Hetzner, Oracle free tier…): copy the folder, run `npm install`, and keep it running with `pm2 start server.js` or a systemd service. Put Caddy or nginx in front for HTTPS. WebSockets need no extra configuration with Caddy.

The client connects back to whatever address served the page, using `wss://` automatically under HTTPS.

## Files

```
server.js         the server: lobby, seats, turn resolution, saves, fog-filtered views
public/index.html the game client (map, panels, lobby, dispatches)
public/game.js    the shared game rules (runs on the server; the client uses it for maps and previews)
src/, build/      sources: `npm run build` regenerates public/ (needs Python 3)
```

## Notes

- The server trusts nobody. Every order is checked against the sender's own realm, so players cannot move other people's armies or spend their gold.
- Computer realms build supply lines toward the nearest rival, buy ships and harbors when a portal lies across water, and turn aggressive about 35 years in, or sooner on contact.
- One browser profile holds one seat. To test several seats on one machine, use separate browser profiles or private windows.
