// In-memory multiplayer server for Импостор. See shared/PROTOCOL.md.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';

const CATEGORIES = JSON.parse(readFileSync(new URL('../shared/categories.json', import.meta.url), 'utf8'));
const PORT = Number(process.env.PORT) || 8787;
const COUNTDOWN_MS = 5000;
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 12;
const DISCONNECT_GRACE_MS = 30_000;
const EMPTY_ROOM_TTL_MS = 10 * 60_000;

/** @type {Map<string, Room>} */
const rooms = new Map();

/**
 * @typedef {{ id: string, name: string, socket: import('ws').WebSocket | null, disconnectedAt: number | null }} Player
 * @typedef {{ role: 'crew', word: string, category: {id: string, name: string} } | { role: 'impostor', hint: string, category: {id: string, name: string} }} Card
 * @typedef {{
 *   code: string, hostId: string, players: Player[],
 *   settings: { impostorCount: 1 | 2, categoryIds: string[] },
 *   phase: 'lobby' | 'countdown' | 'playing', countdownEndsAt: number, countdownTimer: NodeJS.Timeout | null,
 *   round: number, starterId: string | null, cards: Map<string, Card>,
 *   current: { word: string, hint: string, category: {id: string, name: string}, impostorIds: string[], impostorNames: string[], starterName: string } | null,
 *   revealed: boolean, usedWords: Set<string>, emptySince: number | null,
 * }} Room
 */

const randomInt = (max) => Math.floor(Math.random() * max);

function newCode() {
  for (;;) {
    const code = String(randomInt(10000)).padStart(4, '0');
    if (!rooms.has(code)) return code;
  }
}

function cleanSettings(input, fallback) {
  const known = new Set(CATEGORIES.map((c) => c.id));
  const ids = Array.isArray(input?.categoryIds) ? input.categoryIds.filter((id) => known.has(id)) : fallback.categoryIds;
  return {
    impostorCount: input?.impostorCount === 2 ? 2 : 1,
    categoryIds: ids.length ? [...new Set(ids)] : fallback.categoryIds,
  };
}

const DEFAULT_SETTINGS = { impostorCount: 1, categoryIds: CATEGORIES.map((c) => c.id) };

function cleanName(room, raw) {
  const base = String(raw ?? '').trim().replace(/\s+/g, ' ').slice(0, 20) || 'Играч';
  const taken = new Set(room?.players.map((p) => p.name) ?? []);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base.slice(0, 17)} ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

const connected = (room) => room.players.filter((p) => p.socket);

function send(socket, message) {
  if (socket && socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

function publicRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    players: room.players.map((p) => ({ id: p.id, name: p.name, connected: Boolean(p.socket) })),
    settings: room.settings,
    phase: room.phase,
    countdownMs: room.phase === 'countdown' ? Math.max(0, room.countdownEndsAt - Date.now()) : 0,
    round: room.round,
    starterId: room.phase === 'playing' ? room.starterId : null,
    starterName: room.phase === 'playing' ? room.current?.starterName ?? null : null,
    revealed:
      room.revealed && room.current
        ? {
            word: room.current.word,
            category: room.current.category,
            impostorIds: room.current.impostorIds,
            impostorNames: room.current.impostorNames,
          }
        : null,
  };
}

function broadcast(room) {
  const message = { type: 'room', room: publicRoom(room) };
  for (const p of room.players) send(p.socket, message);
}

function sendCard(room, player) {
  const card = room.cards.get(player.id);
  if (card && room.phase === 'playing') send(player.socket, { type: 'card', round: room.round, card });
}

function deal(room) {
  const pool = CATEGORIES.filter((c) => room.settings.categoryIds.includes(c.id)).flatMap((category) =>
    category.words.map((word) => ({ word, category: { id: category.id, name: category.name } })),
  );
  let fresh = pool.filter((p) => !room.usedWords.has(p.word.word));
  if (!fresh.length) {
    pool.forEach((p) => room.usedWords.delete(p.word.word));
    fresh = pool;
  }
  const pick = fresh[randomInt(fresh.length)];
  room.usedWords.add(pick.word.word);

  const players = connected(room);
  const impostorCount = players.length >= 5 ? room.settings.impostorCount : 1;
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const impostorIds = shuffled.slice(0, impostorCount).map((p) => p.id);

  room.cards = new Map(
    players.map((p) => [
      p.id,
      impostorIds.includes(p.id)
        ? { role: 'impostor', hint: pick.word.hint, category: pick.category }
        : { role: 'crew', word: pick.word.word, category: pick.category },
    ]),
  );
  room.starterId = players[randomInt(players.length)].id;
  // Names are snapshotted so the banner and reveal still read right if someone leaves mid-round.
  const nameOf = (id) => players.find((p) => p.id === id).name;
  room.current = {
    word: pick.word.word, hint: pick.word.hint, category: pick.category, impostorIds,
    impostorNames: impostorIds.map(nameOf), starterName: nameOf(room.starterId),
  };
  room.revealed = false;
}

function startCountdown(room) {
  clearTimeout(room.countdownTimer);
  room.round += 1;
  room.phase = 'countdown';
  room.countdownEndsAt = Date.now() + COUNTDOWN_MS;
  room.cards = new Map();
  room.current = null;
  room.revealed = false;
  broadcast(room);
  room.countdownTimer = setTimeout(() => {
    room.countdownTimer = null;
    if (connected(room).length < MIN_PLAYERS) {
      room.phase = 'lobby';
      broadcast(room);
      for (const p of connected(room)) send(p.socket, { type: 'error', message: 'Някой излезе — нужни са поне 3 играчи.' });
      return;
    }
    deal(room);
    room.phase = 'playing';
    broadcast(room);
    for (const p of room.players) sendCard(room, p);
  }, COUNTDOWN_MS);
}

function ensureHost(room) {
  const host = room.players.find((p) => p.id === room.hostId);
  if (host?.socket) return;
  const next = connected(room)[0];
  if (next) room.hostId = next.id;
}

function removePlayer(room, playerId) {
  room.players = room.players.filter((p) => p.id !== playerId);
  if (!room.players.length) {
    clearTimeout(room.countdownTimer);
    rooms.delete(room.code);
    return;
  }
  ensureHost(room);
  broadcast(room);
}

/** Per-socket session: which room/player this connection is bound to. */
function attach(socket, room, player) {
  if (player.socket && player.socket !== socket) {
    send(player.socket, { type: 'error', message: 'Влезе от друго устройство.' });
    player.socket.close();
  }
  player.socket = socket;
  player.disconnectedAt = null;
  room.emptySince = null;
  socket.session = { code: room.code, playerId: player.id };
  send(socket, { type: 'joined', code: room.code, playerId: player.id });
  ensureHost(room);
  broadcast(room);
  sendCard(room, player);
}

function handle(socket, msg) {
  const fail = (message) => send(socket, { type: 'error', message });
  const session = socket.session;
  const room = session ? rooms.get(session.code) : null;
  const me = room?.players.find((p) => p.id === session.playerId);

  switch (msg?.type) {
    case 'create': {
      if (me) return fail('Вече си в стая.');
      const code = newCode();
      const player = { id: randomUUID(), name: '', socket: null, disconnectedAt: null };
      /** @type {Room} */
      const created = {
        code, hostId: player.id, players: [], settings: cleanSettings(msg.settings, DEFAULT_SETTINGS),
        phase: 'lobby', countdownEndsAt: 0, countdownTimer: null, round: 0, starterId: null,
        cards: new Map(), current: null, revealed: false, usedWords: new Set(), emptySince: null,
      };
      player.name = cleanName(created, msg.name);
      created.players.push(player);
      rooms.set(code, created);
      return attach(socket, created, player);
    }
    case 'join': {
      if (me) return fail('Вече си в стая.');
      const target = rooms.get(String(msg.code ?? '').trim());
      if (!target) return fail('Няма стая с този код.');
      if (target.players.length >= MAX_PLAYERS) return fail('Стаята е пълна.');
      const player = { id: randomUUID(), name: cleanName(target, msg.name), socket: null, disconnectedAt: null };
      target.players.push(player);
      return attach(socket, target, player);
    }
    case 'resume': {
      const target = rooms.get(String(msg.code ?? ''));
      const player = target?.players.find((p) => p.id === msg.playerId);
      if (!player) return send(socket, { type: 'left' });
      return attach(socket, target, player);
    }
    case 'leave': {
      if (room && me) {
        me.socket = null;
        socket.session = null;
        removePlayer(room, me.id);
      }
      return send(socket, { type: 'left' });
    }
  }

  if (!room || !me) return fail('Не си в стая.');
  const isHost = room.hostId === me.id;

  switch (msg.type) {
    case 'settings':
      if (!isHost) return fail('Само домакинът променя настройките.');
      if (room.phase !== 'lobby') return fail('Играта вече върви.');
      room.settings = cleanSettings(msg.settings, room.settings);
      return broadcast(room);
    case 'start': {
      if (!isHost) return fail('Само домакинът пуска играта.');
      if (room.phase === 'countdown') return;
      const count = connected(room).length;
      if (count < MIN_PLAYERS) return fail('Нужни са поне 3 играчи.');
      // Players who left mid-game are dropped before the next round.
      room.players = room.players.filter((p) => p.socket);
      return startCountdown(room);
    }
    case 'reveal':
      if (!isHost) return fail('Само домакинът разкрива думата.');
      if (room.phase !== 'playing') return;
      room.revealed = true;
      return broadcast(room);
    default:
      return fail('Непозната команда.');
  }
}

function onClose(socket) {
  const session = socket.session;
  const room = session && rooms.get(session.code);
  const player = room?.players.find((p) => p.id === session.playerId);
  if (!player || player.socket !== socket) return;
  player.socket = null;
  player.disconnectedAt = Date.now();
  if (!connected(room).length) room.emptySince = Date.now();
  broadcast(room);
}

// Sweep: host hand-over, lobby removals and empty-room cleanup.
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.emptySince && now - room.emptySince > EMPTY_ROOM_TTL_MS) {
      clearTimeout(room.countdownTimer);
      rooms.delete(room.code);
      continue;
    }
    let changed = false;
    const host = room.players.find((p) => p.id === room.hostId);
    if (host && !host.socket && now - host.disconnectedAt > DISCONNECT_GRACE_MS) {
      const next = connected(room)[0];
      if (next) {
        room.hostId = next.id;
        changed = true;
      }
    }
    if (room.phase === 'lobby') {
      const stale = room.players.filter((p) => !p.socket && now - p.disconnectedAt > DISCONNECT_GRACE_MS);
      if (stale.length && connected(room).length) {
        room.players = room.players.filter((p) => !stale.includes(p));
        ensureHost(room);
        changed = true;
      }
    }
    if (changed) broadcast(room);
  }
}, 5000).unref();

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
  }
  res.writeHead(404).end();
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });

wss.on('connection', (socket) => {
  socket.isAlive = true;
  socket.on('pong', () => (socket.isAlive = true));
  socket.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(String(data));
    } catch {
      return;
    }
    handle(socket, msg);
  });
  socket.on('close', () => onClose(socket));
});

// Heartbeat keeps proxies (Render) from idling sockets and detects dead clients.
setInterval(() => {
  for (const socket of wss.clients) {
    if (!socket.isAlive) {
      socket.terminate();
      continue;
    }
    socket.isAlive = false;
    socket.ping();
  }
}, 25_000).unref();

server.listen(PORT, () => console.log(`Impostor server on :${PORT}`));
