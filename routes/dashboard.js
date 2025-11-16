const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");

// ✅ Fetch user dashboard data
router.get("/", dashboardController.getDashboardData);

// ✅ Wallet actions
router.post("/wallet/deposit", dashboardController.depositToWallet);
router.post("/wallet/withdraw", dashboardController.withdrawFromWallet);

// ✅ Update user settings
router.put("/update-settings", dashboardController.updateSettings);


router.post("/release-funds", dashboardController.releaseFunds);
// ✅ Get transactions by email
router.get("/transactions", dashboardController.getTransactionsByUserId);
module.exports = router;