const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const User = require("../models/User");

router.get("/", userController.getAllUsers);
// ✅ Route to get user by ID
router.get("/search", userController.searchUserByEmail);  // 👈 MUST COME BEFORE /:id
router.get("/:id", userController.getUserById);

router.post("/recents", async (req, res) => {
  const { userId } = req.body;

  if (!userId) return res.json({ success: false, message: "User ID missing" });

  const user = await User.findById(userId);
  if (!user)
    return res.json({ success: false, message: "User not found" });

  res.json({
    success: true,
    recents: user.recentSellers || []
  });
});
router.get("/wallet/:id", userController.getUserWalletAddress);
// or support email query: /wallet?email=user@example.com
module.exports = router;