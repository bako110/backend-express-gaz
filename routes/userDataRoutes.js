const express = require('express');
const router = express.Router();
const {
  getUserCompleteData,
  getUserTransactions,
  getUserOrders
} = require('../controllers/userDataController');

router.get('/complete', getUserCompleteData);
router.get('/transactions', getUserTransactions);
router.get('/orders', getUserOrders);

module.exports = router;