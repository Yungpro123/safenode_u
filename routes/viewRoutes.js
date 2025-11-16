const express = require("express");
const path = require("path");
const router = express.Router();
const requireAuth = require("../middlewares/authMiddleware");
// Protect all dashboard routes


// 🧭 Helper to serve files from /public
const view = (file) => path.join(__dirname, "../public", `${file}.html`);

// 🏠 Public routes
router.get("/", (req, res) => res.sendFile(view("index")));
router.get("/auth", (req, res) => res.sendFile(view("auth")));

// 💡 All pages are now public (no protectRoute)
router.get("/dashboard",requireAuth, (req, res) => res.sendFile(view("dashboard")));
router.get("/success",requireAuth, (req, res) => res.sendFile(view("success")));
router.get("/accept",requireAuth, (req, res) => res.sendFile(view("accept")));
router.get("/contract",requireAuth,(req, res) => res.sendFile(view("contract")));
router.get("/accepted",requireAuth, (req, res) => res.sendFile(view("accepted")));
router.get("/dispute",requireAuth,(req, res) => res.sendFile(view("dispute")));
router.get("/download",requireAuth,(req, res) => res.sendFile(view("download")));
router.get("/withdraw",requireAuth,(req, res) => res.sendFile(view("withdraw")));
router.get("/addine",requireAuth,(req, res) => res.sendFile(view("admine")));
router.get("/privacy", (req, res) => res.sendFile(view("privacy")));
router.get("/contact", (req, res) => res.sendFile(view("contact")));
router.get("/help", (req, res) => res.sendFile(view("help")));
router.get("/forgot", (req, res) => res.sendFile(view("forgot-password")));
router.get("/reset", (req, res) => res.sendFile(view("reset-password")));
router.get("/T&C", (req, res) => res.sendFile(view("terms")));
router.get("/logout", (req, res) => {
      req.session.destroy((err) => {
        if (err)
          return res
            .status(500)
            .json({ status: false, message: "Error logging out" });
        res.clearCookie("sessionId");
        return res.redirect("/auth");
 
      });
    });

module.exports = router;