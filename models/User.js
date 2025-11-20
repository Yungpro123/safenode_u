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

    // NEW: Recent sellers
    recentSellers: [
      {
        name: { type: String, required: true },
        email: { type: String, required: true },
        lastContacted: { type: Date, default: Date.now },
      }
    ]
  },
  { timestamps: true } // options object
);

// Hide sensitive data when sending JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject({ getters: true, virtuals: true });

  // Ensure wallet always exists
  if (!obj.wallet) obj.wallet = { balance: 0, address: "" };

  // Remove sensitive fields safely
  if (obj.wallet) {
    delete obj.wallet.encryptedPrivateKey;
    delete obj.wallet.iv;
  }

  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;

  return obj;
};

// Method to add/update a recent seller
userSchema.methods.addRecentSeller = async function (seller) {
  // Remove if already exists
  this.recentSellers = this.recentSellers.filter(s => s.email !== seller.email);

  // Add to the front
  this.recentSellers.unshift({
    name: seller.name,
    email: seller.email,
    lastContacted: new Date(),
  });

  // Keep only last 10 recents
  if (this.recentSellers.length > 10) {
    this.recentSellers = this.recentSellers.slice(0, 10);
  }

  await this.save();
};

module.exports = mongoose.model("User", userSchema);