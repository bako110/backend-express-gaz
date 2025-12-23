const express = require('express');
const router = express.Router();
const distributorController = require('../../controllers/distributeur/distributorController');
// const authMiddleware = require('../../middlewares/auth');



// Routes sécurisées
router.get('/:distributorId',  distributorController.getDistributor);
router.get('/:distributorId/orders',  distributorController.getOrders);
router.post('/assign', distributorController.assignDelivery);

module.exports = router;
