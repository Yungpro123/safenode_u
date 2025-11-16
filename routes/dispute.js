const express = require("express");
const router = express.Router();
const disputeController = require("../controllers/disputeController");

// Identify user role
router.post("/identify/:contractId", disputeController.identifyRole);

// Get or create dispute
router.get("/:contractId", disputeController.getOrCreateDispute);

// Get messages
router.get("/messages/:disputeId", disputeController.getMessages);

// Send message
router.post("/:disputeId/message", disputeController.sendMessage);

module.exports = router;