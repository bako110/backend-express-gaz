const express = require('express');
const router = express.Router();
const walletController = require('../../controllers/wallet/walletController');
const authMiddleware = require('../../middlewares/auth');


// 🔹 PATCH : recharge ou retrait
router.patch('/:id/wallettransaction',   walletController.updateWalletTransaction);

// 🔹 GET : liste des transactions
router.get('/:id/transactions',  walletController.getTransactions);

// 🔹 GET : solde du wallet
router.get('/:id/balance', walletController.getBalance);

module.exports = router;
