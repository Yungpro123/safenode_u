const express = require("express");
const router = express.Router();
const { getDashboardSummary } = require("../controllers/adminController");

// (Optional) Add a middleware later to verify admin session or role
// const verifyAdmin = require("../middleware/verifyAdminSession");

router.get("/summary", /* verifyAdmin, */ getDashboardSummary);

module.exports = router;