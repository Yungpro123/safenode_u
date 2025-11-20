const express = require("express");
const router = express.Router();
const disputeController = require("../controllers/disputeController");

// Identify user role
router.post("/identify/:contractId", disputeController.identifyRole);

// Get or create dispute
router.get("/:contractId", disputeController.getOrCreateDispute);

// Get messages
//router.get("/messages/:disputeId", disputeController.getMessages);

// Send message
router.post("/:disputeId/message", disputeController.sendMessage);
router.post("/refund", disputeController.refundUserAfterDispute);

// routes/dashboard.js
const Contract = require("../models/Contract");
const User = require("../models/User");
// GET /api/dashboard/disputes
router.get("/", async (req, res) => {
  try {
    const userId = req.headers.userid; // frontend sends userId
    if (!userId) 
      return res.status(400).json({ success: false, message: "No userId provided" });

    // Fetch the user to get their email
    const user = await User.findById(userId);
    if (!user) 
      return res.status(404).json({ success: false, message: "User not found" });

    const email = user.email;

    // Fetch contracts where user is buyer or seller and status is disputed
    
const disputedContracts = await Contract.find({
  status: "disputed",
  $or: [{ buyer:email }, { seller:email }]
}); // step 2

    res.json({
      success: true,
      contracts: disputedContracts,
    });
  } catch (err) {
    console.error("Error fetching disputed contracts:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post('/identify/:contractId', async (req, res) => {
  const { userId } = req.body;
  const { contractId } = req.params;

  try {
    const dispute = await Dispute.findOne({ contractId });
    if(!dispute) return res.status(404).json({ success: false });

    // Determine role (simplified)
    const role = dispute.userRoleMap[userId] || 'user';

    // Fetch notification count for this user
    const notif = dispute.userNotifications.find(u => u.userId === userId);
    const notificationCount = notif ? notif.notificationCount : 0;

    res.json({ success: true, role, notificationCount });
  } catch(err){
    console.error(err);
    res.status(500).json({ success: false });
  }
});


module.exports = router;