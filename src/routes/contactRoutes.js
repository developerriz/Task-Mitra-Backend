const express = require("express");
const router = express.Router();
const contactController = require("../controllers/contactController");
const contactLimiter = require("../middlewares/rateLimiter");

router.post("/lead", contactLimiter, contactController.submitLead);

module.exports = router;
