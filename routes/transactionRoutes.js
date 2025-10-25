const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');

// Routes pour le dashboard admin
router.get('/', transactionController.getAllTransactions);
router.get('/stats', transactionController.getTransactionStats);
router.get('/search', transactionController.searchTransactions);

// Routes par utilisateur
router.get('/user/:userId', transactionController.getUserTransactions);

// Autres routes
router.get('/:transactionId', transactionController.getTransactionById);
router.patch('/:transactionId/status', transactionController.updateTransactionStatus);
router.delete('/:transactionId', transactionController.deleteTransaction);
router.post('/export', transactionController.exportTransactions);

module.exports = router;