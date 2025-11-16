const Transaction = require("../models/Transaction");
const User = require("../models/User");
const crypto = require("crypto");

// Generate a unique transaction reference
function generateRef() {
  return "TX-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

// ✅ Create a successful transaction
exports.createTransaction = async (req, res) => {
  try {
    const { userId, title, amount, type } = req.body;
    if (!userId || !title || !amount || !type)
      return res.status(400).json({ message: "Missing required fields" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Create and save transaction
    const transaction = new Transaction({
      user: user._id,
      title,
      ref: generateRef(),
      amount,
      type
    });
    await transaction.save();

    // Link transaction to user
    user.transactions.push(transaction._id);
    await user.save();

    res.json({ success: true, transaction });
  } catch (err) {
    console.error("Transaction error:", err);
    res.status(500).json({ success: false, message: "Error creating transaction" });
  }
};

// 📦 Get all transactions for a user
exports.getUserTransactions = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: "User ID required" });

    const transactions = await Transaction.find({ user: userId }).sort({ date: -1 });
    res.json({ success: true, transactions });
  } catch (err) {
    console.error("Fetch transactions error:", err);
    res.status(500).json({ success: false, message: "Error fetching transactions" });
  }
};

// ✅ Get user's crypto wallet address
exports.getUserWalletAddress = async (req, res) => {
  try {
    const userId = req.params.id || req.query.id;
    const email = req.query.email;

    // Find user by ID or email
    const user = userId
      ? await User.findById(userId).select("wallet")
      : await User.findOne({ email }).select("wallet");

    if (!user || !user.wallet || !user.wallet.address) {
      return res.status(404).json({
        success: false,
        message: "Wallet address not found",
      });
    }

    return res.status(200).json({
      success: true,
      walletAddress: user.wallet.address,
    });
  } catch (error) {
    console.error("❌ Error fetching wallet address:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};