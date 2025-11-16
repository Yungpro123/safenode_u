const Dispute = require("../models/Dispute");
const nodemailer = require("nodemailer");
const Contract = require("../models/Contract");
const User = require("../models/User");
const ImageKit = require("imagekit");
const dotenv = require("dotenv");
const {sendEmail ,sendTemplateEmail} = require("../utils/mailer");

dotenv.config();
const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: parseInt(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
const IMAGEKIT_URL = process.env.IMAGEKIT_URL_ENDPOINT;
const IMAGEKIT_PRIVATE_KEY = process.env.IMAGEKIT_PRIVATE_KEY;
const IMAGEKIT_PUBLIC_KEY = process.env.IMAGEKIT_PUBLIC_KEY;

// Setup ImageKit
const imagekit = new ImageKit({
  publicKey: IMAGEKIT_PUBLIC_KEY,
  privateKey: IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: IMAGEKIT_URL,
});

// ✅ Add your admin IDs here
const ADMIN_IDS = [
  "690a46c4bf33f15be4beb51e", 
  "671bcf9a0b8c1c5a8e0d1a46"
];

// ------------------------------------
// Identify User Role
// ------------------------------------
exports.identifyRole = async (req, res) => {
  try {
    const { userId } = req.body;
    const { contractId } = req.params;

    const user = await User.findById(userId);
    const contract = await Contract.findById(contractId);

    if (!user || !contract) {
      return res.json({ success: false, message: "User or contract not found" });
    }
console.log(userId)
    let role = null;console.log("🔍 Checking user role for:", userId);

if (ADMIN_IDS.includes(userId)) {
  console.log("✅ User is an admin");
  role = "admin";
} else if (user.email === contract.buyer) {
  console.log("✅ User is buyer:", user.email);
  role = "buyer";
} else if (user.email === contract.sellerEmail) {
  console.log("✅ User is seller:", user.email);
  role = "seller";
} else {
  console.log("❌ Unauthorized user:", user.email, userId);
  return res.json({ success: false, message: "Unauthorized access" });
}
;
    
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

// ------------------------------------
// Get or Create Dispute
// ------------------------------------
exports.getOrCreateDispute = async (req, res) => {
  try {
    const { contractId } = req.params;

    const contract = await Contract.findById(contractId);
    if (!contract)
      return res.json({ success: false, message: "Contract not found" });

    let dispute = await Dispute.findOne({ contractId });

    if (!dispute) {
      // Create a new dispute
      dispute = new Dispute({
        contractId,
        contractTitle: contract.title,
        buyerName: contract.buyer,
        sellerName: contract.sellerEmail,
        messages: [],
      });

      // Send dispute email to both parties
      sendTemplateEmail("dispute", contract.sellerEmail, {
        contractTitle: contract.title,
        reason: "Reason for the dispute",
      });

      sendTemplateEmail("dispute", contract.buyer, {
        contractTitle: contract.title,
        reason: "Reason for the dispute",
      });

      console.log("Email sent to both parties");

      // Save the dispute
      await dispute.save();

      // Update the contract status to 'disputed'
      contract.status = "disputed";
      await contract.save();

      console.log("Contract marked as disputed");
    }

    res.json({ success: true, dispute });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ------------------------------------
// Get Messages
// ------------------------------------
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


// Send Message (with message limit logic)
// ------------------------------------
exports.sendMessage = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { senderRole, message, imageBase64 } = req.body;

    const dispute = await Dispute.findById(disputeId);
    if (!dispute)
      return res.json({ success: false, message: "Dispute not found" });

    // ✅ Check if dispute is locked
    if (dispute.status === "closed" && senderRole !== "admin") {
      return res.json({
        success: false,
        message: "This dispute is closed. Please wait for admin review.",
      });
    }

    // ✅ Count messages by sender role
    const senderMessageCount = dispute.messages.filter(
      (msg) => msg.senderRole === senderRole
    ).length;

    // ✅ Prevent buyer/seller from sending more than 5 messages
    if ((senderRole === "buyer" || senderRole === "seller") && senderMessageCount >= 1000) {
      // Lock dispute if both buyer and seller have reached message limits
      const buyerDone =
        dispute.messages.filter((msg) => msg.senderRole === "buyer").length >= 1000;
      const sellerDone =
        dispute.messages.filter((msg) => msg.senderRole === "seller").length >= 1000;

      if (buyerDone && sellerDone) {
        dispute.status = "closed";
        await dispute.save();
      }

      return res.json({
        success: false,
        message: "You have reached your message limit. Please wait for the admin to respond.",
      });
    }

    // ✅ Handle image upload if provided
    let imageUrl = null;
    if (imageBase64) {
      const upload = await imagekit.upload({
        file: imageBase64,
        fileName: `dispute_${Date.now()}.jpg`,
      });
      imageUrl = upload.url;
    }

    // ✅ Push message
    dispute.messages.push({ senderRole, message, imageUrl });

    // ✅ Auto-close dispute if both sides have hit 5 messages
    const buyerCount = dispute.messages.filter((msg) => msg.senderRole === "buyer").length;
    const sellerCount = dispute.messages.filter((msg) => msg.senderRole === "seller").length;
    if (buyerCount >= 1009 && sellerCount >= 1000) {
      dispute.status = "closed";
    }

    await dispute.save();

    res.json({
      success: true,
      dispute,
      message:
        dispute.status === "closed"
          ? "Dispute closed — admin will review it shortly."
          : "Message sent successfully.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};