const Dispute = require("../models/Dispute");
const Contract = require("../models/Contract");
const User = require("../models/User");
const ImageKit = require("imagekit");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const { sendTemplateEmail } = require("../utils/mailer");

dotenv.config();

// ImageKit config
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// Admin IDs
const ADMIN_IDS = [
  "691bf40ee13523fe072e5dc7",
  "691bf4a400eea1b4c2d42bf0"
];

/* =========================================================================
   IDENTIFY USER ROLE
=========================================================================== */
exports.identifyRole = async (req, res) => {
  try {
    const { userId } = req.body;
    const { contractId } = req.params;

    if (!contractId || !mongoose.Types.ObjectId.isValid(contractId)) {
      return res.status(400).json({ success: false, message: "Invalid contractId" });
    }

    // Admin check first
    let role = null;
    let userEmail = null;

    if (ADMIN_IDS.includes(userId)) {
      role = "admin";
      userEmail = "admin@safenode.com"; // dummy email for admin
    }

    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({ success: false, message: "Contract not found" });
    }

    // Only query User if not admin
    let user = null;
    if (!role) {
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: "Invalid userId" });
      }
      user = await User.findById(userId);
      if (!user) return res.status(404).json({ success: false, message: "User not found" });

      if (user.email === contract.buyer) role = "buyer";
      else if (user.email === contract.sellerEmail) role = "seller";
      else return res.status(403).json({ success: false, message: "Unauthorized access" });

      userEmail = user.email;
    }

    return res.json({
      success: true,
      role,
      userEmail,
      buyerName: contract.buyername,
      sellerName: contract.sellername,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =========================================================================
   GET OR CREATE DISPUTE
=========================================================================== */
exports.getOrCreateDispute = async (req, res) => {
  try {
    const { contractId } = req.params;

    if (!contractId || !mongoose.Types.ObjectId.isValid(contractId)) {
      return res.status(400).json({ success: false, message: "Invalid contractId" });
    }

    const contract = await Contract.findById(contractId);
    if (!contract) return res.status(404).json({ success: false, message: "Contract not found" });

    let dispute = await Dispute.findOne({ contractId });

    if (!dispute) {
      dispute = new Dispute({
        contractId,
        contractTitle: contract.title,
        buyerName: contract.buyer,
        sellerName: contract.sellerEmail,
        messages: [],
      });

      // Send dispute emails using Brevo templates
      await sendTemplateEmail("dispute", contract.sellerEmail, { contractTitle: contract.title });
      await sendTemplateEmail("dispute", "ketaltd19@gmail.com", { contractTitle: contract.title });
      await sendTemplateEmail("dispute", contract.buyer, { contractTitle: contract.title });

      await dispute.save();

      contract.status = "disputed";
      await contract.save();
    }

    res.json({ success: true, dispute });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =========================================================================
   GET MESSAGES
=========================================================================== */
exports.getMessages = async (req, res) => {
  try {
    const { disputeId } = req.params;

    if (!disputeId || !mongoose.Types.ObjectId.isValid(disputeId)) {
      return res.status(400).json({ success: false, message: "Invalid disputeId" });
    }

    const dispute = await Dispute.findById(disputeId);
    if (!dispute) return res.status(404).json({ success: false, message: "Dispute not found" });

    res.json({ success: true, messages: dispute.messages });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =========================================================================
   SEND MESSAGE (buyer/seller/admin)
=========================================================================== */
exports.sendMessage = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { senderRole, message, imageBase64 } = req.body;

    if (!disputeId || !mongoose.Types.ObjectId.isValid(disputeId)) {
      return res.status(400).json({ success: false, message: "Invalid disputeId" });
    }

    const dispute = await Dispute.findById(disputeId);
    if (!dispute) return res.status(404).json({ success: false, message: "Dispute not found" });

    // Block buyer/seller when closed
    if (dispute.status === "closed" && senderRole !== "admin") {
      return res.json({
        success: false,
        message: "This dispute is closed. Please wait for admin review.",
      });
    }

    // Limit messages for buyer/seller
    const senderCount = dispute.messages.filter(m => m.senderRole === senderRole).length;
    if ((senderRole === "buyer" || senderRole === "seller") && senderCount >= 1000) {
      return res.json({
        success: false,
        message: "You have reached your message limit. Wait for admin.",
      });
    }

    // Upload image to ImageKit if present
    let imageUrl = null;
    if (imageBase64) {
      const upload = await imagekit.upload({
        file: imageBase64,
        fileName: `dispute_${Date.now()}.jpg`,
      });
      imageUrl = upload.url;
    }

    // Save message
    dispute.messages.push({ senderRole, message, imageUrl });

    const buyerCount = dispute.messages.filter(m => m.senderRole === "buyer").length;
    const sellerCount = dispute.messages.filter(m => m.senderRole === "seller").length;

    if (buyerCount >= 1000 && sellerCount >= 1000) {
      dispute.status = "closed";
    }

    await dispute.save();

    res.json({
      success: true,
      dispute,
      message: dispute.status === "closed"
        ? "Dispute closed — admin will review it."
        : "Message sent successfully.",
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};