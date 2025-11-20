const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  senderRole: { type: String, enum: ["buyer", "seller", "admin"], required: true },
  message: { type: String },
  imageUrl: { type: String },
  timestamp: { type: Date, default: Date.now },
});

const disputeSchema = new mongoose.Schema({
  contractId: { type: mongoose.Schema.Types.ObjectId, ref: "Contract", required: true },
  contractTitle: { type: String, required: true },
  buyerName: { type: String, required: true },
  sellerName: { type: String, required: true },
  messages: [messageSchema],
  notificationCount: { type: Number, default: 0 }   
}, { timestamps: true });

module.exports = mongoose.model("Dispute", disputeSchema);