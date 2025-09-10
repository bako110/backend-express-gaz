const express = require('express');
const router = express.Router();
const distributorController = require('../../controllers/distributeur/distributorController');

router.get('/:distributorId', distributorController.getDistributor);
router.get('/:distributorId/orders', distributorController.getOrders);

module.exports = router;