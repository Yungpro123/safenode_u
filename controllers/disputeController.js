const Dispute = require("../models/Dispute");
const Contract = require("../models/Contract");
const User = require("../models/User");
const ImageKit = require("imagekit");
const dotenv = require("dotenv");
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
  "690a46c4bf33f15be4beb51e",
  "671bcf9a0b8c1c5a8e0d1a46"
];

/* =========================================================================
   IDENTIFY USER ROLE
=========================================================================== */
exports.identifyRole = async (req, res) => {
  try {
    const { userId } = req.body;
    const { contractId } = req.params;

    const user = await User.findById(userId);
    const contract = await Contract.findById(contractId);

    if (!user || !contract) {
      return res.json({ success: false, message: "User or contract not found" });
    }

    let role = null;

    if (ADMIN_IDS.includes(userId)) {
      role = "admin";
    } else if (user.email === contract.buyer) {
      role = "buyer";
    } else if (user.email === contract.sellerEmail) {
      role = "seller";
    } else {
      return res.json({ success: false, message: "Unauthorized access" });
    }

    return res.json({
      success: true,
      role,
      userEmail: user.email,
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

    const contract = await Contract.findById(contractId);
    if (!contract)
      return res.json({ success: false, message: "Contract not found" });

    let dispute = await Dispute.findOne({ contractId });

    if (!dispute) {
      dispute = new Dispute({
        contractId,
        contractTitle: contract.title,
        buyerName: contract.buyer,
        sellerName: contract.sellerEmail,
        messages: [],
      });

      // 🔥 Send dispute email using Brevo template
      await sendTemplateEmail("dispute", contract.sellerEmail, {
        contractTitle: contract.title
      });

      await sendTemplateEmail("dispute", contract.buyer, {
        contractTitle: contract.title
      });

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

    const dispute = await Dispute.findById(disputeId);
    if (!dispute)
      return res.json({ success: false, message: "Dispute not found" });

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

    const dispute = await Dispute.findById(disputeId);
    if (!dispute)
      return res.json({ success: false, message: "Dispute not found" });

    // Block buyers/sellers when closed
    if (dispute.status === "closed" && senderRole !== "admin") {
      return res.json({
        success: false,
        message: "This dispute is closed. Please wait for admin review.",
      });
    }

    // LIMIT buyer/seller messages to 1000
    const senderCount = dispute.messages.filter(
      (msg) => msg.senderRole === senderRole
    ).length;

    if ((senderRole === "buyer" || senderRole === "seller") && senderCount >= 1000) {
      return res.json({
        success: false,
        message: "You have reached your message limit. Wait for admin.",
      });
    }

    // Upload image to ImageKit
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

    const buyerCount = dispute.messages.filter((m) => m.senderRole === "buyer").length;
    const sellerCount = dispute.messages.filter((m) => m.senderRole === "seller").length;

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