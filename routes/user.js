const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

router.get("/", userController.getAllUsers);
// ✅ Route to get user by ID
router.get("/:id", userController.getUserById);


router.get("/wallet/:id", userController.getUserWalletAddress);
// or support email query: /wallet?email=user@example.com
module.exports = router;