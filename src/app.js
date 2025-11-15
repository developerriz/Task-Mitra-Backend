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

const defaultLocal = "http://localhost:5173";
const envOrigin = _norm(process.env.FRONTEND_URL);
const allowed = new Set([defaultLocal, envOrigin].filter(Boolean));

app.use(cors({
  origin: function (incomingOrigin, callback) {
    if (!incomingOrigin) return callback(null, true); // tools like curl/postman
    if (allowed.has(incomingOrigin)) return callback(null, true);
    return callback(new Error("CORS policy: Origin not allowed"), false);
  },
  optionsSuccessStatus: 200,
}));




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
