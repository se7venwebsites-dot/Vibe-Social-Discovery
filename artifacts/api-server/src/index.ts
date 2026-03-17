import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import app from "./app";

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

const server = createServer(app);

// ---- WebRTC Signaling Server ----
const wss = new WebSocketServer({ server, path: "/ws" });

interface Peer {
  ws: WebSocket;
  userId?: number;
  name?: string;
  age?: number;
  city?: string;
  filterAgeMin?: number;
  filterAgeMax?: number;
  filterCity?: string;
  partnerId?: string;
  peerId: string;
}

const waiting: Map<string, Peer> = new Map();
const connected: Map<string, Peer> = new Map();

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function sendTo(peer: Peer, data: object) {
  if (peer.ws.readyState === WebSocket.OPEN) {
    peer.ws.send(JSON.stringify(data));
  }
}

function findMatch(seeker: Peer): Peer | undefined {
  for (const [id, candidate] of waiting) {
    if (id === seeker.peerId) continue;
    // Check filters
    const seekerWantsAge =
      seeker.filterAgeMin != null && seeker.filterAgeMax != null
        ? (candidate.age ?? 99) >= seeker.filterAgeMin && (candidate.age ?? 0) <= seeker.filterAgeMax
        : true;
    const candidateWantsAge =
      candidate.filterAgeMin != null && candidate.filterAgeMax != null
        ? (seeker.age ?? 99) >= candidate.filterAgeMin && (seeker.age ?? 0) <= candidate.filterAgeMax
        : true;
    const seekerWantsCity =
      seeker.filterCity && seeker.filterCity !== "all"
        ? candidate.city === seeker.filterCity
        : true;
    const candidateWantsCity =
      candidate.filterCity && candidate.filterCity !== "all"
        ? seeker.city === candidate.filterCity
        : true;

    if (seekerWantsAge && candidateWantsAge && seekerWantsCity && candidateWantsCity) {
      return candidate;
    }
  }
  return undefined;
}

function disconnectPeer(peer: Peer) {
  waiting.delete(peer.peerId);
  connected.delete(peer.peerId);
  if (peer.partnerId) {
    const partner = connected.get(peer.partnerId);
    if (partner) {
      partner.partnerId = undefined;
      connected.delete(peer.peerId);
      waiting.set(partner.peerId, partner);
      sendTo(partner, { type: "partner-disconnected" });
    }
    peer.partnerId = undefined;
  }
}

wss.on("connection", (ws) => {
  const peerId = generateId();
  const peer: Peer = { ws, peerId };

  ws.on("message", (raw) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case "join": {
        peer.userId = msg.userId as number;
        peer.name = msg.name as string;
        peer.age = msg.age as number;
        peer.city = msg.city as string;
        peer.filterAgeMin = (msg.filterAgeMin as number) ?? undefined;
        peer.filterAgeMax = (msg.filterAgeMax as number) ?? undefined;
        peer.filterCity = (msg.filterCity as string) ?? undefined;

        waiting.set(peerId, peer);
        sendTo(peer, { type: "waiting", peerId });

        const match = findMatch(peer);
        if (match) {
          waiting.delete(peerId);
          waiting.delete(match.peerId);
          peer.partnerId = match.peerId;
          match.partnerId = peerId;
          connected.set(peerId, peer);
          connected.set(match.peerId, match);

          sendTo(peer, { type: "matched", initiator: true, partnerName: match.name, partnerAge: match.age, partnerCity: match.city });
          sendTo(match, { type: "matched", initiator: false, partnerName: peer.name, partnerAge: peer.age, partnerCity: peer.city });
        }
        break;
      }

      case "next": {
        if (peer.partnerId) {
          const partner = connected.get(peer.partnerId);
          if (partner) {
            partner.partnerId = undefined;
            connected.delete(partner.peerId);
            waiting.set(partner.peerId, partner);
            sendTo(partner, { type: "partner-disconnected" });
          }
          peer.partnerId = undefined;
          connected.delete(peerId);
        }
        waiting.delete(peerId);

        peer.filterAgeMin = (msg.filterAgeMin as number) ?? peer.filterAgeMin;
        peer.filterAgeMax = (msg.filterAgeMax as number) ?? peer.filterAgeMax;
        peer.filterCity = (msg.filterCity as string) ?? peer.filterCity;
        waiting.set(peerId, peer);
        sendTo(peer, { type: "waiting", peerId });

        const match2 = findMatch(peer);
        if (match2) {
          waiting.delete(peerId);
          waiting.delete(match2.peerId);
          peer.partnerId = match2.peerId;
          match2.partnerId = peerId;
          connected.set(peerId, peer);
          connected.set(match2.peerId, match2);
          sendTo(peer, { type: "matched", initiator: true, partnerName: match2.name, partnerAge: match2.age, partnerCity: match2.city });
          sendTo(match2, { type: "matched", initiator: false, partnerName: peer.name, partnerAge: peer.age, partnerCity: peer.city });
        }
        break;
      }

      case "offer":
      case "answer":
      case "ice-candidate": {
        if (peer.partnerId) {
          const partner = connected.get(peer.partnerId);
          if (partner) sendTo(partner, { ...msg });
        }
        break;
      }

      case "leave": {
        disconnectPeer(peer);
        break;
      }
    }
  });

  ws.on("close", () => disconnectPeer(peer));
  ws.on("error", () => disconnectPeer(peer));

  sendTo(peer, { type: "connected", peerId });
});

// ---- Start ----
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
