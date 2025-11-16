// controllers/adminController.js
const User = require("../models/User");
const Session = require("../models/Session");
const Dispute = require("../models/Dispute");
const Transaction = require("../models/Transaction");
const Contract = require("../models/Contract");

exports.getDashboardSummary = async (req, res) => {
  try {
    const now = new Date();

    // 🧮 Count all registered users
    const totalUsers = await User.countDocuments();

    // 🧾 Count unresolved disputes
    const unresolvedDisputes = await Dispute.countDocuments({ resolved: false });

    // 🧩 Count all contracts
    const totalContracts = await Contract.countDocuments();

    // 💸 Calculate total transactions and profit
    const transactions = await Transaction.find();
    const totalTransactedAmount = transactions.reduce((a, t) => a + (t.amount || 0), 0);
    const totalProfit = transactions
      .filter(t => t.type === "fee")
      .reduce((a, t) => a + (t.amount || 0), 0);

    // 🟢 Active Sessions (users currently logged in)
    const activeSessions = await Session.countDocuments({ expiresAt: { $gt: now } });

    // 📆 Daily Active Users (logged in past 24 hours)
    const dailyActiveUsers = await Session.distinct("userId", {
      createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) },
    }).then(u => u.length);

    // 🗓️ Monthly Active Users (logged in past 30 days)
    const monthlyActiveUsers = await Session.distinct("userId", {
      createdAt: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) },
    }).then(u => u.length);

    res.json({
      status: true,
      message: "Admin summary fetched successfully",
      data: {
        totalUsers,
        activeSessions,
        dailyActiveUsers,
        monthlyActiveUsers,
        unresolvedDisputes,
        totalContracts,
        totalTransactedAmount,
        totalProfit,
      },
    });
  } catch (err) {
    console.error("Admin summary error:", err);
    res.status(500).json({
      status: false,
      message: "Failed to load admin dashboard",
    });
  }
};