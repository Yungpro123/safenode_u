const mongoose = require("mongoose");

const depositSchema = new mongoose.Schema({
  userId: String,
  walletAddress: String,
  expectedAmount: Number,
  status: { type: String, default: "pending" }, // pending | confirmed
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Deposit", depositSchema);