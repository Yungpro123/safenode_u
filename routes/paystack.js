const express = require("express");
const router = express.Router();
const walletController = require("../controllers/depositController");

router.post("/create", walletController.initializeDeposit);
router.get("/verify-deposit", walletController.verifyDeposit);

module.exports = router;