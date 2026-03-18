import express, { type Express } from "express";
import cors from "cors";
import { createWriteStream, mkdirSync, existsSync } from "fs";
import { join, extname } from "path";
import router from "./routes";

const app: Express = express();

const UPLOADS_DIR = join(process.cwd(), "uploads");
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use("/uploads", express.static(UPLOADS_DIR));

app.post("/api/upload", (req, res) => {
  const { base64, mimeType } = req.body as { base64?: string; mimeType?: string };
  if (!base64) { res.status(400).json({ error: "base64 required" }); return; }

  const ext = mimeType === "image/png" ? ".png" : mimeType === "image/gif" ? ".gif" : ".jpg";
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
  const filepath = join(UPLOADS_DIR, filename);

  const data = base64.replace(/^data:image\/\w+;base64,/, "");
  const buf = Buffer.from(data, "base64");

  const ws = createWriteStream(filepath);
  ws.write(buf);
  ws.end();
  ws.on("finish", () => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN || `localhost:${process.env.PORT || 8080}`;
    const url = `https://${domain}/uploads/${filename}`;
    res.json({ url });
  });
  ws.on("error", () => res.status(500).json({ error: "Upload failed" }));
});

app.use("/api", router);

export default app;
