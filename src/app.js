require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const contactRoutes = require("./routes/contactRoutes");

const app = express();
// trust the first proxy (Render/Heroku/Vercel etc.)
// Place this after `const app = express();`
app.set("trust proxy", 1);

const PORT = process.env.PORT || 5000;

// Connect DB
connectDB();

// Middlewares

// Mini-normalizer + function origin
function _norm(o) {
  if (!o) return null;
  const s = o.trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return `https://${s}`;
}

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

// support multiple origins via FRONTEND_URLS or a single FRONTEND_URL
const rawEnv = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const normalizedEnv = rawEnv.map(normalizeOrigin).filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultLocalOrigins, ...normalizedEnv]));

console.log("Allowed CORS origins:", allowedOrigins);

const corsOptions = {
  origin: function (incomingOrigin, callback) {
    // allow server-side (curl/postman) requests where origin is undefined
    if (!incomingOrigin) {
      console.log("CORS: no origin header (likely server or curl). Allowing.");
      return callback(null, true);
    }

    console.log("CORS: incoming origin:", incomingOrigin);

    if (allowedOrigins.includes(incomingOrigin)) {
      // allow and let cors set Access-Control-Allow-Origin to incomingOrigin
      return callback(null, true);
    }

    // explicit deny — return an error so no CORS header is set (browser will block)
    console.warn("CORS: origin not allowed:", incomingOrigin);
    return callback(new Error("CORS policy: Origin not allowed"), false);
  },
  optionsSuccessStatus: 200,
  credentials: false,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // respond to preflight


app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api", contactRoutes);

app.get("/", (req, res) => {
  res.send({ status: "ok", timestamp: Date.now() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Server error" });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
