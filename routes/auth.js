const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
// 🔓 Public routes
router.post("/register", authController.registerUser);
router.post("/login", authController.loginUser);
router.get("/verify/:token", authController.verifyEmail);


module.exports = router;
// 🔐 Protected route — get current user
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password/:token", authController.resetPassword);

// 🔓 Logout route

