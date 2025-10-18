const express = require('express');
const router = express.Router();
const CommandeController = require('../controllers/qrcodeController');
const authMiddleware = require('../middlewares/auth'); // middleware pour sécuriser l'accès

// Récupérer QR code pour une commande
router.get('/:orderId/qr', authMiddleware, CommandeController.getQrCode);

module.exports = router;
