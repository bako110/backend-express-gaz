const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Client = require('../models/client');
const CommandeController = require('../controllers/orderController');
const QrcodeController = require('../controllers/qrcodeController');
const authMiddleware = require('../middlewares/auth'); // ton middleware JWT
const { checkKYCVerified } = require('../middlewares/checkKYC');

// =============== ROUTES STATIQUES ET POST (AVANT LES ROUTES DYNAMIQUES) ===============

// ------------------- Route pour créer une commande (POST) - KYC REQUIS -------------------
router.post(
  '/',
  checkKYCVerified,
  CommandeController.createCommande
);

// ------------------- Route pour récupérer toutes les commandes en cours de livraison (GET AVANT :orderId) -------------------
router.get(
  '/en-cours',
  CommandeController.getOrdersEnLivraison
);

// ------------------- Route pour récupérer le code de validation d'une commande (GET statique) -------------------
// Support deux formats: 
// 1. /validation-code/:orderId (format ancien)
// 2. /:orderId/validation-code (format RESTful - ce que le frontend appelle)
router.get(
  '/validation-code/:orderId',
  authMiddleware,
  QrcodeController.getValidationCode
);

// ------------------- Route pour récupérer l'historique des commandes d'un client (GET statique) -------------------
router.get(
  '/client-history/:clientId',
  async (req, res) => {
    try {
      console.log("📋 [ROUTE] Récupération historique client:", req.params.clientId);
      const { clientId } = req.params;

      // Vérification de l'ID
      if (!clientId || !mongoose.Types.ObjectId.isValid(clientId)) {
        console.log("❌ [ROUTE] ID invalide:", clientId);
        return res.status(400).json({ success: false, message: "ID invalide." });
      }

      // Essayer de trouver le client SOIT par son _id SOIT par son user ID
      console.log("🔍 [ROUTE] Recherche 1: Par Client._id");
      let client = await Client.findById(clientId)
        .populate({
          path: 'orders.distributorId',
          select: 'address phone',
          populate: { path: 'user', select: 'name phone' }
        })
        .populate({
          path: 'historiqueCommandes.distributorId',
          select: 'address phone',
          populate: { path: 'user', select: 'name phone' }
        });
      
      if (!client) {
        console.log("🔍 [ROUTE] Recherche 2: Par Client.user (ID utilisateur)");
        client = await Client.findOne({ user: clientId })
          .populate({
            path: 'orders.distributorId',
            select: 'address phone',
            populate: { path: 'user', select: 'name phone' }
          })
          .populate({
            path: 'historiqueCommandes.distributorId',
            select: 'address phone',
            populate: { path: 'user', select: 'name phone' }
          });
      }

      if (!client) {
        console.log("❌ [ROUTE] Client non trouvé avec aucune méthode:", clientId);
        return res.status(404).json({ success: false, message: "Client non trouvé." });
      }

      console.log("✅ [ROUTE] Client trouvé:", client._id);

      // Récupérer TOUTES les commandes (en cours + historique)
      const allOrders = [
        ...(client.orders || []),
        ...(client.historiqueCommandes || [])
      ];

      console.log("✅ [ROUTE] Historique retourné:", {
        ordersCount: (client.orders || []).length,
        historiqueCount: (client.historiqueCommandes || []).length,
        total: allOrders.length
      });

      // Renvoi de l'historique COMPLET
      return res.json({ 
        success: true, 
        historique: allOrders,
        orders: client.orders || [],
        historiqueCommandes: client.historiqueCommandes || []
      });
    } catch (err) {
      console.error("❌ [ROUTE] Erreur historique:", err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// =============== ROUTE DE RÉTROCOMPATIBILITÉ (ancienne URL) ===============
// Ancienne route: /orders/historique/:userId
// Redirige vers /orders/client-history/:userId
router.get(
  '/historique/:userId',
  async (req, res) => {
    try {
      console.log("📋 [ROUTE LEGACY] Récupération via ancienne route (rétrocompatibilité):", req.params.userId);
      const { userId } = req.params;

      // Vérification de l'ID
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        console.log("❌ [ROUTE LEGACY] ID invalide:", userId);
        return res.status(400).json({ success: false, message: "ID invalide." });
      }

      // Essayer de trouver le client SOIT par son _id SOIT par son user ID
      let client = await Client.findById(userId)
        .populate({
          path: 'orders.distributorId',
          select: 'address phone',
          populate: { path: 'user', select: 'name phone' }
        })
        .populate({
          path: 'historiqueCommandes.distributorId',
          select: 'address phone',
          populate: { path: 'user', select: 'name phone' }
        });
      
      if (!client) {
        client = await Client.findOne({ user: userId })
          .populate({
            path: 'orders.distributorId',
            select: 'address phone',
            populate: { path: 'user', select: 'name phone' }
          })
          .populate({
            path: 'historiqueCommandes.distributorId',
            select: 'address phone',
            populate: { path: 'user', select: 'name phone' }
          });
      }

      if (!client) {
        console.log("❌ [ROUTE LEGACY] Client non trouvé:", userId);
        return res.status(404).json({ success: false, message: "Client non trouvé." });
      }

      console.log("✅ [ROUTE LEGACY] Client trouvé:", client._id);

      // Récupérer TOUTES les commandes (en cours + historique)
      const allOrders = [
        ...(client.orders || []),
        ...(client.historiqueCommandes || [])
      ];

      console.log("✅ [ROUTE LEGACY] Historique retourné:", {
        ordersCount: (client.orders || []).length,
        historiqueCount: (client.historiqueCommandes || []).length,
        total: allOrders.length
      });

      // Renvoi de l'historique COMPLET (compatible avec ancien format)
      return res.json({ 
        success: true, 
        historique: allOrders,
        orders: client.orders || [],
        historiqueCommandes: client.historiqueCommandes || []
      });
    } catch (err) {
      console.error("❌ [ROUTE LEGACY] Erreur historique:", err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// =============== ROUTES DYNAMIQUES AVEC PARAMÈTRES (APRÈS LES STATIQUES) ===============

// ------------------- Route pour confirmer ou mettre à jour le statut d'une commande (PUT) -------------------
router.put(
  '/:orderId/status',
  CommandeController.confirmOrder
);

// ------------------- Route pour récupérer le code de validation (format RESTful) -------------------
router.get(
  '/:orderId/validation-code',
  authMiddleware,
  QrcodeController.getValidationCode
);

// Route pour valider une livraison avec code (POST)
router.post('/:orderId/validate-delivery', CommandeController.validateDelivery);

// Route pour compléter un retrait sur place avec code (POST)
router.post('/:orderId/complete-pickup', CommandeController.completePickup);

// Route pour annuler une commande par le distributeur (POST)
router.post('/:orderId/cancel-by-distributor', CommandeController.cancelOrderByDistributor);

// Route pour annuler une commande par le livreur (POST)
router.post('/:orderId/cancel-by-driver', CommandeController.cancelOrderByDriver);

module.exports = router;
