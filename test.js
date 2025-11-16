// seedUsers.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // npm install bcryptjs
const User = require('./models/User'); // Adjust path if needed
const { createTronWallet } = require('./utils/tronWallet'); // Adjust path if needed

// ---------------- CONFIG ----------------
const NUM_USERS = 1000; // Number of users to create

// ---------------- INIT ----------------
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ---------------- HELPERS ----------------
function randomEmail() {
  const chars = "abcdefghijklmnopqrstuvwxyz1234567890";
  const user = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${user}@example.com`;
}

function randomName() {
  const first = ["John", "Jane", "Alex", "Mary", "Chris", "Pat", "Sam", "Taylor"];
  const last = ["Smith", "Doe", "Brown", "Johnson", "Lee", "Davis", "Miller"];
  return `${first[Math.floor(Math.random() * first.length)]} ${last[Math.floor(Math.random() * last.length)]}`;
}

function randomCountry() {
  const countries = ["Nigeria", "USA", "UK", "India", "Canada", "Germany"];
  return countries[Math.floor(Math.random() * countries.length)];
}

// ---------------- CREATE USERS ----------------
async function createUser() {
  // Generate Tron wallet
  const wallet = await createTronWallet();

  // Generate random password and hash
  const passwordPlain = 'Password123!'; // you can generate random if you want
  const hashedPassword = await bcrypt.hash(passwordPlain, 10);

  // Create user object
  const user = new User({
    name: randomName(),
    email: randomEmail(),
    password: hashedPassword,   // Required
    country: randomCountry(),   // Required
    wallet,                     // { address, encryptedPrivateKey, iv }
    currency: "USDT",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await user.save();
  return user;
}

// ---------------- BATCH CREATION ----------------
async function createUsersBatch(numUsers) {
  console.log(`🚀 Creating ${numUsers} users...`);

  for (let i = 0; i < numUsers; i++) {
    try {
      const user = await createUser();
      console.log(`Created user ${i + 1}: ${user.email}`);
    } catch (err) {
      console.error(`failed to create user ${i + 1}:`, err.message);
    }
  }

  console.log('🎉 Finished creating users!');
  process.exit(0);
}

// ---------------- RUN ----------------
createUsersBatch(NUM_USERS);