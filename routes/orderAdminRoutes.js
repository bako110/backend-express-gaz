// routes/orders.js
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderAdminController');

// Routes pour le dashboard admin - TOUTES les commandes
router.get('/', orderController.getAllOrders); // GET /api/orders?page=1&limit=50&status=pending
router.get('/stats', orderController.getOrderStats); // GET /api/orders/stats
router.get('/search', orderController.searchOrders); // GET /api/orders/search?q=terme

// Routes par utilisateur (gardées pour d'autres besoins)
router.get('/user/:userId', orderController.getUserOrders); // GET /api/orders/user/userId123

// Routes de gestion des commandes
router.get('/:orderId', orderController.getOrderById);
router.patch('/:orderId/status', orderController.updateOrderStatus);
router.patch('/:orderId/assign', orderController.assignDeliverer);
router.delete('/:orderId', orderController.deleteOrder);

module.exports = router;