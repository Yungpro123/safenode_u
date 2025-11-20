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


// SEARCH USER BY EMAIL
exports.searchUserByEmail = async (req, res) => {
  try {
    const email = req.query.email;

    if (!email)
      return res.status(400).json({ success: false, message: "Email is required." });

    const user = await User.findOne({
      email: { $regex: `^${email}$`, $options: "i" }
    }).select("email name"); // get the full name

    if (!user)
      return res.status(200).json({ success: false, user: null });

    // Extract first name
    const firstName = user.name.split(" ")[0] || user.name;

    res.json({ 
      success: true, 
      user: {
        email: user.email,
        username: firstName
      }
    });

  } catch (err) {
    console.error("Search Error:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// GET USER BY ID
exports.getUserById = async (req, res) => {
  try {
    const id = req.params.id;

    const user = await User.findById(id)
      .select("email username wallet currency");

    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    res.json({ success: true, user });

  } catch (err) {
    console.error("❌ Error fetching user:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};