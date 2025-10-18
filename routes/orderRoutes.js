const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Client = require('../models/client');
const CommandeController = require('../controllers/orderController');
const authMiddleware = require('../middlewares/auth'); // ton middleware JWT

// ------------------- Route pour créer une commande -------------------
router.post(
  '/',
  CommandeController.createCommande
);

// ------------------- Route pour confirmer ou mettre à jour le statut d'une commande -------------------
router.put(
  '/:orderId/status',
  CommandeController.confirmOrder
);

// ------------------- Route pour marquer une commande comme livrée -------------------
router.put(
  '/:orderId/delivered',
  CommandeController.markAsDelivered
);

// ------------------- Route pour récupérer toutes les commandes en cours de livraison -------------------
router.get(
  '/en-cours',
  CommandeController.getOrdersEnLivraison
);

// ------------------- Route pour récupérer l'historique des commandes d'un client -------------------
router.get(
  '/historique/:clientId',
  async (req, res) => {
    try {
      const { clientId } = req.params;

      // Vérification de l'ID du client
      if (!clientId || !mongoose.Types.ObjectId.isValid(clientId)) {
        return res.status(400).json({ success: false, message: "Client ID invalide." });
      }

      // Récupération du client
      const client = await Client.findById(clientId);
      if (!client) {
        return res.status(404).json({ success: false, message: "Client non trouvé." });
      }

      // Renvoi uniquement de l'historique des commandes
      return res.json({ success: true, historique: client.orders });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

module.exports = router;
