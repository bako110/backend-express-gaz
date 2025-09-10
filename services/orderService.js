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

  // Générer un ID unique pour la commande (partagé client/distributeur)
  const orderId = new mongoose.Types.ObjectId();
  const now = new Date();

  // Création de la commande côté client
  const clientOrder = {
    _id: orderId,  // ✅ même ID que distributeur
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
    _id: orderId,  // ✅ même ID que client
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
   * @param {string} distributorId - ID du distributeur.
   * @param {string} orderId - ID de la commande.
   * @returns {Object} - Commande confirmée côté client et distributeur.
   */
static async confirmOrder(orderId, distributorId, newStatus) {
  // 1️⃣ Mettre à jour la commande côté distributeur
  const distributor = await Distributor.findById(distributorId);
  if (!distributor) throw new Error('Distributeur non trouvé');

  const distOrder = distributor.orders.find(o => o._id.toString() === orderId);
  if (!distOrder) throw new Error('Commande non trouvée chez le distributeur');

  // Mettre à jour le statut avec celui envoyé depuis le frontend
  distOrder.status = newStatus;
  await distributor.save();

  // 2️⃣ Mettre à jour la commande côté client
  const client = await Client.findOne({ 'orders._id': orderId });
  if (!client) throw new Error('Commande non trouvée chez le client');

  const clientOrder = client.orders.id(orderId);
  clientOrder.status = newStatus;
  await client.save();

  return { clientOrder, distOrder };
}

}

module.exports = CommandeService;
