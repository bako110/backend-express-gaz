const mongoose = require('mongoose');
const Client = require('../models/client');
const Distributor = require('../models/distributeur');
const Livreur = require('../models/livreur');
const { assignDelivery } = require('../services/distributeur/distributorService');
const NotificationService = require('../services/notificationService');
const QRCode = require('qrcode');

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

    // Génération QR code basé sur l'ID de la commande
    let qrCodeDataUrl;
    try {
      qrCodeDataUrl = await QRCode.toDataURL(orderId.toString());
      console.log("✅ QR code généré pour la commande :", orderId.toString());
    } catch (err) {
      console.error("❌ Erreur génération QR code :", err);
      qrCodeDataUrl = null;
    }

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
      distance,
      qrCode: qrCodeDataUrl
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
      distance,
      qrCode: qrCodeDataUrl
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

    // 🔔 NOTIFICATION AU DISTRIBUTEUR
    try {
      await NotificationService.notifyDistributor(
        distributorId,
        'new_order',
        {
          orderId: orderId.toString(),
          orderNumber: `CMD-${orderId.toString().slice(-6)}`,
          clientName: clientName,
          clientPhone: clientPhone,
          total: totalOrder,
          products: [product],
          address: address,
          distance: distance,
          deliveryFee: deliveryFee || 0,
          qrCode: qrCodeDataUrl
        }
      );
      console.log("📨 Notification envoyée au distributeur");
    } catch (notificationError) {
      console.error("❌ Erreur envoi notification:", notificationError);
    }

    return {
      success: true,
      message: "Commande créée avec succès !",
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
    
    // 🔔 NOTIFICATION AU LIVREUR
    try {
      await NotificationService.notifyLivreur(
        driverId,
        'new_delivery',
        {
          orderId: orderId.toString(),
          orderNumber: `CMD-${orderId.toString().slice(-6)}`,
          clientName: result.clientName,
          clientPhone: result.clientPhone,
          address: result.address,
          amount: result.deliveryFee || 0
        }
      );
      console.log("📨 Notification envoyée au livreur");
    } catch (notificationError) {
      console.error("❌ Erreur envoi notification livreur:", notificationError);
    }
    
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

    // 🔔 NOTIFICATION AU CLIENT
    try {
      if (newStatus === 'confirme') {
        await NotificationService.notifyClient(
          client._id,
          'order_accepted',
          {
            orderId: orderId.toString(),
            orderNumber: `CMD-${orderId.toString().slice(-6)}`,
            distributorName: distributor.user?.name || distributor.name
          }
        );
        console.log("📨 Notification envoyée au client");
      }
    } catch (notificationError) {
      console.error("❌ Erreur envoi notification client:", notificationError);
    }

    return { message: 'Commande confirmée avec succès', clientOrder, distOrder };
  }

  /**
   * Marque la commande comme livrée avec gestion complète des paiements et notifications
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
      clientOrder.deliveredAt = now;
      await client.save();

      // -------------------- 2️⃣ LIVREUR --------------------
      const livreur = await Livreur.findById(livreurId);
      if (!livreur) throw new Error("Livreur non trouvé");

      const deliveryInHistory = livreur.deliveryHistory.find(
        d => d.orderId.toString() === orderId.toString()
      );

      const livreurAmount = clientOrder.deliveryFee || 0;

      if (deliveryInHistory) {
        deliveryInHistory.status = 'livre';
        deliveryInHistory.delivery = 'oui';
        deliveryInHistory.deliveredAt = now;
        deliveryInHistory.amountReceived = livreurAmount;
      } else {
        livreur.deliveryHistory.push({
          orderId,
          clientName: clientOrder.clientName || '',
          clientPhone: clientOrder.clientPhone || '',
          address: clientOrder.address || '',
          status: 'livre',
          delivery: 'oui',
          total: clientOrder.total || 0,
          amountReceived: livreurAmount,
          deliveredAt: now,
          scheduledAt: clientOrder.scheduledAt || now,
        });
      }

      // -------------------- WALLET DU LIVREUR --------------------
      if (!livreur.wallet) livreur.wallet = { balance: 0, transactions: [] };

      livreur.wallet.balance += livreurAmount;
      livreur.wallet.transactions.push({
        amount: livreurAmount,
        type: 'credit',
        description: `Frais de livraison commande ${orderId} - ${clientOrder.clientName}`,
        date: now,
        orderId: orderId
      });

      livreur.totalLivraisons = (livreur.totalLivraisons || 0) + 1;
      livreur.totalRevenue = (livreur.totalRevenue || 0) + livreurAmount;

      // Mettre à jour le statut du livreur
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
      const distributor = await Distributor.findOne({ 'orders._id': orderId });
      if (!distributor) throw new Error("Distributeur non trouvé pour cette commande");

      const distributorOrder = distributor.orders.id(orderId);
      if (!distributorOrder) throw new Error("Commande non trouvée dans les commandes du distributeur");

      distributorOrder.status = 'livre';
      distributorOrder.delivery = 'oui';
      distributorOrder.deliveredAt = now;

      // Calcul du montant pour le distributeur (prix produit seulement)
      const distributorAmount = distributorOrder.productPrice || 0;

      // Créditer le distributeur
      distributor.revenue = (distributor.revenue || 0) + distributorAmount;
      distributor.balance = (distributor.balance || 0) + distributorAmount;

      // Mettre à jour la livraison côté distributeur
      const distDelivery = distributor.deliveries?.find(
        d => d.orderId.toString() === orderId.toString()
      );
      if (distDelivery) {
        distDelivery.status = 'livre';
        distDelivery.delivery = 'oui';
        distDelivery.endTime = now;
        distDelivery.amountReceived = distributorAmount;
      }

      // -------------------- 💰 AJOUTER TRANSACTION DISTRIBUTEUR --------------------
      const transactionId = `TX-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      distributor.transactions.push({
        transactionId,
        type: 'vente',
        amount: distributorAmount,
        date: now,
        description: `Paiement reçu pour la commande ${orderId} - Client: ${clientOrder.clientName}`,
        relatedOrder: orderId,
        method: 'cash',
        status: 'terminee',
        details: {
          productAmount: distributorOrder.productPrice,
          deliveryFee: distributorOrder.deliveryFee,
          totalOrder: distributorOrder.total
        }
      });

      await distributor.save();

      // 🔔 NOTIFICATIONS DE LIVRAISON ET PAIEMENTS
      try {
        await NotificationService.notifyDeliveryCompleted(
          orderId,
          clientOrder.clientName,
          livreurAmount,
          distributorAmount
        );

        console.log("💰 Notifications de paiement envoyées avec les montants:");
        console.log(`   📦 Distributeur: ${distributorAmount.toLocaleString()} FCFA`);
        console.log(`   🚚 Livreur: ${livreurAmount.toLocaleString()} FCFA`);

      } catch (notificationError) {
        console.error("❌ Erreur envoi notifications:", notificationError);
      }

      // -------------------- ✅ RÉSULTAT DÉTAILLÉ --------------------
      return {
        success: true,
        message: "✅ Commande livrée avec succès - Paiements distribués",
        details: {
          client: {
            orderId: orderId.toString(),
            status: 'livre',
            totalPaid: clientOrder.total
          },
          livreur: {
            amountReceived: livreurAmount,
            newBalance: livreur.wallet.balance
          },
          distributor: {
            amountReceived: distributorAmount,
            newBalance: distributor.balance,
            transactionId: transactionId
          }
        },
        amounts: {
          totalOrder: clientOrder.total,
          productAmount: distributorAmount,
          deliveryFee: livreurAmount,
          distributorRevenue: distributorAmount,
          livreurRevenue: livreurAmount
        }
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

  /**
   * Rejeter une commande
   */
  static async rejectOrder(orderId, distributorId, reason = "Commande refusée") {
    const distributor = await Distributor.findById(distributorId);
    if (!distributor) throw new Error('Distributeur non trouvé');

    const distOrder = distributor.orders.id(orderId);
    if (!distOrder) throw new Error('Commande non trouvée chez le distributeur');

    distOrder.status = 'annule';
    await distributor.save();

    const client = await Client.findOne({ 'orders._id': orderId });
    if (!client) throw new Error('Commande non trouvée chez le client');

    const clientOrder = client.orders.id(orderId);
    clientOrder.status = 'annule';
    
    // Rembourser le client
    client.credit = (client.credit || 0) + clientOrder.total;
    client.walletTransactions.push({
      type: 'recharge',
      amount: clientOrder.total,
      date: new Date(),
      description: `Remboursement commande ${orderId} refusée`
    });
    
    await client.save();

    // 🔔 NOTIFICATION AU CLIENT
    try {
      await NotificationService.notifyClient(
        client._id,
        'order_rejected',
        {
          orderId: orderId.toString(),
          orderNumber: `CMD-${orderId.toString().slice(-6)}`,
          reason: reason
        }
      );
      console.log("📨 Notification de refus envoyée au client");
    } catch (notificationError) {
      console.error("❌ Erreur envoi notification refus:", notificationError);
    }

    return { message: 'Commande refusée avec succès', clientOrder, distOrder };
  }
}

module.exports = CommandeService;