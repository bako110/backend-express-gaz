const mongoose = require('mongoose');
const Client = require('../models/client');
const Distributor = require('../models/distributeur');
const Livreur = require('../models/livreur');
const { assignDelivery } = require('../services/distributeur/distributorService');
const NotificationService = require('../services/notificationService');

/**
 * Service pour la gestion des commandes.
 */
class CommandeService {

  /**
   * Génère un code numérique unique à 6 chiffres
   */
  static generateValidationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Génère un ID de transaction unique
   */
  static generateTransactionId() {
    return `TX-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }

  /**
   * Crée une nouvelle commande pour un client et un distributeur.
   */
  static async createCommande(commandeData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
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
        deliveryFee = 0
      } = commandeData;

      console.log("🟢 [CREATE_COMMANDE] Données reçues:", commandeData);

      if (!userId) throw new Error("User ID manquant.");
      if (!distributorId || !mongoose.Types.ObjectId.isValid(distributorId))
        throw new Error("Distributor ID invalide.");

      // 🔍 Recherche du client via le champ 'user' qui référence l'User ID
      const client = await Client.findOne({ user: userId }).session(session);
      if (!client) throw new Error("Client introuvable pour cet utilisateur.");

      console.log("🧾 [CREATE_COMMANDE] Client trouvé:", client._id.toString());

      const distributor = await Distributor.findById(distributorId).session(session);
      if (!distributor) throw new Error("Distributeur non trouvé.");

      console.log("🧾 [CREATE_COMMANDE] Distributeur trouvé:", distributor._id.toString());

      // 🔍 Recherche du produit
      console.log("📦 [CREATE_COMMANDE] Produits disponibles chez le distributeur:");
      distributor.products.forEach((p, index) => {
        console.log(`   ${index + 1}. ${p.name} | Type: ${p.type} | FuelType: ${p.fuelType} | Stock: ${p.stock} | Prix: ${p.price}`);
      });

      let distributorProduct = distributor.products.find(
        (p) => p.name === product.name && p.type === product.type
      );

      // Recherche alternative
      if (!distributorProduct) {
        distributorProduct = distributor.products.find(
          (p) => p.name === product.name && p.fuelType === product.type
        );
      }

      if (!distributorProduct) {
        distributorProduct = distributor.products.find(
          (p) => p.name === product.name
        );
      }

      if (!distributorProduct) {
        console.log("❌ [CREATE_COMMANDE] Aucun produit correspondant trouvé");
        throw new Error("Produit indisponible ou stock insuffisant.");
      }

      if (distributorProduct.stock < product.quantity) {
        console.log("❌ [CREATE_COMMANDE] Stock insuffisant:", {
          stockDisponible: distributorProduct.stock,
          quantiteDemandee: product.quantity
        });
        throw new Error("Stock insuffisant pour ce produit.");
      }

      console.log("✅ [CREATE_COMMANDE] Produit trouvé:", {
        nom: distributorProduct.name,
        type: distributorProduct.type,
        fuelType: distributorProduct.fuelType,
        stock: distributorProduct.stock,
        prix: distributorProduct.price
      });

      // 🧮 CALCULS FINANCIERS
      const productPrice = distributorProduct.price * product.quantity;
      const totalOrder = productPrice + deliveryFee;
      const orderId = new mongoose.Types.ObjectId();
      const now = new Date();
      const deliveryEnum = deliveryFee > 0 ? "oui" : "non";

      // 🔢 Génération d'un code de validation
      const validationCode = this.generateValidationCode();
      console.log("✅ [CREATE_COMMANDE] Code de validation généré:", validationCode);

      // 💰 VÉRIFICATION DU SOLDE DU CLIENT
      const ancienSoldeClient = client.credit || 0;
      if (ancienSoldeClient < totalOrder) {
        throw new Error(`Solde insuffisant. Solde actuel: ${ancienSoldeClient}, Montant requis: ${totalOrder}`);
      }

      console.log("💰 [CREATE_COMMANDE] Solde client vérifié:", {
        ancienSolde: ancienSoldeClient,
        montantCommande: totalOrder,
        nouveauSolde: ancienSoldeClient - totalOrder
      });

      // 📦 CRÉATION DES COMMANDES
      const clientOrder = {
        _id: orderId,
        products: [{
          name: distributorProduct.name,
          type: distributorProduct.type,
          fuelType: distributorProduct.fuelType,
          quantity: product.quantity,
          price: distributorProduct.price,
          total: productPrice
        }],
        productPrice,
        deliveryFee,
        total: totalOrder,
        address,
        clientName,
        clientPhone,
        distributorId: distributor._id,
        distributorName: distributor.user?.name || distributor.name || "Distributeur",
        status: 'nouveau',
        priority,
        orderTime: now,
        delivery: deliveryEnum,
        livreurId: null,
        clientLocation,
        distance,
        validationCode
      };

      const distributorOrder = {
        _id: orderId,
        clientId: client._id,
        clientName,
        clientPhone,
        address,
        products: [{
          name: distributorProduct.name,
          type: distributorProduct.type,
          fuelType: distributorProduct.fuelType,
          quantity: product.quantity,
          price: distributorProduct.price,
          total: productPrice
        }],
        productPrice,
        deliveryFee,
        total: totalOrder,
        status: 'nouveau',
        priority,
        orderTime: now,
        distributorName: distributor.user?.name || distributor.name || "Distributeur",
        livreurId: null,
        delivery: deliveryEnum,
        clientLocation,
        distance,
        validationCode
      };

      console.log("🧾 [CREATE_COMMANDE] Création commande - ID:", orderId.toString());

      // 💳 MISE À JOUR FINANCIÈRE CLIENT
      client.orders.push(clientOrder);
      client.credit = ancienSoldeClient - totalOrder;
      
      const transactionId = this.generateTransactionId();
      client.walletTransactions.push({
        transactionId,
        type: 'retrait',
        amount: totalOrder,
        date: now,
        description: `Paiement commande ${orderId}`,
        details: {
          productAmount: productPrice,
          deliveryFee: deliveryFee,
          products: `${product.quantity}x ${distributorProduct.name}`
        },
        newBalance: client.credit
      });

      // 📦 MISE À JOUR DISTRIBUTEUR
      distributor.orders.push(distributorOrder);
      distributorProduct.stock -= product.quantity;

      // Sauvegarde dans la transaction
      await client.save({ session });
      await distributor.save({ session });

      // ✅ VALIDATION DE LA TRANSACTION
      await session.commitTransaction();
      console.log("✅ [CREATE_COMMANDE] Commande sauvegardée avec succès");

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
            deliveryFee: deliveryFee,
            validationCode: validationCode
          }
        );
        console.log("📨 [CREATE_COMMANDE] Notification envoyée au distributeur");
      } catch (notificationError) {
        console.error("❌ [CREATE_COMMANDE] Erreur envoi notification:", notificationError);
      }

      return {
        success: true,
        message: "Commande créée avec succès !",
        orderId: orderId.toString(),
        clientOrder,
        deliveryFee: deliveryFee,
        distance,
        validationCode: validationCode,
        financial: {
          productAmount: productPrice,
          deliveryFee: deliveryFee,
          total: totalOrder,
          clientNewBalance: client.credit
        }
      };

    } catch (error) {
      await session.abortTransaction();
      console.error("❌ [CREATE_COMMANDE] Erreur:", error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * VALIDATION DE LIVRAISON AVEC GESTION COMPLÈTE DES PAIEMENTS
   */
  static async validateAndCompleteDelivery(orderId, enteredCode, livreurUserId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      console.log("=".repeat(80));
      console.log("🔢 [VALIDATE_DELIVERY] DÉBUT VALIDATION");
      console.log("📦 Order ID:", orderId);
      console.log("⌨️  Code reçu:", enteredCode);
      console.log("👤 Livreur User ID:", livreurUserId);

      // 1️⃣ VÉRIFICATION DU CODE CHEZ LE CLIENT
      console.log("🔍 [VALIDATE_DELIVERY] Recherche commande chez le client...");
      const client = await Client.findOne({ "orders._id": orderId }).session(session);
      if (!client) throw new Error("Commande non trouvée chez le client");

      const clientOrder = client.orders.id(orderId);
      if (!clientOrder) throw new Error("Commande non trouvée dans les orders du client");

      console.log("✅ [VALIDATE_DELIVERY] Commande trouvée:", {
        statut: clientOrder.status,
        codeAttendu: clientOrder.validationCode,
        montantTotal: clientOrder.total
      });

      // Vérification du code
      if (clientOrder.validationCode !== enteredCode) {
        console.log("❌ [VALIDATE_DELIVERY] CODE INCORRECT");
        await session.abortTransaction();
        return {
          success: false,
          message: "Code de validation incorrect",
          codeValid: false
        };
      }

      console.log("✅ [VALIDATE_DELIVERY] CODE CORRECT");

      // 2️⃣ VÉRIFICATION DU LIVREUR
      console.log("🚚 [VALIDATE_DELIVERY] Recherche du livreur...");
      const livreur = await Livreur.findOne({ user: livreurUserId }).session(session);
      if (!livreur) {
        console.log("❌ [VALIDATE_DELIVERY] Livreur non trouvé");
        await session.abortTransaction();
        return {
          success: false,
          message: "Livreur non trouvé",
          codeValid: true,
          livreurValid: false
        };
      }

      // Vérifier si le livreur a cette commande
      const livreurDelivery = livreur.deliveryHistory.find(
        d => d.orderId && d.orderId.toString() === orderId.toString()
      );

      if (!livreurDelivery || livreurDelivery.status !== 'en_cours') {
        console.log("❌ [VALIDATE_DELIVERY] Commande non assignée au livreur");
        await session.abortTransaction();
        return {
          success: false,
          message: "Cette commande ne vous est pas assignée",
          codeValid: true,
          livreurValid: false
        };
      }

      console.log("✅ [VALIDATE_DELIVERY] Livreur validé");

      const now = new Date();

      // 3️⃣ MISE À JOUR CLIENT
      console.log("👤 [VALIDATE_DELIVERY] Mise à jour client...");
      clientOrder.status = 'livre';
      clientOrder.deliveredAt = now;
      clientOrder.livreurId = livreur._id;

      // Ajouter à l'historique
      client.historiqueCommandes.push({
        ...clientOrder.toObject(),
        date: now,
        orderCode: clientOrder.validationCode
      });

      // Supprimer de la liste des commandes en cours
      client.orders.pull(orderId);
      await client.save({ session });

      console.log("✅ [VALIDATE_DELIVERY] Client mis à jour");

      // 4️⃣ MISE À JOUR LIVREUR
      console.log("🚚 [VALIDATE_DELIVERY] Mise à jour livreur...");
      const livreurAmount = clientOrder.deliveryFee || 0;

      // Mettre à jour l'historique
      livreurDelivery.status = 'livre';
      livreurDelivery.deliveredAt = now;
      livreurDelivery.amountReceived = livreurAmount;

      // Créditer le portefeuille du livreur
      if (!livreur.wallet) livreur.wallet = { balance: 0, transactions: [] };

      const ancienSoldeLivreur = livreur.wallet.balance;
      livreur.wallet.balance += livreurAmount;
      
      const livreurTransactionId = this.generateTransactionId();
      livreur.wallet.transactions.push({
        transactionId: livreurTransactionId,
        amount: livreurAmount,
        type: 'credit',
        description: `Frais de livraison - Commande ${orderId}`,
        date: now,
        orderId: orderId,
        clientName: clientOrder.clientName,
        ancienSolde: ancienSoldeLivreur,
        nouveauSolde: livreur.wallet.balance
      });

      // Statistiques livreur
      livreur.totalLivraisons = (livreur.totalLivraisons || 0) + 1;
      livreur.totalRevenue = (livreur.totalRevenue || 0) + livreurAmount;

      // Mettre à jour les livraisons du jour
      if (Array.isArray(livreur.todaysDeliveries)) {
        livreur.todaysDeliveries = livreur.todaysDeliveries.filter(
          d => d.orderId && d.orderId.toString() !== orderId.toString()
        );
        if (livreur.todaysDeliveries.length === 0) {
          livreur.status = 'disponible';
        }
      }

      await livreur.save({ session });
      console.log("💰 [VALIDATE_DELIVERY] Livreur crédité:", livreurAmount);

      // 5️⃣ MISE À JOUR DISTRIBUTEUR
      console.log("🏪 [VALIDATE_DELIVERY] Mise à jour distributeur...");
      const distributor = await Distributor.findOne({ 'orders._id': orderId }).session(session);
      if (!distributor) throw new Error("Distributeur non trouvé");

      const distributorOrder = distributor.orders.id(orderId);
      if (!distributorOrder) throw new Error("Commande non trouvée chez le distributeur");

      distributorOrder.status = 'livre';
      distributorOrder.deliveredAt = now;
      distributorOrder.livreurId = livreur._id;

      const distributorAmount = distributorOrder.productPrice || 0;

      // Créditer le distributeur
      const ancienRevenue = distributor.revenue || 0;
      const ancienBalance = distributor.balance || 0;
      
      distributor.revenue = ancienRevenue + distributorAmount;
      distributor.balance = ancienBalance + distributorAmount;

      // Ajouter transaction distributeur
      const distributorTransactionId = this.generateTransactionId();
      distributor.transactions.push({
        transactionId: distributorTransactionId,
        type: 'vente',
        amount: distributorAmount,
        date: now,
        description: `Vente commande ${orderId} - ${clientOrder.clientName}`,
        relatedOrder: orderId,
        method: 'wallet',
        status: 'terminee',
        ancienSolde: ancienBalance,
        nouveauSolde: distributor.balance,
        details: {
          productAmount: distributorOrder.productPrice,
          deliveryFee: distributorOrder.deliveryFee,
          totalOrder: distributorOrder.total,
          products: distributorOrder.products
        }
      });

      await distributor.save({ session });
      console.log("💰 [VALIDATE_DELIVERY] Distributeur crédité:", distributorAmount);

      // ✅ VALIDATION DE LA TRANSACTION
      await session.commitTransaction();
      console.log("✅ [VALIDATE_DELIVERY] Transaction validée");

      // 🔔 NOTIFICATIONS
      try {
        await NotificationService.notifyDeliveryCompleted(
          orderId,
          clientOrder.clientName,
          livreurAmount,
          distributorAmount
        );
        console.log("📨 [VALIDATE_DELIVERY] Notifications envoyées");
      } catch (notificationError) {
        console.error("❌ [VALIDATE_DELIVERY] Erreur notifications:", notificationError);
      }

      // 📊 RÉSULTAT FINAL
      console.log("=".repeat(80));
      console.log("🎉 [VALIDATE_DELIVERY] LIVRAISON VALIDÉE AVEC SUCCÈS");
      console.log("💰 RÉPARTITION DES FONDS:");
      console.log("   📦 Distributeur:", distributorAmount.toLocaleString(), "FCFA");
      console.log("   🚚 Livreur:", livreurAmount.toLocaleString(), "FCFA");
      console.log("=".repeat(80));

      return {
        success: true,
        message: "✅ Livraison validée avec succès - Paiements distribués",
        codeValid: true,
        livreurValid: true,
        financial: {
          totalOrder: clientOrder.total,
          productAmount: distributorAmount,
          deliveryFee: livreurAmount,
          distributor: {
            amount: distributorAmount,
            transactionId: distributorTransactionId,
            newBalance: distributor.balance
          },
          livreur: {
            amount: livreurAmount,
            transactionId: livreurTransactionId,
            newBalance: livreur.wallet.balance
          }
        }
      };

    } catch (error) {
      await session.abortTransaction();
      console.error("❌ [VALIDATE_DELIVERY] ERREUR CRITIQUE:", error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Assignation du livreur via un service séparé.
   */
  static async assignLivreur(distributorId, orderId, driverId, driverName, driverPhone) {
    console.log("🚚 [ASSIGN_LIVREUR] Assignation livreur:", {
      distributorId,
      orderId,
      driverId,
      driverName
    });

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
      console.log("📨 [ASSIGN_LIVREUR] Notification envoyée au livreur");
    } catch (notificationError) {
      console.error("❌ [ASSIGN_LIVREUR] Erreur envoi notification livreur:", notificationError);
    }
    
    return result;
  }

  /**
   * Confirme une commande par le distributeur.
   */
  static async confirmOrder(orderId, distributorId, newStatus) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      console.log("✅ [CONFIRM_ORDER] Confirmation commande:", {
        orderId,
        distributorId,
        newStatus
      });

      const distributor = await Distributor.findById(distributorId).session(session);
      if (!distributor) throw new Error('Distributeur non trouvé');

      const distOrder = distributor.orders.id(orderId);
      if (!distOrder) throw new Error('Commande non trouvée chez le distributeur');

      distOrder.status = newStatus;
      await distributor.save({ session });

      const client = await Client.findOne({ 'orders._id': orderId }).session(session);
      if (!client) throw new Error('Commande non trouvée chez le client');

      const clientOrder = client.orders.id(orderId);
      clientOrder.status = newStatus;
      await client.save({ session });

      await session.commitTransaction();

      // 🔔 NOTIFICATION AU CLIENT
      if (newStatus === 'confirme') {
        try {
          await NotificationService.notifyClient(
            client._id,
            'order_accepted',
            {
              orderId: orderId.toString(),
              orderNumber: `CMD-${orderId.toString().slice(-6)}`,
              distributorName: distributor.user?.name || distributor.name
            }
          );
          console.log("📨 [CONFIRM_ORDER] Notification envoyée au client");
        } catch (notificationError) {
          console.error("❌ [CONFIRM_ORDER] Erreur notification client:", notificationError);
        }
      }

      return { 
        message: 'Commande confirmée avec succès', 
        clientOrder, 
        distOrder 
      };

    } catch (error) {
      await session.abortTransaction();
      console.error("❌ [CONFIRM_ORDER] Erreur:", error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Récupère toutes les commandes en livraison.
   */
  static async getOrdersEnLivraison() {
    try {
      console.log("📋 [GET_ORDERS_EN_LIVRAISON] Récupération commandes en livraison");
      
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
              validationCode: order.validationCode
            });
          }
        });
      });

      console.log(`📋 [GET_ORDERS_EN_LIVRAISON] ${orders.length} commandes en livraison trouvées`);
      return orders;
    } catch (error) {
      console.error("❌ [GET_ORDERS_EN_LIVRAISON] Erreur:", error);
      throw new Error(`Erreur lors de la récupération des commandes en livraison: ${error.message}`);
    }
  }

  /**
   * Rejeter une commande
   */
  static async rejectOrder(orderId, distributorId, reason = "Commande refusée") {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      console.log("❌ [REJECT_ORDER] Rejet commande:", {
        orderId,
        distributorId,
        reason
      });

      const distributor = await Distributor.findById(distributorId).session(session);
      if (!distributor) throw new Error('Distributeur non trouvé');

      const distOrder = distributor.orders.id(orderId);
      if (!distOrder) throw new Error('Commande non trouvée chez le distributeur');

      distOrder.status = 'annule';
      await distributor.save({ session });

      const client = await Client.findOne({ 'orders._id': orderId }).session(session);
      if (!client) throw new Error('Commande non trouvée chez le client');

      const clientOrder = client.orders.id(orderId);
      clientOrder.status = 'annule';
      
      // Rembourser le client
      const ancienSolde = client.credit || 0;
      client.credit = ancienSolde + clientOrder.total;
      
      const transactionId = this.generateTransactionId();
      client.walletTransactions.push({
        transactionId,
        type: 'remboursement',
        amount: clientOrder.total,
        date: new Date(),
        description: `Remboursement commande ${orderId} refusée`,
        ancienSolde: ancienSolde,
        nouveauSolde: client.credit,
        details: {
          reason: reason,
          orderId: orderId.toString()
        }
      });
      
      await client.save({ session });
      await session.commitTransaction();

      // 🔔 NOTIFICATION AU CLIENT
      try {
        await NotificationService.notifyClient(
          client._id,
          'order_rejected',
          {
            orderId: orderId.toString(),
            orderNumber: `CMD-${orderId.toString().slice(-6)}`,
            reason: reason,
            amountRefunded: clientOrder.total
          }
        );
        console.log("📨 [REJECT_ORDER] Notification de refus envoyée au client");
      } catch (notificationError) {
        console.error("❌ [REJECT_ORDER] Erreur envoi notification refus:", notificationError);
      }

      return { 
        message: 'Commande refusée et client remboursé', 
        clientOrder, 
        distOrder,
        refund: {
          amount: clientOrder.total,
          newBalance: client.credit
        }
      };

    } catch (error) {
      await session.abortTransaction();
      console.error("❌ [REJECT_ORDER] Erreur:", error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Récupère le code de validation d'une commande
   */
  static async getValidationCode(orderId) {
    try {
      console.log("🔐 [GET_VALIDATION_CODE] Récupération code pour commande:", orderId);

      const client = await Client.findOne({ "orders._id": orderId });
      if (!client) throw new Error("Commande non trouvée");

      const order = client.orders.id(orderId);
      if (!order) throw new Error("Commande non trouvée");

      console.log("✅ [GET_VALIDATION_CODE] Code trouvé:", order.validationCode);

      return {
        success: true,
        validationCode: order.validationCode,
        orderId: orderId
      };
    } catch (error) {
      console.error("❌ [GET_VALIDATION_CODE] Erreur récupération code:", error);
      throw error;
    }
  }
}

module.exports = CommandeService;