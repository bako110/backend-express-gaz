// routes/commandeRoutes.js
const express = require('express');
const router = express.Router();
const CommandeController = require('../controllers/orderController');
const mongoose = require('mongoose');
const Client = require('../models/client');

// ------------------- Route pour créer une commande -------------------
router.post('/', CommandeController.createCommande);

// ------------------- Route pour récupérer l'historique des commandes d'un client -------------------
router.get('/historique/:clientId', async (req, res) => {
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
});

router.put('/:orderId/status', CommandeController.confirmOrder);

router.get('/en-cours/:clientId', CommandeController.getOrdersEnLivraison)

module.exports = router;
