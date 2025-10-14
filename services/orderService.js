const mongoose = require('mongoose');
const Client = require('../models/client');
const Distributor = require('../models/distributeur');
const Livreur = require('../models/livreur');
const { assignDelivery } = require('../services/distributeur/distributorService'); // si assignDelivery est externe

/**
 * Service pour la gestion des commandes.
 */
class CommandeService {

/**
 * Crée une nouvelle commande pour un client et un distributeur.
 * Recherche automatiquement le client à partir du userId envoyé par le frontend.
 * @param {Object} commandeData - Données de la commande.
 * @returns {Object} - Résultat de la création de la commande.
 */
static async createCommande(commandeData) {
  const {
    userId,
    distributorId,
    product,
    address,
    clientName,
    clientPhone,
    priority,
    clientLocation,
    distance,
    deliveryFee
  } = commandeData;

  console.log("🟢 Données reçues pour création de commande :", commandeData);

  if (!userId) throw new Error("User ID manquant.");
  if (!distributorId || !mongoose.Types.ObjectId.isValid(distributorId))
    throw new Error("Distributor ID invalide.");

  // 🔍 Recherche du client via le champ 'user' qui référence l'User ID
  const client = await Client.findOne({ user: userId });
  if (!client) throw new Error("Client introuvable pour cet utilisateur.");

  console.log("🧾 Client trouvé :", client._id.toString(), client.name);

  const distributor = await Distributor.findById(distributorId);
  if (!distributor) throw new Error("Distributeur non trouvé.");

  console.log("🧾 Distributeur trouvé :", distributor._id.toString(), distributor.name || distributor.user?.name);

  const distributorProduct = distributor.products.find(
    (p) => p.name === product.name && p.type === product.type
  );

  if (!distributorProduct || distributorProduct.stock < product.quantity) {
    throw new Error("Produit indisponible ou stock insuffisant.");
  }

  console.log("🧾 Produit trouvé chez le distributeur :", distributorProduct.name, "Stock:", distributorProduct.stock);

  const productPrice = product.price * product.quantity;
  const totalOrder = productPrice + (deliveryFee || 0);
  const orderId = new mongoose.Types.ObjectId();
  const now = new Date();
  const deliveryEnum = (deliveryFee && deliveryFee >= 0) ? "oui" : "non";

  const clientOrder = {
    _id: orderId,
    products: [product],
    productPrice,
    deliveryFee: deliveryFee || 0,
    total: totalOrder,
    address,
    clientName,
    clientPhone,
    distributorId: distributor._id,
    distributorName: distributor.user?.name || distributor.name || "Nom non défini",
    status: 'nouveau',
    priority,
    orderTime: now,
    delivery: deliveryEnum,
    livreurId: null,
    clientLocation,
    distance
  };

  const distributorOrder = {
    _id: orderId,
    clientId: client._id,
    clientName,
    clientPhone,
    address,
    products: [product],
    productPrice,
    deliveryFee: deliveryFee || 0,
    total: totalOrder,
    status: 'nouveau',
    priority,
    orderTime: now,
    distributorName: distributor.user?.name || distributor.name || "Nom non défini",
    livreurId: null,
    delivery: deliveryEnum,
    clientLocation,
    distance
  };

  console.log("🧾 Création d'ordre avec ID :", orderId.toString());

  // Mise à jour du client
  client.orders.push(clientOrder);
  client.credit = (client.credit || 0) - totalOrder;
  client.walletTransactions.push({
    type: 'retrait',
    amount: totalOrder,
    date: now,
    description: `Commande ${orderId} payée (Produit: ${productPrice} + Livraison: ${deliveryFee || 0})`
  });

  // Mise à jour du distributeur
  distributor.orders.push(distributorOrder);
  distributorProduct.stock -= product.quantity;

  await client.save();
  await distributor.save();

  console.log("✅ Commande sauvegardée avec succès pour client et distributeur");

  return {
    success: true,
    message: "Commande créée avec succès ! Aucun paiement n'est encore effectué.",
    clientOrder,
    distributorOrder,
    deliveryFee: deliveryFee || 0,
    distance
  };
}

  /**
   * Assignation du livreur via un service séparé.
   */
  static async assignLivreur(distributorId, orderId, driverId, driverName, driverPhone) {
    const result = await assignDelivery(distributorId, orderId, driverId, driverName, driverPhone);
    return result;
  }

  /**
   * Confirme une commande par le distributeur.
   */
  static async confirmOrder(orderId, distributorId, newStatus) {
    const distributor = await Distributor.findById(distributorId);
    if (!distributor) throw new Error('Distributeur non trouvé');

    const distOrder = distributor.orders.id(orderId);
    if (!distOrder) throw new Error('Commande non trouvée chez le distributeur');

    distOrder.status = newStatus;
    await distributor.save();

    const client = await Client.findOne({ 'orders._id': orderId });
    if (!client) throw new Error('Commande non trouvée chez le client');

    const clientOrder = client.orders.id(orderId);
    clientOrder.status = newStatus;
    await client.save();

    return { message: 'Commande confirmée avec succès', clientOrder, distOrder };
  }
/**
 * ✅ Marque la commande comme livrée sur les trois côtés :
 * Client, Distributeur, et Livreur.
 *
 * Lorsqu’un livreur confirme la livraison :
 * - Le statut passe à "livré"
 * - Le champ `delivery` devient "oui"
 * - Le livreur est crédité (frais de livraison)
 * - Le distributeur est crédité (montant de la commande)
 * - Une transaction est enregistrée pour la traçabilité
 */
static async markAsDelivered(orderId, livreurId) {
  try {
    const now = new Date();

    // -------------------- 1️⃣ CLIENT --------------------
    const client = await Client.findOne({ 'orders._id': orderId });
    if (!client) throw new Error("Commande non trouvée chez le client");

    const clientOrder = client.orders.id(orderId);
    if (!clientOrder) throw new Error("Commande non trouvée dans les commandes du client");

    clientOrder.status = 'livre';
    clientOrder.delivery = 'oui';
    await client.save();

    // -------------------- 2️⃣ LIVREUR --------------------
    const livreur = await Livreur.findById(livreurId);
    if (!livreur) throw new Error("Livreur non trouvé");

    const deliveryInHistory = livreur.deliveryHistory.find(
      d => d.orderId.toString() === orderId.toString()
    );

    if (deliveryInHistory) {
      deliveryInHistory.status = 'livre';
      deliveryInHistory.delivery = 'oui';
      deliveryInHistory.deliveredAt = now;
    } else {
      livreur.deliveryHistory.push({
        orderId,
        clientName: clientOrder.clientName || '',
        clientPhone: clientOrder.clientPhone || '',
        address: clientOrder.address || '',
        status: 'livre',
        delivery: 'oui',
        total: clientOrder.total || 0,
        deliveredAt: now,
        scheduledAt: clientOrder.scheduledAt || now,
      });
    }

    // -------------------- WALLET DU LIVREUR --------------------
    const livreurAmount = clientOrder.deliveryFee || 0; // frais de livraison
    if (!livreur.wallet) livreur.wallet = { balance: 0, transactions: [] };

    livreur.wallet.balance += livreurAmount;
    livreur.wallet.transactions.push({
      amount: livreurAmount,
      type: 'credit',
      description: `Frais de livraison commande ${orderId}`,
      date: now,
    });

    livreur.totalLivraisons = (livreur.totalLivraisons || 0) + 1;
    livreur.totalRevenue = (livreur.totalRevenue || 0) + livreurAmount;

    // Supprimer la livraison du jour si terminée
    if (Array.isArray(livreur.todaysDeliveries)) {
      livreur.todaysDeliveries = livreur.todaysDeliveries.filter(
        d => d.orderId.toString() !== orderId.toString()
      );

      if (livreur.todaysDeliveries.length === 0) {
        livreur.status = 'disponible';
      }
    }

    await livreur.save();

    // -------------------- 3️⃣ DISTRIBUTEUR --------------------
    let distributorPayment = 0;
    const distributor = await Distributor.findOne({ 'orders._id': orderId });
    if (!distributor) throw new Error("Distributeur non trouvé pour cette commande");

    const distributorOrder = distributor.orders.id(orderId);
    if (!distributorOrder) throw new Error("Commande non trouvée dans les commandes du distributeur");

    distributorOrder.status = 'livre';
    distributorOrder.delivery = 'oui';

    distributorPayment = (distributorOrder.total || 0) - (distributorOrder.deliveryFee || 0);

    // Créditer le distributeur
    distributor.revenue = (distributor.revenue || 0) + distributorPayment;
    distributor.balance = (distributor.balance || 0) + distributorPayment;

    // Mettre à jour la livraison côté distributeur
    const distDelivery = distributor.deliveries?.find(
      d => d.orderId.toString() === orderId.toString()
    );
    if (distDelivery) {
      distDelivery.status = 'livre';
      distDelivery.delivery = 'oui';
      distDelivery.endTime = now;
    }

    // -------------------- 💰 AJOUTER TRANSACTION --------------------
    const transactionId = `TX-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    distributor.transactions.push({
      transactionId,
      type: 'vente',
      amount: distributorPayment,
      date: now,
      description: `Paiement reçu pour la commande ${orderId}`,
      relatedOrder: orderId,
      method: 'cash',
      status: 'terminee'
    });

    await distributor.save();

    // -------------------- ✅ RÉSULTAT --------------------
    return {
      success: true,
      message: "✅ Commande livrée avec succès — Client, Distributeur et Livreur mis à jour (paiements enregistrés).",
      clientOrder,
      livreurPayment: livreurAmount,
      distributorPayment,
      transactionId,
    };

  } catch (error) {
    console.error("❌ Erreur lors de la confirmation de livraison :", error.message);
    throw new Error(`Erreur lors de la mise à jour de la livraison : ${error.message}`);
  }
}



  /**
   * Récupère toutes les commandes en livraison.
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
              productPrice: order.productPrice,
              deliveryFee: order.deliveryFee,
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
