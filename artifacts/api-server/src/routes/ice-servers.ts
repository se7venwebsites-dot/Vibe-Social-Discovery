import { Router } from "express";

const router = Router();

const FALLBACK_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
];

router.get("/ice-servers", async (_req, res) => {
  const appName = process.env["METERED_APP_NAME"];
  const apiKey = process.env["METERED_API_KEY"];

  if (appName && apiKey) {
    try {
      const url = `https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const servers = await response.json() as object[];
        res.json(servers);
        return;
      }
    } catch {
    }
  }

  res.json(FALLBACK_ICE_SERVERS);
});

export default router;
