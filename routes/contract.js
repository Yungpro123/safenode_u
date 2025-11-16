const express = require("express");
const router = express.Router();
const contractController = require("../controllers/contractController");
const requireAuth = require("../middlewares/authMiddleware");
// 🔹 Create a new escrow contract (initializes Paystack payment)
router.post("/create", contractController.createContract);

// 🔹 Verify payment after Paystack redirects
router.get("/verify-payment", contractController.verifyPayment);

// 🔹 Get single contract by ID
router.get("/:id", contractController.getContractById);

// 🔹 Seller accepts a contract
router.post("/accept/:id", contractController.acceptContract);

// 🔹 Get all contracts (admin view)
router.get("/",requireAuth, contractController.getAllContracts);

// 🔹 Get all contracts by user email
router.get("/user/email", contractController.getContractsByEmail);

router.get("/:email/balance", contractController.getUserBalance);
router.delete("/cancel/:id", contractController.cancelContract);
router.post("/request", contractController.requestPayment);

module.exports = router;