const express = require('express');
const router = express.Router();
const requireAuth = require('../middlewares/authMiddleware');
const withdrawToUser = require('../utils/withdraw'); // our revised withdraw.js
const withdrawController = require('../controllers/withdrawalController')
// POST /api/withdraw
router.post('/', requireAuth, async (req, res) => {
  try {
    await withdrawToUser(req, res);
  } catch (err) {
    console.error('Route withdrawal error:', err);
    res.status(500).json({ status: false, message: 'Server error during withdrawal' });
  }
});
// POST /api/withdraw/request (USDT withdrawals or manual requests)
router.post("/request", requireAuth, withdrawController.requestWithdrawal);

module.exports = router;