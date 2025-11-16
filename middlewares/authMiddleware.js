const User = require("../models/User");
require("dotenv").config();

module.exports = async function requireAuth(req, res, next) {
  try {
    const sessionId = req.cookies.sessionId;
    if (!sessionId) {
      if (req.accepts("html")) {
        return res.redirect("/auth");
      } else {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }
    }

    const user = await User.findOne({ sessionId });

    if (!user) {
      res.clearCookie("sessionId");
      if (req.accepts("html")) {
        return res.redirect("/auth");
      } else {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }
    }

    // ⏳ Check if session expired
    if (user.sessionExpiresAt && user.sessionExpiresAt < new Date()) {
      console.log("⚠️ Session expired for:", user.email);
      user.sessionId = null;
      user.sessionExpiresAt = null;
      await user.save();
      res.clearCookie("sessionId");

      if (req.accepts("html")) {
        return res.redirect("/auth");
      } else {
        return res.status(401).json({ success: false, message: "Session expired" });
      }
    }

    // 🧠 Optional: Auto-refresh session expiry if enabled
    const autoRefresh = process.env.SESSION_AUTO_REFRESH === "true";
    const sessionDuration = parseInt(process.env.SESSION_DURATION_MINUTES || "60"); // default 60min

    if (autoRefresh) {
      user.sessionExpiresAt = new Date(Date.now() + sessionDuration * 60 * 1000);
      await user.save();
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err.message);
    return res.status(500).json({ success: false, message: "Server error verifying session" });
  }
};