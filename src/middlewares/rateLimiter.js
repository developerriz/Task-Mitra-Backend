const rateLimit = require("express-rate-limit");

// basic rate limiter for contact endpoint
const contactLimiter = rateLimit({
  windowMs: 1000 * 60, // 1 minute
  max: 6, // max 6 requests per IP per window
  message: { error: "Too many requests from this IP, please try again later." },
});

module.exports = contactLimiter;
