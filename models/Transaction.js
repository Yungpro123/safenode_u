const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Link each transaction to a specific user
    required: true,
  },
  userEmail: { type: String, required: true },

  type: {
    type: String,
    enum: ["deposit", "withdraw", "release", "fee", "dispute", "payment"],
    required: true,
  },

  amount: { type: String, required: true },
  currency: { type: String, default: "NGN" },
  reference: { type: String, default: null },
  note: { type: String, default: "" },

  createdAt: { type: Date, default: Date.now },
});

// Optional: automatically sort newest first when queried
transactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Transaction", transactionSchema);module.exports