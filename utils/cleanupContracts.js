// utils/cleanupContracts.js
const Contract = require("../models/Contract");

/**
 * Delete all pending contracts older than 1 hour
 */
const deleteOldPendingContracts = async () => {
  try {
    const oneHourAgo = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago

    const result = await Contract.deleteMany({
      status: "pending",
      createdAt: { $lt: oneHourAgo },
    });

    if (result.deletedCount > 0) {
      console.log(`🗑️ Deleted ${result.deletedCount} pending contracts older than 1 hour`);
    }
  } catch (err) {
    console.error("❌ Error deleting pending contracts:", err.message);
  }
};

module.exports = deleteOldPendingContracts;