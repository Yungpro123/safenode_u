const express = require("express");
const router = express.Router();
const depositController = require("../controllers/depositController");

// 🔹 Initialize Paystack deposit
router.post("/create", depositController.initiateDeposit);

// 🔹 Verify Paystack deposit (Paystack callback)
router.get("/verify", depositController.verifyDeposit);

module.exports = router;