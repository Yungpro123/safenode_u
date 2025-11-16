const User = require("../models/User");

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    if (!users || users.length === 0) {
      return res.json({ success: false, message: "No users found." });
    }
    return res.json({ success: true, users });
  } catch (err) {
    console.error("❌ Dashboard Fetch Error:", err.message);
    res.status(500).json({ success: false, message: "Server error." });
  }
};


// ✅ Get user details by ID
exports.getUserById = async (req, res) => {
  try {
    const userId = req.params.id;

    // Find user but exclude password for security
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("❌ Error fetching user:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


// ✅ Get user's crypto wallet address
// controllers/userController.js


// Get wallet address by userId
exports.getUserWalletAddress = async (req, res) => {
  try {
    const userId = req.params.id; // get userId from URL

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID required" });
    }

    const user = await User.findById(userId);

    if (!user || !user.wallet || !user.wallet.address) {
      return res.status(404).json({
        success: false,
        message: "Wallet address not found",
      });
    }

    return res.json({
      success: true,
      balance:user.wallet.balance,
      currency:user.currency,
      walletAddress: user.wallet.address,
    });
  } catch (error) {
    console.error("Error fetching wallet address:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};