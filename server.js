// Local development server
// Serves static files + proxies /api/* to the Vercel-style handlers
// Usage: node server.js

const http = require("http");
const fs = require("fs");
const path = require("path");

// ── Load .env ──────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eq = trimmed.indexOf("=");
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (key && !(key in process.env)) process.env[key] = val;
    });
  console.log("✅ .env loaded");
} else {
  console.warn("⚠️  .env not found – Supabase credentials missing");
}

// ── MIME types ─────────────────────────────────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".ico":  "image/x-icon",
  ".png":  "image/png",
  ".svg":  "image/svg+xml",
  ".woff2":"font/woff2",
};

// ── Parse body helper ───────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { resolve({}); }
    });
    req.on("error", reject);
  });
}

// ── Request handler ─────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;

  // Strip query string cache busters like ?v=20260510e
  const cleanPath = pathname.split("?")[0];

  // ── API routes ────────────────────────────────────────────────────────────
  if (cleanPath.startsWith("/api/")) {
    const handlerPath = path.join(__dirname, "api", cleanPath.slice(5) + ".js");
    if (!fs.existsSync(handlerPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "API route not found" }));
    }
    // Attach parsed body to req so handlers can access req.body
    req.body = await readBody(req);
    // Clear require cache in development so edits are reflected immediately
    delete require.cache[require.resolve(handlerPath)];
    try {
      const handler = require(handlerPath);
      await handler(req, res);
    } catch (err) {
      console.error("API handler error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── Static files ──────────────────────────────────────────────────────────
  let filePath = path.join(__dirname, cleanPath === "/" ? "index.html" : cleanPath);

  // If path has no extension, serve index.html (SPA fallback)
  if (!path.extname(filePath)) filePath = path.join(__dirname, "index.html");

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("404 Not Found");
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 Dev server running at http://localhost:${PORT}`);
  console.log(`   Supabase URL : ${process.env.SUPABASE_URL || "(not set)"}`);
  console.log(`   Anon Key     : ${process.env.SUPABASE_ANON_KEY ? "✓ set" : "(not set)"}\n`);
});
