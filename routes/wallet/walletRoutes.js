// routes/walletRoutes.js
const express = require('express');
const router = express.Router();
const walletController = require('../../controllers/wallet/walletController');

// POST recharge/retrait
router.post('/transaction', walletController.createTransaction);

// GET historique
router.get('/transactions/:livreurId', walletController.getTransactions);

// GET solde
router.get('/balance/:livreurId', walletController.getBalance);

module.exports = router;
