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

  // =============== UTILITAIRES FINANCIERS (SOURCE DE VÉRITÉ = TRANSACTIONS) ===============

  /**
   * Calcule le solde d'un DISTRIBUTEUR à partir de ses transactions
   * Les transactions sont la source unique de vérité
   */
  static calculateDistributorBalance(transactions) {
    if (!Array.isArray(transactions)) return 0;
    
    return transactions.reduce((total, tx) => {
      if (tx.type === 'vente' || tx.type === 'credit') {
        return total + (tx.amount || 0);
      } else if (tx.type === 'retrait' || tx.type === 'debit' || tx.type === 'commission') {
        return total - (tx.amount || 0);
      }
      return total;
    }, 0);
  }

  /**
   * Calcule le CHIFFRE D'AFFAIRES d'un distributeur (somme des VENTES uniquement)
   * Revenue = montants issus des ventes confirmées
   */
  static calculateDistributorRevenue(transactions) {
    if (!Array.isArray(transactions)) return 0;
    
    return transactions.reduce((total, tx) => {
      if (tx.type === 'vente' && tx.status !== 'echouee') {
        return total + (tx.amount || 0);
      }
      return total;
    }, 0);
  }

  /**
   * Recalcule et met à jour TOUS les champs financiers du distributeur
   * depuis ses transactions (source unique de vérité)
   */
  static async syncDistributorFinances(distributor) {
    try {
      const transactions = distributor.transactions || [];
      
      // Recalculer depuis les transactions
      const newBalance = this.calculateDistributorBalance(transactions);
      const newRevenue = this.calculateDistributorRevenue(transactions);
      
      console.log("🔄 [SYNC_DISTRIBUTOR] Synchronisation finances:", {
        distributorId: distributor._id,
        oldBalance: distributor.balance,
        newBalance: newBalance,
        oldRevenue: distributor.revenue,
        newRevenue: newRevenue,
        transactionCount: transactions.length
      });
      
      // Mettre à jour le distributor
      distributor.balance = newBalance;
      distributor.revenue = newRevenue;
      
      return distributor;
    } catch (error) {
      console.error("❌ [SYNC_DISTRIBUTOR] Erreur:", error);
      throw error;
    }
  }

  /**
   * Calcule le solde d'un LIVREUR à partir de ses transactions wallet
   */
  static calculateLivreurBalance(walletTransactions) {
    if (!walletTransactions || !Array.isArray(walletTransactions)) return 0;
    
    return walletTransactions.reduce((total, tx) => {
      if (tx.type === 'credit') {
        return total + (tx.amount || 0);
      } else if (tx.type === 'debit') {
        return total - (tx.amount || 0);
      }
      return total;
    }, 0);
  }

  /**
   * Recalcule et met à jour TOUS les champs financiers du livreur
   * depuis ses transactions (source unique de vérité)
   */
  static async syncLivreurFinances(livreur) {
    try {
      if (!livreur.wallet) livreur.wallet = { balance: 0, transactions: [] };
      
      const walletTransactions = livreur.wallet.transactions || [];
      
      // Recalculer depuis les transactions
      const newBalance = this.calculateLivreurBalance(walletTransactions);
      
      console.log("🔄 [SYNC_LIVREUR] Synchronisation finances:", {
        livreurId: livreur._id,
        oldBalance: livreur.wallet.balance,
        newBalance: newBalance,
        transactionCount: walletTransactions.length
      });
      
      // Mettre à jour le livreur
      livreur.wallet.balance = newBalance;
      
      return livreur;
    } catch (error) {
      console.error("❌ [SYNC_LIVREUR] Erreur:", error);
      throw error;
    }
  }

  /**
   * Crée une nouvelle commande pour un client et un distributeur.
   */
  static async createCommande(commandeData) {
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
      deliveryFee = 0,
      delivery // ← Boolean du frontend (true = livraison, false = retrait)
    } = commandeData;

    // 🔍 isDelivery DOIT SUIVRE EXACTEMENT delivery DU FRONTEND
    const isDelivery = delivery === true;
    
    console.log("🟢 [CREATE_COMMANDE] Données reçues:", { 
      deliveryFromFrontend: delivery,
      isDelivery: isDelivery,
      typeCommande: isDelivery ? 'LIVRAISON' : 'RETRAIT SUR PLACE' 
    });

    if (!userId) throw new Error("User ID manquant.");
    if (!distributorId || !mongoose.Types.ObjectId.isValid(distributorId))
      throw new Error("Distributor ID invalide.");

    // 🔍 Recherche du client
    const client = await Client.findOne({ user: userId });
    if (!client) throw new Error("Client introuvable pour cet utilisateur.");

    const distributor = await Distributor.findById(distributorId);
    if (!distributor) throw new Error("Distributeur non trouvé.");

    // 🔍 Recherche du produit
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
      throw new Error("Produit indisponible ou stock insuffisant.");
    }

    if (distributorProduct.stock < product.quantity) {
      throw new Error("Stock insuffisant pour ce produit.");
    }

    // 🧮 CALCULS FINANCIERS
    const productPrice = distributorProduct.price * product.quantity;
    const totalOrder = productPrice + deliveryFee;
    const orderId = new mongoose.Types.ObjectId();
    const now = new Date();
    
    // 🔒 GARDER delivery TOUJOURS À "non" POUR COMPATIBILITÉ
    const deliveryEnum = "non"; // ← TOUJOURS "non" pour l'ancien système

    // 🔢 Génération d'un code de validation
    const validationCode = this.generateValidationCode();

    // 💰 VÉRIFICATION DU SOLDE DU CLIENT
    const ancienSoldeClient = client.credit || 0;
    if (ancienSoldeClient < totalOrder) {
      throw new Error(`Solde insuffisant. Solde actuel: ${ancienSoldeClient}, Montant requis: ${totalOrder}`);
    }

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
      delivery: deliveryEnum, // ← TOUJOURS "non" (pour compatibilité)
      livreurId: null,
      clientLocation,
      distance,
      validationCode,
      isDelivery: isDelivery // ← SUIT EXACTEMENT delivery du frontend
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
      delivery: deliveryEnum, // ← TOUJOURS "non" (pour compatibilité)
      clientLocation,
      distance,
      validationCode,
      isDelivery: isDelivery // ← SUIT EXACTEMENT delivery du frontend
    };

    console.log("🧾 [CREATE_COMMANDE] Création commande:", {
      type: isDelivery ? 'LIVRAISON' : 'RETRAIT SUR PLACE',
      deliveryBD: deliveryEnum, // "non"
      isDelivery: isDelivery // true/false
    });

    // 💳 MISE À JOUR FINANCIÈRE CLIENT
    // ======================================
    // DÉDUCTION IMMÉDIATE DU SOLDE DU CLIENT
    // - Montant du produit (gaz): sera versé au distributeur à la livraison
    // - Frais de livraison: sera versé au livreur à la livraison
    // - TOTAL DÉBITÉ: productPrice + deliveryFee
    client.orders.push(clientOrder);
    const ancienCredit = client.credit;
    client.credit = ancienSoldeClient - totalOrder;
    
    const transactionId = this.generateTransactionId();
    client.walletTransactions.push({
      transactionId,
      type: 'retrait',
      amount: totalOrder,
      date: now,
      description: `Paiement commande ${orderId} - ${isDelivery ? 'Livraison' : 'Retrait sur place'}`,
      details: {
        productAmount: productPrice,
        deliveryFee: deliveryFee,
        products: `${product.quantity}x ${distributorProduct.name}`,
        type: isDelivery ? 'livraison' : 'retrait'
      },
      ancienSolde: ancienCredit,
      newBalance: client.credit
    });

    console.log("💳 [CREATE_COMMANDE] Déduction client:", {
      ancienSolde: ancienCredit,
      productPrice: productPrice,
      deliveryFee: deliveryFee,
      totalDébité: totalOrder,
      nouveauSolde: client.credit
    });

    // 📦 MISE À JOUR DISTRIBUTEUR
    distributor.orders.push(distributorOrder);
    distributorProduct.stock -= product.quantity;

    // Sauvegarde SANS transaction
    await client.save();
    await distributor.save();

    console.log("✅ [CREATE_COMMANDE] Commande sauvegardée avec succès");
    console.log("📊 [CREATE_COMMANDE] RÉSUMÉ FINANCIER À LA CRÉATION:");
    console.log("=".repeat(80));
    console.log("💳 CLIENT DÉBITÉ IMMÉDIATEMENT:");
    console.log("   Ancien solde:", ancienCredit, "FCFA");
    console.log("   ➖ Montant gaz:", productPrice, "FCFA (→ versé au DISTRIBUTEUR à la fin)");
    console.log("   ➖ Frais livraison:", deliveryFee, "FCFA (→ versé au LIVREUR à la fin)");
    console.log("   ➖ TOTAL DÉBITÉ:", totalOrder, "FCFA");
    console.log("   Nouveau solde:", client.credit, "FCFA");
    console.log("=".repeat(80));
    console.log("📦 TYPE COMMANDE:", isDelivery ? "LIVRAISON À DOMICILE" : "RETRAIT SUR PLACE");
    console.log("=".repeat(80));

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
          validationCode: validationCode,
          isDelivery: isDelivery // ← VRAI STATUT DE LIVRAISON
        }
      );
    } catch (notificationError) {
      console.error("❌ [CREATE_COMMANDE] Erreur envoi notification:", notificationError);
    }

    return {
      success: true,
      message: `Commande créée avec succès ! (${isDelivery ? 'Livraison' : 'Retrait sur place'})`,
      orderId: orderId.toString(),
      clientOrder,
      deliveryFee: deliveryFee,
      distance,
      validationCode: validationCode,
      isDelivery: isDelivery, // ← VRAI STATUT DE LIVRAISON
      financial: {
        productAmount: productPrice,
        deliveryFee: deliveryFee,
        total: totalOrder,
        clientNewBalance: client.credit
      }
    };

  } catch (error) {
    console.error("❌ [CREATE_COMMANDE] Erreur:", error);
    throw error;
  }
}

  /**
   * COMPLÈTE UN RETRAIT SUR PLACE (delivery=false)
   * ✅ Client récupère chez le distributeur
   * ✅ Distributeur reçoit le montant du produit
   * ✅ Pas de livreur, donc pas de frais à payer
   */
  static async completePickup(orderId, enteredCode, distributorId) {
    try {
      console.log("=".repeat(80));
      console.log("🏪 [COMPLETE_PICKUP] DÉBUT COMPLETION RETRAIT SUR PLACE");
      console.log("📦 Order ID:", orderId);
      console.log("⌨️  Code reçu:", enteredCode);
      console.log("🏪 Distributeur ID:", distributorId);

      // Validation des paramètres
      if (!orderId || !enteredCode || !distributorId) {
        throw new Error("Paramètres manquants: orderId, enteredCode, ou distributorId requis");
      }

      // 1️⃣ VÉRIFICATION CHEZ LE DISTRIBUTEUR D'ABORD
      console.log("🔍 [COMPLETE_PICKUP] Recherche commande chez le distributeur...");
      const distributor = await Distributor.findById(distributorId);
      if (!distributor) throw new Error("Distributeur non trouvé");

      const distributorOrder = distributor.orders.id(orderId);
      if (!distributorOrder) {
        console.log("❌ Commande non trouvée chez le distributeur:", orderId);
        throw new Error("Commande non trouvée chez le distributeur");
      }

      console.log("✅ [COMPLETE_PICKUP] Commande trouvée chez distributeur");

      // Vérifier que c'est un retrait (pas une livraison)
      if (distributorOrder.isDelivery === true) {
        throw new Error("Cette commande est une livraison, utilisez validateAndCompleteDelivery à la place");
      }

      console.log("✅ [COMPLETE_PICKUP] Statut correct (RETRAIT SUR PLACE):", {
        statut: distributorOrder.status,
        codeAttendu: distributorOrder.validationCode,
        montantTotal: distributorOrder.total,
        montantGaz: distributorOrder.productPrice,
        fraisLivraison: distributorOrder.deliveryFee
      });

      // Vérification du code (depuis le distributeur)
      if (distributorOrder.validationCode !== enteredCode) {
        console.log("❌ [COMPLETE_PICKUP] CODE INCORRECT");
        return {
          success: false,
          message: "Code de validation incorrect",
          codeValid: false
        };
      }

      console.log("✅ [COMPLETE_PICKUP] CODE CORRECT");

      // 2️⃣ RECHERCHE CHEZ LE CLIENT
      console.log("🔍 [COMPLETE_PICKUP] Recherche commande chez le client...");
      const client = await Client.findOne({ "orders._id": orderId });
      if (!client) {
        console.log("❌ Client non trouvé avec orderId:", orderId);
        throw new Error("Commande non trouvée chez le client");
      }

      const clientOrder = client.orders.id(orderId);
      if (!clientOrder) throw new Error("Commande non trouvée dans les orders du client");

      console.log("✅ [COMPLETE_PICKUP] Commande trouvée chez client");

      const now = new Date();

      // 3️⃣ MISE À JOUR CLIENT
      console.log("👤 [COMPLETE_PICKUP] Mise à jour client...");
      clientOrder.status = 'livre';
      clientOrder.deliveredAt = now;
      clientOrder.pickupAt = now; // 🏷️ Ajout date de retrait

      // Ajouter à l'historique
      client.historiqueCommandes.push({
        ...clientOrder.toObject(),
        date: now,
        orderCode: clientOrder.validationCode,
        type: 'retrait'
      });

      // Supprimer de la liste des commandes en cours
      client.orders.pull(orderId);
      await client.save();

      console.log("✅ [COMPLETE_PICKUP] Client mis à jour");

      // 4️⃣ MISE À JOUR DISTRIBUTEUR - PAIEMENT COMPLET
      console.log("🏪 [COMPLETE_PICKUP] Mise à jour distributeur...");
      distributorOrder.status = 'livre';
      distributorOrder.deliveredAt = now;
      distributorOrder.pickupAt = now; // 🏷️ Ajout date de retrait

      // 💰 CAS RETRAIT: Le distributeur reçoit TOUT (produit + frais qu'on garde pas puisque pas de livraison)
      const distributorAmount = distributorOrder.productPrice || 0;
      // Les frais de livraison étaient déduits du client mais pas utilisés - ils restent au distributeur
      const fraisRetainedByDistributor = distributorOrder.deliveryFee || 0;
      const totalDistributorAmount = distributorAmount + fraisRetainedByDistributor;

      // Ajouter transaction distributeur (SOURCE DE VÉRITÉ)
      const distributorTransactionId = this.generateTransactionId();
      distributor.transactions.push({
        transactionId: distributorTransactionId,
        type: 'vente',
        amount: totalDistributorAmount,
        date: now,
        description: `RETRAIT SUR PLACE - Commande ${orderId} - ${clientOrder.clientName}`,
        relatedOrder: orderId,
        method: 'cash',
        status: 'terminee',
        details: {
          productAmount: distributorOrder.productPrice,
          fraisRetainedByDistributor: fraisRetainedByDistributor,
          totalAmount: totalDistributorAmount,
          products: distributorOrder.products,
          note: 'Frais de livraison conservés car pas de livreur'
        }
      });

      // Recalculer TOUS les soldes depuis les transactions (source de vérité)
      await this.syncDistributorFinances(distributor);
      
      await distributor.save();
      console.log("💰 [COMPLETE_PICKUP] Distributeur crédité:", {
        montantProduit: distributorAmount,
        fraisRetained: fraisRetainedByDistributor,
        totalCredit: totalDistributorAmount
      });

      console.log("✅ [COMPLETE_PICKUP] Transaction RETRAIT complétée");

      // 📊 RÉSULTAT FINAL
      console.log("=".repeat(80));
      console.log("🎉 [COMPLETE_PICKUP] RETRAIT SUR PLACE COMPLÉTÉ AVEC SUCCÈS");
      console.log("💰 RÉPARTITION DES FONDS:");
      console.log("   🏪 Distributeur:", totalDistributorAmount.toLocaleString(), "FCFA");
      console.log("      - Produit:", distributorAmount.toLocaleString(), "FCFA");
      console.log("      - Frais conservés:", fraisRetainedByDistributor.toLocaleString(), "FCFA");
      console.log("   🚚 Livreur: 0 FCFA (pas de livraison)");
      console.log("=".repeat(80));

      return {
        success: true,
        message: "✅ Retrait sur place validé - Paiement au distributeur",
        codeValid: true,
        type: 'pickup',
        financial: {
          totalOrder: clientOrder.total,
          productAmount: distributorAmount,
          deliveryFee: clientOrder.deliveryFee,
          distributor: {
            amount: totalDistributorAmount,
            transactionId: distributorTransactionId,
            newBalance: distributor.balance,
            breakdown: {
              product: distributorAmount,
              fraisRetained: fraisRetainedByDistributor
            }
          },
          livreur: {
            amount: 0,
            transactionId: null,
            newBalance: 0,
            note: 'Pas de livraison'
          }
        }
      };

    } catch (error) {
      console.error("❌ [COMPLETE_PICKUP] ERREUR CRITIQUE:", error);
      throw error;
    }
  }

  /**
   * VALIDATION DE LIVRAISON AVEC GESTION COMPLÈTE DES PAIEMENTS
   * ✅ Client se fait livrer à domicile
   * ✅ Distributeur reçoit le montant du produit
   * ✅ Livreur reçoit les frais de livraison
   */
  static async validateAndCompleteDelivery(orderId, enteredCode, livreurUserId) {
    try {
      console.log("=".repeat(80));
      console.log("🔢 [VALIDATE_DELIVERY] DÉBUT VALIDATION");
      console.log("📦 Order ID:", orderId);
      console.log("⌨️  Code reçu:", enteredCode);
      console.log("👤 Livreur User ID:", livreurUserId);

      // 1️⃣ VÉRIFICATION DU CODE CHEZ LE CLIENT
      console.log("🔍 [VALIDATE_DELIVERY] Recherche commande chez le client...");
      const client = await Client.findOne({ "orders._id": orderId });
      if (!client) throw new Error("Commande non trouvée chez le client");

      const clientOrder = client.orders.id(orderId);
      if (!clientOrder) throw new Error("Commande non trouvée dans les orders du client");

      console.log("✅ [VALIDATE_DELIVERY] Commande trouvée:", {
        statut: clientOrder.status,
        codeAttendu: clientOrder.validationCode,
        montantTotal: clientOrder.total,
        isDelivery: clientOrder.isDelivery
      });

      // Vérifier que c'est une livraison (pas un retrait)
      if (clientOrder.isDelivery !== true) {
        throw new Error("Cette commande est un retrait sur place, utilisez completePickup à la place");
      }

      // Vérification du code
      if (clientOrder.validationCode !== enteredCode) {
        console.log("❌ [VALIDATE_DELIVERY] CODE INCORRECT");
        return {
          success: false,
          message: "Code de validation incorrect",
          codeValid: false
        };
      }

      console.log("✅ [VALIDATE_DELIVERY] CODE CORRECT");

      // 2️⃣ VÉRIFICATION DU LIVREUR
      console.log("🚚 [VALIDATE_DELIVERY] Recherche du livreur...");
      console.log("   - Tentative 1: Recherche par ID Livreur direct (si livreurUserId est un ID Livreur)");
      
      // Le frontend envoie livreurId qui est l'ID de la collection Livreur
      // On essaie d'abord directement par ID, puis par user ID si ça ne marche pas
      let livreur = await Livreur.findById(livreurUserId);
      
      if (!livreur) {
        console.log("   - Tentative 2: Recherche par user ID (si livreurUserId est un ID User)");
        livreur = await Livreur.findOne({ user: livreurUserId });
      }
      
      if (!livreur) {
        console.log("❌ [VALIDATE_DELIVERY] Livreur non trouvé avec ID:", livreurUserId);
        return {
          success: false,
          message: "Livreur non trouvé",
          codeValid: true,
          livreurValid: false
        };
      }
      
      console.log("✅ [VALIDATE_DELIVERY] Livreur trouvé:", livreur._id.toString());

      // Vérifier si le livreur a cette commande
      const livreurDelivery = livreur.deliveries.find(
        d => d.orderId && d.orderId.toString() === orderId.toString()
      );

      // ✅ Accepter both 'pending' et 'in_progress' (pending = assignée, in_progress = en cours)
      if (!livreurDelivery || (livreurDelivery.status !== 'pending' && livreurDelivery.status !== 'in_progress')) {
        console.log("❌ [VALIDATE_DELIVERY] Commande non assignée au livreur", {
          found: !!livreurDelivery,
          status: livreurDelivery?.status
        });
        return {
          success: false,
          message: "Cette commande ne vous est pas assignée",
          codeValid: true,
          livreurValid: false
        };
      }

      console.log("✅ [VALIDATE_DELIVERY] Livreur validé");

      const now = new Date();

      // ✅ TRANSITIONNER LE STATUT DE PENDING À IN_PROGRESS (livraison commenced)
      if (livreurDelivery.status === 'pending') {
        livreurDelivery.status = 'in_progress';
        livreurDelivery.startedAt = now;
      }

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
      await client.save();

      console.log("✅ [VALIDATE_DELIVERY] Client mis à jour");

      // 4️⃣ MISE À JOUR LIVREUR
      console.log("🚚 [VALIDATE_DELIVERY] Mise à jour livreur...");
      const livreurAmount = clientOrder.deliveryFee || 0;

      // Vérification que le livreur reçoit bien quelque chose
      if (livreurAmount <= 0) {
        console.warn("⚠️  [VALIDATE_DELIVERY] ATTENTION: Frais de livraison = 0, vérifier les données");
      }

      // Mettre à jour l'historique
      livreurDelivery.status = 'livre';
      livreurDelivery.deliveredAt = now;
      livreurDelivery.amountReceived = livreurAmount;

      // Ajouter à la transaction wallet (SOURCE DE VÉRITÉ)
      if (!livreur.wallet) livreur.wallet = { balance: 0, transactions: [] };

      const livreurTransactionId = this.generateTransactionId();
      livreur.wallet.transactions.push({
        transactionId: livreurTransactionId,
        amount: livreurAmount,
        type: 'credit',
        description: `LIVRAISON - Frais de livraison - Commande ${orderId} - ${clientOrder.clientName}`,
        date: now,
        orderId: orderId,
        clientName: clientOrder.clientName,
        deliveryDistance: clientOrder.distance,
        status: 'terminee',
        details: {
          deliveryFee: livreurAmount,
          clientAddress: clientOrder.address,
          distance: clientOrder.distance,
          type: 'livraison'
        }
      });

      // Recalculer TOUS les soldes depuis les transactions (source de vérité)
      await this.syncLivreurFinances(livreur);

      // Statistiques livreur
      livreur.totalLivraisons = (livreur.totalLivraisons || 0) + 1;
      livreur.totalRevenue = (livreur.totalRevenue || 0) + livreurAmount;

      // ✅ Mettre à jour la livraison dans le nouvel array
      if (Array.isArray(livreur.deliveries)) {
        const deliveryIndex = livreur.deliveries.findIndex(
          d => d.orderId && d.orderId.toString() === orderId.toString()
        );
        if (deliveryIndex !== -1) {
          livreur.deliveries[deliveryIndex].status = 'completed';
          livreur.deliveries[deliveryIndex].completedAt = now;
        }
        
        // Vérifier s'il reste des livraisons en cours
        const pendingDeliveries = livreur.deliveries.filter(d => d.status === 'in_progress' || d.status === 'pending');
        if (pendingDeliveries.length === 0) {
          livreur.status = 'disponible';
        }
      }

      await livreur.save();
      console.log("💰 [VALIDATE_DELIVERY] Livreur crédité:", livreurAmount);

      // 5️⃣ MISE À JOUR DISTRIBUTEUR
      console.log("🏪 [VALIDATE_DELIVERY] Mise à jour distributeur...");
      const distributor = await Distributor.findOne({ 'orders._id': orderId });
      if (!distributor) throw new Error("Distributeur non trouvé");

      const distributorOrder = distributor.orders.id(orderId);
      if (!distributorOrder) throw new Error("Commande non trouvée chez le distributeur");

      distributorOrder.status = 'livre';
      distributorOrder.deliveredAt = now;
      distributorOrder.livreurId = livreur._id;

      const distributorAmount = distributorOrder.productPrice || 0;

      // Vérification que le distributeur reçoit bien quelque chose
      if (distributorAmount <= 0) {
        console.warn("⚠️  [VALIDATE_DELIVERY] ATTENTION: Montant produit = 0, vérifier les données");
      }

      // Ajouter transaction distributeur (SOURCE DE VÉRITÉ)
      const distributorTransactionId = this.generateTransactionId();
      distributor.transactions.push({
        transactionId: distributorTransactionId,
        type: 'vente',
        amount: distributorAmount,
        date: now,
        description: `LIVRAISON - Vente commande ${orderId} - ${clientOrder.clientName}`,
        relatedOrder: orderId,
        method: 'cash',
        status: 'terminee',
        details: {
          productAmount: distributorOrder.productPrice,
          products: distributorOrder.products,
          livreurId: livreur._id.toString(),
          livreurName: livreur.user?.name || 'Livreur',
          deliveryFee: distributorOrder.deliveryFee,
          totalOrder: distributorOrder.total,
          type: 'livraison',
          note: 'Livreur reçoit les frais de livraison séparément'
        }
      });

      // Recalculer TOUS les soldes depuis les transactions (source de vérité)
      await this.syncDistributorFinances(distributor);

      await distributor.save();
      console.log("💰 [VALIDATE_DELIVERY] Distributeur crédité:", {
        montantProduit: distributorAmount,
        nouveauBalance: distributor.balance,
        newRevenue: distributor.revenue
      });

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
      console.log("💰 RÉPARTITION COMPLÈTE DES FONDS:");
      console.log("   Total commande: ", clientOrder.total.toLocaleString(), "FCFA");
      console.log("   🏪 Distributeur reçoit:", distributorAmount.toLocaleString(), "FCFA (montant gaz)");
      console.log("   🚚 Livreur reçoit:", livreurAmount.toLocaleString(), "FCFA (frais livraison)");
      console.log("   ✅ Total réparti:", (distributorAmount + livreurAmount).toLocaleString(), "FCFA");
      console.log("=".repeat(80));

      return {
        success: true,
        message: "✅ Livraison validée avec succès - Paiements distribués",
        codeValid: true,
        livreurValid: true,
        type: 'delivery',
        financial: {
          totalOrder: clientOrder.total,
          productAmount: distributorAmount,
          deliveryFee: livreurAmount,
          distributor: {
            amount: distributorAmount,
            transactionId: distributorTransactionId,
            newBalance: distributor.balance,
            details: "Montant du produit (gaz)"
          },
          livreur: {
            amount: livreurAmount,
            transactionId: livreurTransactionId,
            newBalance: livreur.wallet.balance,
            details: "Frais de livraison"
          }
        }
      };

    } catch (error) {
      console.error("❌ [VALIDATE_DELIVERY] ERREUR CRITIQUE:", error);
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
    try {
      console.log("✅ [CONFIRM_ORDER] Confirmation commande:", {
        orderId,
        distributorId,
        newStatus
      });

      const distributor = await Distributor.findById(distributorId);
      if (!distributor) throw new Error('Distributeur non trouvé');

      const distOrder = distributor.orders.id(orderId);
      if (!distOrder) {
        console.log("⚠️  [CONFIRM_ORDER] Commande non trouvée chez le distributeur - probablement déjà traitée");
        return { 
          message: 'Commande déjà traitée (confirmée/livrée)', 
          alreadyProcessed: true 
        };
      }

      distOrder.status = newStatus;
      await distributor.save();

      const client = await Client.findOne({ 'orders._id': orderId });
      if (!client) {
        console.log("⚠️  [CONFIRM_ORDER] Commande non trouvée chez le client - probablement déjà livrée");
        return { 
          message: 'Commande déjà traitée (confirmée/livrée)', 
          alreadyProcessed: true 
        };
      }

      const clientOrder = client.orders.id(orderId);
      if (!clientOrder) {
        console.log("⚠️  [CONFIRM_ORDER] Commande non trouvée dans orders du client - probablement déjà livrée");
        return { 
          message: 'Commande déjà traitée (confirmée/livrée)', 
          alreadyProcessed: true 
        };
      }

      clientOrder.status = newStatus;
      await client.save();

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
      console.error("❌ [CONFIRM_ORDER] Erreur:", error);
      throw error;
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
   * Rejeter une commande - REMBOURSEMENT COMPLET AU CLIENT
   * Gère les deux cas: livraison et retrait sur place
   */
  static async rejectOrder(orderId, distributorId, reason = "Commande refusée") {
    try {
      console.log("=".repeat(80));
      console.log("❌ [REJECT_ORDER] DÉBUT REJET COMMANDE");
      console.log("📦 Order ID:", orderId);
      console.log("🏪 Distributeur ID:", distributorId);
      console.log("📝 Raison:", reason);

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
      
      // Rembourser le client COMPLÈTEMENT
      const ancienSolde = client.credit || 0;
      const refundAmount = clientOrder.total; // Total = gaz + livraison
      client.credit = ancienSolde + refundAmount;
      
      const transactionId = this.generateTransactionId();
      client.walletTransactions.push({
        transactionId,
        type: 'remboursement',
        amount: refundAmount,
        date: new Date(),
        description: `❌ REMBOURSEMENT - Commande ${orderId} refusée`,
        ancienSolde: ancienSolde,
        nouveauSolde: client.credit,
        details: {
          reason: reason,
          orderId: orderId.toString(),
          productAmount: clientOrder.productPrice,
          deliveryFee: clientOrder.deliveryFee,
          totalRefunded: refundAmount,
          type: clientOrder.isDelivery ? 'livraison' : 'retrait',
          note: 'Client remboursé intégralement'
        }
      });
      
      await client.save();

      console.log("💰 [REJECT_ORDER] Client remboursé:", {
        montantRemboursé: refundAmount,
        ancienSolde: ancienSolde,
        nouveauSolde: client.credit,
        breakdown: {
          gaz: clientOrder.productPrice,
          livraison: clientOrder.deliveryFee
        }
      });

      // 🔔 NOTIFICATION AU CLIENT
      try {
        await NotificationService.notifyClient(
          client._id,
          'order_rejected',
          {
            orderId: orderId.toString(),
            orderNumber: `CMD-${orderId.toString().slice(-6)}`,
            reason: reason,
            amountRefunded: refundAmount
          }
        );
        console.log("📨 [REJECT_ORDER] Notification de refus envoyée au client");
      } catch (notificationError) {
        console.error("❌ [REJECT_ORDER] Erreur envoi notification refus:", notificationError);
      }

      console.log("=".repeat(80));
      console.log("✅ [REJECT_ORDER] COMMANDE REJETÉE - CLIENT REMBOURSÉ");
      console.log("=".repeat(80));

      return { 
        success: true,
        message: 'Commande refusée et client remboursé complètement', 
        clientOrder, 
        distOrder,
        refund: {
          amount: refundAmount,
          breakdown: {
            product: clientOrder.productPrice,
            delivery: clientOrder.deliveryFee
          },
          newBalance: client.credit,
          transactionId: transactionId
        }
      };

    } catch (error) {
      console.error("❌ [REJECT_ORDER] Erreur:", error);
      throw error;
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

  /**
   * Utilitaire ADMIN: Resynchronise les finances d'un distributeur
   * À utiliser si les soldes/revenue ne correspondent pas aux transactions
   */
  static async resyncDistributorFinances(distributorId) {
    try {
      console.log("🔧 [RESYNC] Resynchronisation distributeur:", distributorId);
      
      const distributor = await Distributor.findById(distributorId);
      if (!distributor) throw new Error("Distributeur non trouvé");
      
      // Sauvegarder les anciennes valeurs
      const oldBalance = distributor.balance;
      const oldRevenue = distributor.revenue;
      
      // Recalculer
      await this.syncDistributorFinances(distributor);
      await distributor.save();
      
      console.log("✅ [RESYNC] Distributeur resynchronisé:", {
        distributorId: distributor._id,
        oldBalance, newBalance: distributor.balance,
        oldRevenue, newRevenue: distributor.revenue,
        transactions: distributor.transactions.length
      });
      
      return {
        success: true,
        message: "Finances du distributeur resynchronisées",
        oldBalance,
        newBalance: distributor.balance,
        oldRevenue,
        newRevenue: distributor.revenue
      };
    } catch (error) {
      console.error("❌ [RESYNC] Erreur:", error);
      throw error;
    }
  }

  /**
   * Utilitaire ADMIN: Resynchronise les finances d'un livreur
   * À utiliser si le solde ne correspond pas aux transactions
   */
  static async resyncLivreurFinances(livreurId) {
    try {
      console.log("🔧 [RESYNC] Resynchronisation livreur:", livreurId);
      
      const livreur = await Livreur.findById(livreurId);
      if (!livreur) throw new Error("Livreur non trouvé");
      
      if (!livreur.wallet) livreur.wallet = { balance: 0, transactions: [] };
      
      // Sauvegarder l'ancienne valeur
      const oldBalance = livreur.wallet.balance;
      
      // Recalculer
      await this.syncLivreurFinances(livreur);
      await livreur.save();
      
      console.log("✅ [RESYNC] Livreur resynchronisé:", {
        livreurId: livreur._id,
        oldBalance,
        newBalance: livreur.wallet.balance,
        transactions: livreur.wallet.transactions.length
      });
      
      return {
        success: true,
        message: "Finances du livreur resynchronisées",
        oldBalance,
        newBalance: livreur.wallet.balance,
        transactions: livreur.wallet.transactions.length
      };
    } catch (error) {
      console.error("❌ [RESYNC] Erreur:", error);
      throw error;
    }
  }
}

module.exports = CommandeService;

