const User = require("../models/User");

/**
 * 🧹 Automatically removes expired sessions every 24 hours
 */
async function cleanExpiredSessions() {
  try {
    const now = new Date();
    const result = await User.updateMany(
      { sessionExpiresAt: { $lt: now } }, // find users with expired sessions
      { $unset: { sessionId: "", sessionExpiresAt: "" } } // remove session fields
    );

    if (result.modifiedCount > 0) {
      console.log(`🧹 Cleaned ${result.modifiedCount} expired sessions`);
    } else {
      console.log("🧼 No expired sessions found");
    }
  } catch (error) {
    console.error("❌ Session cleanup error:", error.message);
  }
}

module.exports = { cleanExpiredSessions };