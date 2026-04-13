/**
 * SecureCall Signaling Server
 * ───────────────────────────
 * This server ONLY passes WebRTC negotiation messages between peers.
 * It NEVER sees, stores, or processes any audio — that's all peer-to-peer.
 *
 * Install:  npm install ws
 * Run:      node server.js
 * Deploy:   Railway, Fly.io, Render (all free tier)
 */

const WebSocket = require('ws');
const PORT = process.env.PORT || 8080;

const wss = new WebSocket.Server({ port: PORT });

// rooms: Map<roomCode, Set<WebSocket>>
const rooms = new Map();

wss.on('connection', (ws) => {
  ws.rooms = new Set();

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    const { type, room } = msg;
    if (!room) return;

    switch (type) {
      case 'JOIN':
      case 'LISTEN': {
        if (!rooms.has(room)) rooms.set(room, new Set());
        rooms.get(room).add(ws);
        ws.rooms.add(room);
        console.log(`[${new Date().toISOString()}] ${type} room=${room} peers=${rooms.get(room).size}`);
        break;
      }

      case 'JOIN_ACK':
      case 'OFFER':
      case 'ANSWER':
      case 'ICE': {
        // Relay to all OTHER peers in the same room
        const peers = rooms.get(room);
        if (!peers) return;
        const payload = JSON.stringify(msg);
        peers.forEach((peer) => {
          if (peer !== ws && peer.readyState === WebSocket.OPEN) {
            peer.send(payload);
          }
        });
        break;
      }
    }
  });

  ws.on('close', () => {
    ws.rooms.forEach((room) => {
      const peers = rooms.get(room);
      if (peers) {
        peers.delete(ws);
        if (peers.size === 0) rooms.delete(room);
      }
    });
  });
});

console.log(`SecureCall signaling server running on ws://localhost:${PORT}`);
console.log('Audio never passes through this server.');
console.log('WebRTC DTLS-SRTP encryption is end-to-end.');
