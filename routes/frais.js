// routes/deliveryRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/deliveryController');

// POST /api/delivery/fee
router.post('/', controller.calcDeliveryFee);

module.exports = router;
