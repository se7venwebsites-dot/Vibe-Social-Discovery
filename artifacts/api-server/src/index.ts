import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import app from "./app";

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/api/ws" });

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

interface LiveRoom {
  hostPeerId: string;
  viewerPeerIds: Set<string>;
  cohostPeerId?: string;
}
const liveRooms: Map<number, LiveRoom> = new Map();
const allPeers: Map<string, Peer> = new Map();
const peerLiveRole: Map<string, { liveId: number; role: "host" | "viewer" | "cohost" }> = new Map();

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
    const seekerWantsAge = seeker.filterAgeMin != null && seeker.filterAgeMax != null
      ? (candidate.age ?? 99) >= seeker.filterAgeMin && (candidate.age ?? 0) <= seeker.filterAgeMax : true;
    const candidateWantsAge = candidate.filterAgeMin != null && candidate.filterAgeMax != null
      ? (seeker.age ?? 99) >= candidate.filterAgeMin && (seeker.age ?? 0) <= candidate.filterAgeMax : true;
    const seekerWantsCity = seeker.filterCity && seeker.filterCity !== "all" ? candidate.city === seeker.filterCity : true;
    const candidateWantsCity = candidate.filterCity && candidate.filterCity !== "all" ? seeker.city === candidate.filterCity : true;
    if (seekerWantsAge && candidateWantsAge && seekerWantsCity && candidateWantsCity) return candidate;
  }
  return undefined;
}

function cleanupLivePeer(peer: Peer) {
  const liveInfo = peerLiveRole.get(peer.peerId);
  if (!liveInfo) return;
  const { liveId, role } = liveInfo;
  const room = liveRooms.get(liveId);
  if (room) {
    if (role === "host") {
      room.viewerPeerIds.forEach((vId) => {
        const viewer = allPeers.get(vId);
        if (viewer) sendTo(viewer, { type: "live-ended" });
        peerLiveRole.delete(vId);
      });
      liveRooms.delete(liveId);
    } else {
      room.viewerPeerIds.delete(peer.peerId);
      const host = allPeers.get(room.hostPeerId);
      if (host) sendTo(host, { type: "viewer-left", viewerPeerId: peer.peerId });
      if (room.cohostPeerId === peer.peerId) room.cohostPeerId = undefined;
    }
  }
  peerLiveRole.delete(peer.peerId);
}

function disconnectPeer(peer: Peer) {
  waiting.delete(peer.peerId);
  connected.delete(peer.peerId);
  allPeers.delete(peer.peerId);
  cleanupLivePeer(peer);
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
  allPeers.set(peerId, peer);

  ws.on("message", (raw) => {
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    switch (msg.type) {
      // ---- Random video chat ----
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

      // ---- Live streaming ----
      case "join-live": {
        const liveId = msg.liveId as number;
        const role = msg.role as "host" | "viewer";
        peer.userId = msg.userId as number;
        peer.name = msg.name as string;
        if (role === "host") {
          const existing = liveRooms.get(liveId);
          if (existing) {
            existing.viewerPeerIds.forEach((vId) => {
              const viewer = allPeers.get(vId);
              if (viewer) sendTo(viewer, { type: "live-ended" });
              peerLiveRole.delete(vId);
            });
          }
          liveRooms.set(liveId, { hostPeerId: peerId, viewerPeerIds: new Set() });
          peerLiveRole.set(peerId, { liveId, role: "host" });
          sendTo(peer, { type: "live-joined", liveId, peerId, role: "host" });
        } else {
          const room = liveRooms.get(liveId);
          if (!room) { sendTo(peer, { type: "live-error", error: "Live nie istnieje" }); break; }
          room.viewerPeerIds.add(peerId);
          peerLiveRole.set(peerId, { liveId, role: "viewer" });
          sendTo(peer, { type: "live-joined", liveId, peerId, role: "viewer" });
          const hostPeer = allPeers.get(room.hostPeerId);
          if (hostPeer) sendTo(hostPeer, { type: "viewer-joined", viewerPeerId: peerId, viewerName: peer.name });
        }
        break;
      }

      case "live-offer": {
        const target = allPeers.get(msg.targetPeerId as string);
        if (target) sendTo(target, { type: "live-offer", offer: msg.offer, fromPeerId: peerId });
        break;
      }
      case "live-answer": {
        const target = allPeers.get(msg.targetPeerId as string);
        if (target) sendTo(target, { type: "live-answer", answer: msg.answer, fromPeerId: peerId });
        break;
      }
      case "live-ice": {
        const target = allPeers.get(msg.targetPeerId as string);
        if (target) sendTo(target, { type: "live-ice", candidate: msg.candidate, fromPeerId: peerId });
        break;
      }

      // ---- Stage (add viewer to live) ----
      case "invite-to-stage": {
        const liveInfo = peerLiveRole.get(peerId);
        if (!liveInfo || liveInfo.role !== "host") break;
        const room = liveRooms.get(liveInfo.liveId);
        if (!room) break;
        const targetPeerId = msg.targetPeerId as string;
        if (room.viewerPeerIds.has(targetPeerId)) {
          const target = allPeers.get(targetPeerId);
          if (target) sendTo(target, { type: "stage-invite", hostPeerId: peerId, hostName: peer.name || "Prowadzący" });
        }
        break;
      }
      case "stage-offer": {
        const target = allPeers.get(msg.targetPeerId as string);
        if (target) sendTo(target, { type: "stage-offer", offer: msg.offer, fromPeerId: peerId });
        break;
      }
      case "stage-answer": {
        const target = allPeers.get(msg.targetPeerId as string);
        if (target) sendTo(target, { type: "stage-answer", answer: msg.answer, fromPeerId: peerId });
        break;
      }
      case "stage-ice": {
        const target = allPeers.get(msg.targetPeerId as string);
        if (target) sendTo(target, { type: "stage-ice", candidate: msg.candidate, fromPeerId: peerId });
        break;
      }
      case "stage-leave": {
        const liveInfo = peerLiveRole.get(peerId);
        if (liveInfo) {
          const room = liveRooms.get(liveInfo.liveId);
          if (room) {
            const host = allPeers.get(room.hostPeerId);
            if (host) sendTo(host, { type: "stage-left", viewerPeerId: peerId });
          }
        }
        break;
      }

      // ---- Co-host stream to viewers ----
      case "cohost-offer": {
        const target = allPeers.get(msg.targetPeerId as string);
        if (target) sendTo(target, { type: "cohost-offer", offer: msg.offer, fromPeerId: peerId });
        break;
      }
      case "cohost-answer": {
        const target = allPeers.get(msg.targetPeerId as string);
        if (target) sendTo(target, { type: "cohost-answer", answer: msg.answer, fromPeerId: peerId });
        break;
      }
      case "cohost-ice": {
        const target = allPeers.get(msg.targetPeerId as string);
        if (target) sendTo(target, { type: "cohost-ice", candidate: msg.candidate, fromPeerId: peerId });
        break;
      }

      case "leave-live": { cleanupLivePeer(peer); break; }
      case "end-live": {
        const liveInfo = peerLiveRole.get(peerId);
        if (liveInfo && liveInfo.role === "host") cleanupLivePeer(peer);
        break;
      }

      case "live-chat": {
        const liveInfoChat = peerLiveRole.get(peerId);
        if (!liveInfoChat) break;
        const roomChat = liveRooms.get(liveInfoChat.liveId);
        if (!roomChat) break;
        const chatPayload = { type: "live-chat", name: msg.name, text: msg.text, senderId: peerId };
        const hostPeerChat = allPeers.get(roomChat.hostPeerId);
        if (hostPeerChat) sendTo(hostPeerChat, chatPayload);
        roomChat.viewerPeerIds.forEach((vId) => {
          const v = allPeers.get(vId);
          if (v) sendTo(v, chatPayload);
        });
        break;
      }

      case "live-gift": {
        const liveInfoGift = peerLiveRole.get(peerId);
        if (!liveInfoGift) break;
        const roomGift = liveRooms.get(liveInfoGift.liveId);
        if (!roomGift) break;
        const giftPayload = { type: "live-gift", senderName: msg.senderName, emoji: msg.emoji, cost: msg.cost };
        const hostPeerGift = allPeers.get(roomGift.hostPeerId);
        if (hostPeerGift) sendTo(hostPeerGift, giftPayload);
        roomGift.viewerPeerIds.forEach((vId) => {
          if (vId !== peerId) { const v = allPeers.get(vId); if (v) sendTo(v, giftPayload); }
        });
        break;
      }
    }
  });

  ws.on("close", () => disconnectPeer(peer));
  ws.on("error", () => disconnectPeer(peer));
  sendTo(peer, { type: "connected", peerId });
});

server.listen(port, () => { console.log(`Server listening on port ${port}`); });
