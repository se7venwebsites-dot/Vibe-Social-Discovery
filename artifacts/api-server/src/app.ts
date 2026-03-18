import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";

const app: Express = express();

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

app.post("/api/upload", (req, res) => {
  const { base64, mimeType } = req.body as { base64?: string; mimeType?: string };
  if (!base64) { res.status(400).json({ error: "base64 required" }); return; }

  const mime = mimeType && mimeType.startsWith("image/") ? mimeType : "image/jpeg";
  const data = base64.replace(/^data:image\/[^;]+;base64,/, "");
  const url = `data:${mime};base64,${data}`;
  res.json({ url });
});

app.use("/api", router);

export default app;
