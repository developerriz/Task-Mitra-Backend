// src/app.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

// Your modules (uncomment / adjust paths as needed)
const connectDB = require("./config/db"); // ensure this exists
const contactRoutes = require("./routes/contactRoutes"); // ensure this exists

const app = express();
const PORT = process.env.PORT || 5000;

/**
 * IMPORTANT:
 * If your app is running behind a proxy (Render, Heroku, Vercel serverless adapters, etc.),
 * enable trust proxy so express and rate-limit can correctly read the client's IP
 * from X-Forwarded-For. Use `1` for one proxy (common), or `true` to trust all proxies.
 */
app.set("trust proxy", 1); // <-- Fixes ERR_ERL_UNEXPECTED_X_FORWARDED_FOR

// Connect DB
try {
  if (typeof connectDB === "function") connectDB();
} catch (err) {
  console.error("DB connect error (continuing):", err);
}

// Logging
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// Security & body parsing
app.use(helmet());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

/**
 * CORS setup (dynamic)
 * Use FRONTEND_URL or FRONTEND_URLS (comma-separated) in env for production origins
 */
const defaultLocalOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
];

const envList = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultLocalOrigins, ...envList]));
console.log("Allowed CORS origins:", allowedOrigins);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow non-browser tools (curl/postman) where origin is undefined
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS policy: Origin not allowed"), false);
  },
  optionsSuccessStatus: 200,
  credentials: false,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // preflight

/**
 * Rate limiter - tuned for public endpoints like contact/lead submissions.
 * Uses req.ip which will now be correct because trust proxy is enabled.
 */
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max requests per window per IP (adjust as needed)
  standardHeaders: true, // Return rate limit info in the RateLimit-* headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: { error: "Too many requests, please try again later." },
  // Optional: custom keyGenerator (defaults to req.ip)
  // keyGenerator: (req) => req.ip,
});

// Routes
app.get("/", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// Apply limiter to contact/lead route only
app.use("/api/lead", contactLimiter, contactRoutes); // if your contactRoutes uses '/lead' inside, adjust accordingly
// If your contactRoutes already mounts /lead, use:
// app.use("/api", contactLimiter, contactRoutes);

// Example fallback (if contactRoutes not present)
if (!contactRoutes) {
  app.post("/api/lead", contactLimiter, (req, res) => {
    const { name, email, message } = req.body || {};
    if (!name || !email) return res.status(400).json({ error: "name and email required" });
    return res.status(201).json({ status: "lead_received", data: { name, email, message } });
  });
}

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// Central error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err && err.stack ? err.stack : err);

  // handle CORS origin error thrown by corsOptions
  if (err && err.message && err.message.includes("CORS policy")) {
    return res.status(403).json({ error: err.message });
  }

  // express-rate-limit may throw a specific error code; handle generically
  if (err && err.code === "ERR_ERL_UNEXPECTED_X_FORWARDED_FOR") {
    return res.status(500).json({
      error:
        "Rate limiter error: unexpected X-Forwarded-For header. Ensure 'trust proxy' is set.",
    });
  }

  const status = err.status || 500;
  const message = err.message || "Server error";
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
