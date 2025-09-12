const mongoose = require('mongoose');
const Client = require('../models/client');
const Distributor = require('../models/distributeur');

/**
 * Service pour la gestion des commandes.
 */
class CommandeService {
  /**
   * Crée une nouvelle commande pour un client et un distributeur.
   * @param {Object} commandeData - Données de la commande.
   * @returns {Object} - Résultat de la création de la commande.
   */
  static async createCommande(commandeData) {
    const {
      clientId,
      distributorId,
      product,
      total,
      address,
      clientName,
      clientPhone,
      priority,
    } = commandeData;

    // Validation des IDs
    if (!clientId || !mongoose.Types.ObjectId.isValid(clientId)) {
      throw new Error("Client ID invalide.");
    }
    if (!distributorId || !mongoose.Types.ObjectId.isValid(distributorId)) {
      throw new Error("Distributor ID invalide.");
    }

    // Récupération du client et du distributeur
    const client = await Client.findById(clientId);
    if (!client) throw new Error("Client non trouvé.");

    const distributor = await Distributor.findById(distributorId);
    if (!distributor) throw new Error("Distributeur non trouvé.");

    // Vérification du produit et du stock
    const distributorProduct = distributor.products.find(
      (p) => p.name === product.name && p.type === product.type
    );
    if (!distributorProduct || distributorProduct.stock < product.quantity) {
      throw new Error("Produit indisponible ou stock insuffisant.");
    }

    // Générer un ID unique pour la commande
    const orderId = new mongoose.Types.ObjectId();
    const now = new Date();

    // Création de la commande côté client
    const clientOrder = {
      _id: orderId,
      products: [{
        name: product.name,
        type: product.type,
        quantity: product.quantity,
        price: product.price,
      }],
      total,
      address,
      clientName,
      clientPhone,
      distributorId: distributor._id,
      distributorName: distributor.user?.name || distributor.name || "Nom non défini",
      status: 'nouveau',
      priority,
      orderTime: now,
    };

    // Création de la commande côté distributeur
    const distributorOrder = {
      _id: orderId,
      clientId: client._id,
      clientName,
      clientPhone,
      address,
      products: [{
        name: product.name,
        type: product.type,
        quantity: product.quantity,
        price: product.price,
      }],
      total,
      status: 'nouveau',
      priority,
      orderTime: now,
      distributorName: distributor.user?.name || distributor.name || "Nom non défini",
    };

    // Mise à jour du client
    client.orders.push(clientOrder);
    client.credit -= total;
    client.walletTransactions.push({
      type: 'retrait',
      amount: total,
      date: now,
    });

    // Mise à jour du distributeur
    distributor.orders.push(distributorOrder);
    distributorProduct.stock -= product.quantity;
    distributor.revenue += total;

    // Sauvegarde des modifications
    await client.save();
    await distributor.save();

    return {
      success: true,
      message: "Commande passée avec succès !",
      clientOrder,
      distributorOrder,
    };
  }

  /**
   * Confirme une commande par le distributeur.
   * @param {string} orderId - ID de la commande.
   * @param {string} distributorId - ID du distributeur.
   * @param {string} newStatus - Nouveau statut de la commande.
   * @returns {Object} - Commande confirmée côté client et distributeur.
   */
  static async confirmOrder(orderId, distributorId, newStatus) {
    // Vérification du distributeur
    const distributor = await Distributor.findById(distributorId);
    if (!distributor) {
      throw new Error('Distributeur non trouvé');
    }

    // Recherche de la commande chez le distributeur
    const distOrder = distributor.orders.id(orderId);
    if (!distOrder) {
      throw new Error('Commande non trouvée chez le distributeur');
    }

    // Mise à jour du statut côté distributeur
    distOrder.status = newStatus;
    await distributor.save();

    // Recherche de la commande chez le client
    const client = await Client.findOne({ 'orders._id': orderId });
    if (!client) {
      throw new Error('Commande non trouvée chez le client');
    }

    const clientOrder = client.orders.id(orderId);
    if (!clientOrder) {
      throw new Error('Commande non trouvée dans la liste du client');
    }

    // Mise à jour du statut côté client
    clientOrder.status = newStatus;
    await client.save();

    return {
      message: 'Commande confirmée avec succès',
      clientOrder,
      distOrder,
    };
  }

  /**
   * Récupère toutes les commandes en livraison.
   * @returns {Array} - Liste des commandes en livraison.
   */
  static async getOrdersEnLivraison() {
    try {
      const clients = await Client.find({ "orders.status": "en_livraison" })
        .populate("user", "name phone")
        .populate("orders.distributorId", "user address zone");

      const orders = [];
      clients.forEach(client => {
        client.orders.forEach(order => {
          if (order.status === "en_livraison") {
            orders.push({
              clientId: client._id,
              clientName: order.clientName || client.user?.name,
              clientPhone: order.clientPhone || client.user?.phone,
              address: order.address || client.address,
              distributorId: order.distributorId,
              distributorName: order.distributorName,
              total: order.total,
              products: order.products,
              orderTime: order.orderTime,
              status: order.status,
            });
          }
        });
      });

      return orders;
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des commandes en livraison: ${error.message}`);
    }
  }
}

module.exports = CommandeService;
