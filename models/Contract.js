const mongoose = require("mongoose");

const contractSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  amount: { type: Number, required: true },
buyername:{type:String,required:true},
sellername:{type:String},
  buyer: { type: String },
  sellerEmail: { type: String },
currency: { type: String },

  paymentReference: { type: String, default: null },

  chargePayer: {
    type: String,
    enum: ["buyer", "seller", "split"],
    default: "buyer",
  },

  status: {
    type: String,
    enum: [
      "pending",
      "funded",
      "accepted",
      "completed",
      "disputed",
      "resolved",
    ],
    default: "pending",
  },

  paymentMethod: {
    type: String,
    enum: ["paystack", "usdt","wallet"],
    default: "paystack",
  },
disputeResolved: { type: Boolean, default: false },
fault: { type: String, enum: ["buyer", "seller", null], default: null },
refundedTo: { type: String, default: null },
refundedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Contract", contractSchema);