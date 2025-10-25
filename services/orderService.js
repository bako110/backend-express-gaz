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
   * Crée une nouvelle commande pour un client et un distributeur.
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

    console.log("🟢 [CREATE_COMMANDE] Données reçues:", commandeData);

    if (!userId) throw new Error("User ID manquant.");
    if (!distributorId || !mongoose.Types.ObjectId.isValid(distributorId))
      throw new Error("Distributor ID invalide.");

    // 🔍 Recherche du client via le champ 'user' qui référence l'User ID
    const client = await Client.findOne({ user: userId });
    if (!client) throw new Error("Client introuvable pour cet utilisateur.");

    console.log("🧾 [CREATE_COMMANDE] Client trouvé:", client._id.toString());

    const distributor = await Distributor.findById(distributorId);
    if (!distributor) throw new Error("Distributeur non trouvé.");

    console.log("🧾 [CREATE_COMMANDE] Distributeur trouvé:", distributor._id.toString());

    // 🔍 CORRECTION : Afficher tous les produits disponibles pour debug
    console.log("📦 [CREATE_COMMANDE] Produits disponibles chez le distributeur:");
    distributor.products.forEach((p, index) => {
      console.log(`   ${index + 1}. ${p.name} | Type: ${p.type} | FuelType: ${p.fuelType} | Stock: ${p.stock}`);
    });

    // 🔍 CORRECTION : Recherche du produit avec différents critères
    let distributorProduct = distributor.products.find(
      (p) => p.name === product.name && p.type === product.type
    );

    // Si pas trouvé avec type, essayer avec fuelType
    if (!distributorProduct) {
      console.log("🔍 [CREATE_COMMANDE] Recherche alternative avec fuelType...");
      distributorProduct = distributor.products.find(
        (p) => p.name === product.name && p.fuelType === product.type
      );
    }

    // Si toujours pas trouvé, essayer seulement par nom
    if (!distributorProduct) {
      console.log("🔍 [CREATE_COMMANDE] Recherche par nom seulement...");
      distributorProduct = distributor.products.find(
        (p) => p.name === product.name
      );
    }

    if (!distributorProduct) {
      console.log("❌ [CREATE_COMMANDE] Aucun produit correspondant trouvé");
      console.log("🔍 [CREATE_COMMANDE] Produit recherché:", product);
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

    const productPrice = product.price * product.quantity;
    const totalOrder = productPrice + (deliveryFee || 0);
    const orderId = new mongoose.Types.ObjectId();
    const now = new Date();
    const deliveryEnum = (deliveryFee && deliveryFee >= 0) ? "oui" : "non";

    // 🔢 Génération d'un code de validation numérique à 6 chiffres
    const validationCode = this.generateValidationCode();
    console.log("✅ [CREATE_COMMANDE] Code de validation généré:", validationCode, "pour commande:", orderId.toString());

    // CORRECTION : Utiliser les bonnes données du produit distributeur
    const clientOrder = {
      _id: orderId,
      products: [{
        name: distributorProduct.name,
        type: distributorProduct.type,
        fuelType: distributorProduct.fuelType,
        quantity: product.quantity,
        price: distributorProduct.price
      }],
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
      validationCode: validationCode
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
        price: distributorProduct.price
      }],
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
      validationCode: validationCode
    };

    console.log("🧾 [CREATE_COMMANDE] Création commande - ID:", orderId.toString(), "Code:", validationCode);

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
          deliveryFee: deliveryFee || 0,
          validationCode: validationCode
        }
      );
      console.log("📨 [CREATE_COMMANDE] Notification envoyée au distributeur avec code:", validationCode);
    } catch (notificationError) {
      console.error("❌ [CREATE_COMMANDE] Erreur envoi notification:", notificationError);
    }

    return {
      success: true,
      message: "Commande créée avec succès !",
      clientOrder,
      distributorOrder,
      deliveryFee: deliveryFee || 0,
      distance,
      validationCode: validationCode
    };
  }

  /**
   * VALIDATION DE LIVRAISON AVEC CODE + GESTION COMPLÈTE DES PAIEMENTS
   * Version corrigée - Vérifie d'abord chez le livreur
   */
  static async validateAndCompleteDelivery(orderId, enteredCode, livreurId) {
    try {
      console.log("=".repeat(80));
      console.log("🔢 [VALIDATE_DELIVERY] DÉBUT VALIDATION - VERSION CORRIGÉE");
      console.log("📦 Order ID:", orderId);
      console.log("⌨️  Code reçu du frontend:", enteredCode);
      console.log("🚚 Livreur ID:", livreurId);
      console.log("=".repeat(80));

      // -------------------- 1️⃣ VÉRIFICATION DU CODE CHEZ LE CLIENT --------------------
      console.log("🔍 [VALIDATE_DELIVERY] Recherche de la commande chez le client...");
      const client = await Client.findOne({ "orders._id": orderId });
      if (!client) {
        console.log("❌ [VALIDATE_DELIVERY] Commande non trouvée chez le client");
        throw new Error("Commande non trouvée");
      }

      const clientOrder = client.orders.id(orderId);
      if (!clientOrder) {
        console.log("❌ [VALIDATE_DELIVERY] Commande non trouvée dans les orders du client");
        throw new Error("Commande non trouvée");
      }

      console.log("✅ [VALIDATE_DELIVERY] Commande trouvée chez client:", {
        orderId: orderId,
        statut: clientOrder.status,
        livreurAssigné: clientOrder.livreurId,
        codeAttendu: clientOrder.validationCode
      });

      // Vérifier le code de validation
      console.log("🔐 [VALIDATE_DELIVERY] Vérification du code...");
      console.log("   Code saisi:", enteredCode);
      console.log("   Code attendu:", clientOrder.validationCode);

      if (clientOrder.validationCode !== enteredCode) {
        console.log("❌ [VALIDATE_DELIVERY] CODE INCORRECT");
        return {
          success: false,
          message: "Code de validation incorrect",
          codeValid: false,
          details: {
            codeSaisi: enteredCode,
            codeAttendu: clientOrder.validationCode
          }
        };
      }

      console.log("✅ [VALIDATE_DELIVERY] CODE CORRECT - Validation réussie");

      // -------------------- 2️⃣ VÉRIFICATION CHEZ LE LIVREUR --------------------
      console.log("🚚 [VALIDATE_DELIVERY] Vérification chez le livreur...");
      const livreur = await Livreur.findById(livreurId);
      if (!livreur) {
        console.log("❌ [VALIDATE_DELIVERY] Livreur non trouvé");
        throw new Error("Livreur non trouvé");
      }

      // Vérifier si le livreur a cette commande dans son historique
      const livreurDelivery = livreur.deliveryHistory.find(
        d => d.orderId.toString() === orderId.toString()
      );

      console.log("📋 [VALIDATE_DELIVERY] État du livreur:", {
        livreurId: livreur._id.toString(),
        statut: livreur.status,
        commandeDansHistorique: !!livreurDelivery,
        statutCommande: livreurDelivery?.status
      });

      if (!livreurDelivery) {
        console.log("❌ [VALIDATE_DELIVERY] Commande non trouvée chez le livreur");
        return {
          success: false,
          message: "Cette commande ne vous est pas assignée",
          codeValid: true,
          livreurValid: false,
          details: {
            livreurId: livreurId,
            orderId: orderId
          }
        };
      }

      if (livreurDelivery.status !== 'en_cours') {
        console.log("❌ [VALIDATE_DELIVERY] Commande déjà traitée - Statut:", livreurDelivery.status);
        return {
          success: false,
          message: "Cette commande a déjà été traitée",
          codeValid: true,
          livreurValid: false,
          details: {
            statutActuel: livreurDelivery.status
          }
        };
      }

      console.log("✅ [VALIDATE_DELIVERY] LIVREUR VALIDÉ - Le livreur a bien cette commande");

      // -------------------- 3️⃣ CORRECTION DE L'ASSIGNATION SI NÉCESSAIRE --------------------
      if (!clientOrder.livreurId || clientOrder.livreurId.toString() !== livreurId) {
        console.log("🔄 [VALIDATE_DELIVERY] Correction de l'assignation livreur...");
        console.log("   Ancien livreurId:", clientOrder.livreurId);
        console.log("   Nouveau livreurId:", livreurId);
        
        clientOrder.livreurId = livreurId;
        await client.save();
        console.log("✅ [VALIDATE_DELIVERY] Assignation corrigée chez le client");
      }

      const now = new Date();

      // -------------------- 4️⃣ MISE À JOUR CLIENT --------------------
      console.log("👤 [VALIDATE_DELIVERY] Mise à jour client...");
      clientOrder.status = 'livre';
      clientOrder.deliveredAt = now;

      // Ajouter à l'historique du client
      client.historiqueCommandes.push({
        products: clientOrder.products,
        productPrice: clientOrder.productPrice,
        deliveryFee: clientOrder.deliveryFee,
        total: clientOrder.total,
        date: now,
        status: 'livre',
        clientName: clientOrder.clientName,
        clientPhone: clientOrder.clientPhone,
        distributorId: clientOrder.distributorId,
        distributorName: clientOrder.distributorName,
        livreurId: clientOrder.livreurId,
        orderCode: clientOrder.validationCode
      });

      // Supprimer de la liste des commandes en cours
      client.orders.pull(orderId);
      await client.save();
      console.log("✅ [VALIDATE_DELIVERY] Client mis à jour - Statut: livré");

      // -------------------- 5️⃣ MISE À JOUR LIVREUR --------------------
      console.log("🚚 [VALIDATE_DELIVERY] Mise à jour livreur...");
      
      const livreurAmount = clientOrder.deliveryFee || 0;
      console.log("💰 [VALIDATE_DELIVERY] Montant livreur:", livreurAmount);

      // Mettre à jour l'historique de livraison du livreur
      livreurDelivery.status = 'livre';
      livreurDelivery.deliveredAt = now;
      livreurDelivery.amountReceived = livreurAmount;
      console.log("✅ [VALIDATE_DELIVERY] Historique livreur mis à jour");

      // Créditer le portefeuille du livreur
      if (!livreur.wallet) livreur.wallet = { balance: 0, transactions: [] };

      const ancienSolde = livreur.wallet.balance;
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

      console.log("💰 [VALIDATE_DELIVERY] Portefeuille livreur:", {
        ancienSolde: ancienSolde,
        montantAjouté: livreurAmount,
        nouveauSolde: livreur.wallet.balance
      });

      // Mettre à jour les livraisons du jour
      if (Array.isArray(livreur.todaysDeliveries)) {
        livreur.todaysDeliveries = livreur.todaysDeliveries.filter(
          d => d.orderId.toString() !== orderId.toString()
        );

        if (livreur.todaysDeliveries.length === 0) {
          livreur.status = 'disponible';
          console.log("🔄 [VALIDATE_DELIVERY] Livreur marqué comme disponible");
        }
      }

      await livreur.save();
      console.log("✅ [VALIDATE_DELIVERY] Livreur mis à jour");

      // -------------------- 6️⃣ MISE À JOUR DISTRIBUTEUR --------------------
      console.log("🏪 [VALIDATE_DELIVERY] Mise à jour distributeur...");
      const distributor = await Distributor.findOne({ 'orders._id': orderId });
      if (!distributor) {
        console.log("❌ [VALIDATE_DELIVERY] Distributeur non trouvé");
        throw new Error("Distributeur non trouvé pour cette commande");
      }

      const distributorOrder = distributor.orders.id(orderId);
      if (!distributorOrder) {
        console.log("❌ [VALIDATE_DELIVERY] Commande non trouvée chez le distributeur");
        throw new Error("Commande non trouvée dans les commandes du distributeur");
      }

      distributorOrder.status = 'livre';
      distributorOrder.deliveredAt = now;
      distributorOrder.livreurId = livreurId; // S'assurer que le livreur est assigné

      const distributorAmount = distributorOrder.productPrice || 0;
      console.log("💰 [VALIDATE_DELIVERY] Montant distributeur:", distributorAmount);

      // Créditer le distributeur
      const ancienRevenue = distributor.revenue || 0;
      const ancienBalance = distributor.balance || 0;
      
      distributor.revenue = ancienRevenue + distributorAmount;
      distributor.balance = ancienBalance + distributorAmount;

      // Ajouter transaction distributeur
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
      console.log("✅ [VALIDATE_DELIVERY] Distributeur mis à jour:", {
        ancienRevenue: ancienRevenue,
        nouveauRevenue: distributor.revenue,
        ancienBalance: ancienBalance,
        nouveauBalance: distributor.balance
      });

      // -------------------- 7️⃣ NOTIFICATIONS --------------------
      console.log("📨 [VALIDATE_DELIVERY] Envoi des notifications...");
      try {
        await NotificationService.notifyDeliveryCompleted(
          orderId,
          clientOrder.clientName,
          livreurAmount,
          distributorAmount
        );

        console.log("💰 [VALIDATE_DELIVERY] Notifications envoyées:");
        console.log("   📦 Distributeur:", distributorAmount.toLocaleString(), "FCFA");
        console.log("   🚚 Livreur:", livreurAmount.toLocaleString(), "FCFA");

      } catch (notificationError) {
        console.error("❌ [VALIDATE_DELIVERY] Erreur envoi notifications:", notificationError);
      }

      // -------------------- ✅ RÉSULTAT FINAL --------------------
      console.log("=".repeat(80));
      console.log("🎉 [VALIDATE_DELIVERY] VALIDATION TERMINÉE AVEC SUCCÈS");
      console.log("📦 Commande:", orderId);
      console.log("👤 Client:", clientOrder.clientName);
      console.log("🚚 Livreur:", livreurId);
      console.log("💰 Montants - Livreur:", livreurAmount, "Distributeur:", distributorAmount);
      console.log("=".repeat(80));

      return {
        success: true,
        message: "✅ Livraison validée avec succès - Paiements distribués",
        codeValid: true,
        livreurValid: true,
        details: {
          client: {
            orderId: orderId.toString(),
            status: 'livre',
            totalPaid: clientOrder.total
          },
          livreur: {
            amountReceived: livreurAmount,
            newBalance: livreur.wallet.balance,
            ancienBalance: ancienSolde
          },
          distributor: {
            amountReceived: distributorAmount,
            newBalance: distributor.balance,
            ancienBalance: ancienBalance,
            transactionId: transactionId
          }
        },
        amounts: {
          totalOrder: clientOrder.total,
          productAmount: distributorAmount,
          deliveryFee: livreurAmount
        }
      };

    } catch (error) {
      console.error("❌ [VALIDATE_DELIVERY] ERREUR CRITIQUE:", error);
      console.error("Stack trace:", error.stack);
      throw error;
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
    console.log("✅ [CONFIRM_ORDER] Confirmation commande:", {
      orderId,
      distributorId,
      newStatus
    });

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
        console.log("📨 [CONFIRM_ORDER] Notification envoyée au client");
      }
    } catch (notificationError) {
      console.error("❌ [CONFIRM_ORDER] Erreur envoi notification client:", notificationError);
    }

    return { message: 'Commande confirmée avec succès', clientOrder, distOrder };
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
    console.log("❌ [REJECT_ORDER] Rejet commande:", {
      orderId,
      distributorId,
      reason
    });

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
      console.log("📨 [REJECT_ORDER] Notification de refus envoyée au client");
    } catch (notificationError) {
      console.error("❌ [REJECT_ORDER] Erreur envoi notification refus:", notificationError);
    }

    return { message: 'Commande refusée avec succès', clientOrder, distOrder };
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