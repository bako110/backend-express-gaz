const express = require('express');
const router = express.Router();
const { getDeliveryInfo } = require('../controllers/frais');

// POST /api/delivery-info
router.post('/', getDeliveryInfo);

module.exports = router;
