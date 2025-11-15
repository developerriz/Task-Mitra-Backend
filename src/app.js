// src/app.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const contactRoutes = require("./routes/contactRoutes");

const app = express();

// If running behind a proxy (Render/Heroku/etc.), trust it for req.ip
app.set("trust proxy", 1);

const PORT = process.env.PORT || 5000;

// Connect DB (make sure connectDB handles errors internally)
try {
  if (typeof connectDB === "function") connectDB();
} catch (err) {
  console.error("DB connect error (continuing):", err);
}

/* =========================
   CORS - robust & safe
   - supports FRONTEND_URL or FRONTEND_URLS (comma-separated)
   - normalizes entries (adds https:// if scheme missing)
   - logs allowed origins and incoming origin for debugging
   - does NOT use app.options('*') to avoid path-to-regexp issues
   ========================= */
function normalizeOrigin(origin) {
  if (!origin) return null;
  const s = origin.trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return `https://${s}`;
}

const defaultLocalOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
];

const rawEnv = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const normalizedEnv = rawEnv.map(normalizeOrigin).filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultLocalOrigins, ...normalizedEnv]));

console.log("Allowed CORS origins:", allowedOrigins);

// cors options using function origin — this sets Access-Control-Allow-Origin to the incoming origin when allowed
const corsOptions = {
  origin: function (incomingOrigin, callback) {
    // allow server-to-server tools (no Origin header)
    if (!incomingOrigin) {
      // console.log("CORS: no origin header (server/tool). Allowing.");
      return callback(null, true);
    }

    console.log("CORS: incoming origin:", incomingOrigin);

    if (allowedOrigins.includes(incomingOrigin)) {
      return callback(null, true);
    }

    console.warn("CORS: origin not allowed:", incomingOrigin);
    return callback(new Error("CORS policy: Origin not allowed"), false);
  },
  optionsSuccessStatus: 200,
  credentials: false,
};

app.use(cors(corsOptions)); // handle CORS including preflight

// Body parsers
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api", contactRoutes);

// Basic health-check
app.get("/", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// 404 handler for unknown endpoints
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// Central error handler (keep last)
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err && (err.stack || err));
  // If it's a CORS origin error produced by our cors callback, return 403
  if (err && err.message && err.message.includes("CORS policy")) {
    return res.status(403).json({ error: err.message });
  }
  res.status(500).json({ error: "Server error" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
