// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    country: { type: String, required: true },
    currency: { type: String, enum: ["NGN", "USDT"], default: "NGN" },
    verified: { type: Boolean, default: false },
    verificationToken: { type: String },
    disputeCount: { type: Number, default: 0 },

    // Wallet info
    wallet: {
      balance: { type: Number, default: 0 },
      address: { type: String },
      encryptedPrivateKey: { type: String },
      iv: { type: String },
    },

    sessionId: { type: String, default: null },
    sessionExpiresAt: { type: Date, default: null },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },

    // Role
    role: { type: String, enum: ["user", "admin"], default: "user" },
  },
  { timestamps: true } // options object
);

// Hide sensitive data when sending JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.wallet.encryptedPrivateKey;
  delete obj.wallet.iv;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  return obj;
};

module.exports = mongoose.model("User", userSchema);