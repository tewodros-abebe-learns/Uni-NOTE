import express from "express";
import { createServer as createViteServer } from "vite";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  // JSON body parser with generous limit for image payloads
  app.use(express.json({ limit: "50mb" }));

  // Ensure public/uploads exists and serve it
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  // Secure static uploads with no-sniff headers
  app.use("/uploads", express.static(uploadsDir, {
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
    }
  }));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg"]);

  app.post("/api/upload-image", async (req, res) => {
    try {
      const { image, filename } = req.body;
      if (!image || typeof image !== 'string') {
        return res.status(400).json({ error: "Missing or invalid image data" });
      }

      // Max 25MB check
      if (image.length > 35 * 1024 * 1024) {
        return res.status(413).json({ error: "Payload exceeds 25MB limit" });
      }

      // Strip potential data URL prefix: e.g. "data:image/png;base64,"
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      // Determine extension from MIME header, fallback to png
      let ext = "png";
      const mimeMatch = image.match(/^data:image\/(\w+);base64,/);
      if (mimeMatch) {
        const rawExt = mimeMatch[1].toLowerCase();
        ext = rawExt === "jpeg" ? "jpg" : rawExt;
      }
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        ext = "png";
      }

      // Sanitize filename to prevent directory traversal
      const rawBase = filename ? path.basename(String(filename)) : `image_${Date.now()}`;
      const safeName = rawBase.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 50);
      const uniqueFilename = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${safeName}.${ext}`;
      const targetFilePath = path.resolve(uploadsDir, uniqueFilename);

      // Verify resolved path stays strictly inside uploadsDir
      if (!targetFilePath.startsWith(uploadsDir)) {
        return res.status(400).json({ error: "Invalid path traversal attempt" });
      }

      await fs.promises.writeFile(targetFilePath, buffer);
      const publicUrl = `/uploads/${uniqueFilename}`;

      res.json({ url: publicUrl, filename: uniqueFilename });
    } catch (error: any) {
      console.error("Upload handler error:", error);
      res.status(500).json({ error: error?.message || "Failed to save image" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
