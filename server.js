const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const requireAuth = require("./middlewares/authMiddleware");
dotenv.config();
const { cleanExpiredSessions } = require("./utils/cleanExpiredSessions");
const { processUsers } = require('./testnode');
const deleteOldPendingContracts = require("./utils/cleanupContracts");
// Run once


// Or run every 2 minutes
// ✅ Run once every 24 hours (86,400,000 ms)

const app = express();
const PORT = process.env.PORT || 5000;

// 🌍 CORS setup
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:7700",
    credentials: true,
  })
);

// 🧩 Body parser
app.use(cookieParser());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// 🗂️ Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// 🧠 Disable Mongoose buffering (optional)
mongoose.set("bufferCommands", false);

// ✅ Connect to MongoDBm
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("✅ MongoDB connected successfully");
    processUsers()
    setInterval(processUsers, 1 * 60 * 1000);
    deleteOldPendingContracts();
    setInterval(deleteOldPendingContracts, 1000 * 60 * 60); // 1 hour
  // Run immediately on server start
  
    // ... app.listen etc.

    // 🕒 Session setup (2 hours expiry)

app.use(
      session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
          maxAge: 1000 * 60 * 60 * 2, // ⏰ 2 hours
          httpOnly: true,
        },
      })
    );
    // ✅ Import routes
    const authRoutes = require("./routes/auth");
    const userRoutes = require("./routes/user");
    const contractRoutes = require("./routes/contract");
    const dashboardRoutes = require("./routes/dashboard");
    const viewRoutes = require("./routes/viewRoutes");
    const disputeRoutes = require("./routes/dispute");
    const depositRoutes = require("./routes/deposit");
    const withdrawRoutes = require("./routes/withdraw");
    // 🧭 Mount routes
    app.use("/", viewRoutes);
    app.use("/api/auth", authRoutes);
    app.use("/api/users",requireAuth, userRoutes);
    app.use("/api/contracts",requireAuth, contractRoutes);
    app.use("/api/dashboard",requireAuth, dashboardRoutes);
    app.use("/api/disputes",requireAuth, disputeRoutes);
    app.use("/api/withdraw",requireAuth, withdrawRoutes);
     app.use("/api/deposit",requireAuth, depositRoutes);
    // 🚪 Logout route
    app.post("/api/logout", (req, res) => {
      req.session.destroy((err) => {
        if (err)
          return res
            .status(500)
            .json({ status: false, message: "Error logging out" });
        res.clearCookie("connect.sid");
        res.json({ status: true, message: "Logged out successfully" });
      });
    });

    // 🧩 404 fallback
    app.use((req, res) => {
      res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
    });
setInterval(cleanExpiredSessions, 24 * 60 * 60 * 1000);

// 🧹 Run once at startup too
cleanExpiredSessions();
    // 🚀 Start server
    app.listen(PORT, () =>
      console.log(`✅ SafeNode running on port ${PORT}`)
    );
  })
  .catch((err) => console.error("❌ Server Error:", err.message));