import express from "express";
import { createServer as createViteServer } from "vite";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Sniff the real image type from magic bytes — never trust the client MIME. */
function sniffImageExtension(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))) return "gif";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null; // SVG and everything else is refused: SVG can carry script.
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // The browser app never uses this endpoint (media lives in IndexedDB /
  // Firebase). It is OFF unless a self-hoster explicitly enables it, so the
  // server can never become an anonymous public file host by accident.
  const uploadsEnabled = process.env.ENABLE_LOCAL_UPLOADS === "true";
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  if (uploadsEnabled && !fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  app.use("/uploads", express.static(uploadsDir, {
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "sandbox");
    },
  }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/upload-image", async (req, res) => {
    try {
      if (!uploadsEnabled) {
        return res.status(404).json({ error: "Uploads are disabled. Set ENABLE_LOCAL_UPLOADS=true to enable this self-hosted endpoint." });
      }
      const expectedToken = process.env.UPLOAD_TOKEN;
      if (expectedToken && req.header("x-upload-token") !== expectedToken) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { image, filename } = req.body;
      if (!image || typeof image !== "string") {
        return res.status(400).json({ error: "Missing or invalid image data" });
      }
      if (image.length > 35 * 1024 * 1024) {
        return res.status(413).json({ error: "Payload exceeds 25MB limit" });
      }
      const base64Data = image.replace(/^data:image\/[\w.+-]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      if (buffer.length > 25 * 1024 * 1024) {
        return res.status(413).json({ error: "Image exceeds 25MB limit" });
      }
      const ext = sniffImageExtension(buffer);
      if (!ext) {
        return res.status(415).json({ error: "Only PNG, JPEG, GIF or WebP images are accepted" });
      }
      const rawBase = filename ? path.basename(String(filename)) : `image_${Date.now()}`;
      const safeName = rawBase.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 50);
      const uniqueFilename = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${safeName}.${ext}`;
      const targetFilePath = path.resolve(uploadsDir, uniqueFilename);
      if (!targetFilePath.startsWith(uploadsDir + path.sep)) {
        return res.status(400).json({ error: "Invalid path traversal attempt" });
      }
      await fs.promises.writeFile(targetFilePath, buffer);
      res.json({ url: `/uploads/${uniqueFilename}`, filename: uniqueFilename });
    } catch (error: any) {
      console.error("Upload handler error:", error);
      res.status(500).json({ error: error?.message || "Failed to save image" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
