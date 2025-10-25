const Distributor = require('../../models/distributeur');
const Livreur = require('../../models/livreur');
const NotificationService = require('../notificationService');

exports.findDistributorById = async (id) => {
  return await Distributor.findById(id)
    .populate('orders')
    .populate('deliveries')
    .populate('revenue');
};

exports.getOrdersByStatus = async (distributorId, status) => {
  if (!status) throw new Error("Le paramètre 'status' est requis");

  const distributor = await Distributor.findById(distributorId);
  if (!distributor) throw new Error("Distributeur non trouvé");

  const orders = distributor.orders.filter(order => order.status === status);
  return orders;
};

exports.assignDelivery = async (distributorId, orderId, driverId, driverName, driverPhone) => {
  const session = await require('mongoose').startSession();
  session.startTransaction();

  try {
    console.log("🚚 [ASSIGN_DELIVERY] Début assignation:", {
      distributorId,
      orderId,
      driverId,
      driverName
    });

    // 1️⃣ VÉRIFICATION DISTRIBUTEUR
    const distributor = await Distributor.findById(distributorId).populate('user').session(session);
    if (!distributor) throw new Error("Distributeur non trouvé");

    // 2️⃣ VÉRIFICATION COMMANDE
    const order = distributor.orders.id(orderId);
    if (!order) throw new Error("Commande non trouvée");
    
    // Vérifier si la commande n'est pas déjà en livraison
    if (order.status === 'en_livraison') {
      throw new Error("Cette commande est déjà en cours de livraison");
    }

    // 3️⃣ VÉRIFICATION LIVREUR
    const driver = await Livreur.findById(driverId).populate("user").session(session);
    if (!driver) throw new Error(`Livreur non trouvé avec l'ID "${driverId}".`);

    // 🔍 VÉRIFICATION CRITIQUE : Éviter les doublons
    const existingDelivery = driver.deliveryHistory.find(
      d => d.orderId && d.orderId.toString() === orderId.toString()
    );

    if (existingDelivery) {
      console.log("⚠️ [ASSIGN_DELIVERY] Commande déjà assignée à ce livreur:", {
        orderId,
        existingStatus: existingDelivery.status,
        existingId: existingDelivery._id
      });
      
      // Si la livraison existe mais est annulée, on peut la réactiver
      if (existingDelivery.status === 'annule' || existingDelivery.status === 'termine') {
        console.log("🔄 [ASSIGN_DELIVERY] Réactivation de la livraison existante");
        existingDelivery.status = 'en_cours';
        existingDelivery.scheduledAt = new Date();
      } else {
        throw new Error("Cette commande est déjà assignée à ce livreur");
      }
    }

    // 4️⃣ VÉRIFICATION CLIENT
    const Client = require('../../models/client');
    const client = await Client.findOne({ 'orders._id': orderId }).session(session);
    if (!client) throw new Error("Client non trouvé pour cette commande");

    const clientOrder = client.orders.id(orderId);
    if (!clientOrder) throw new Error("Commande non trouvée chez le client");

    // 5️⃣ CRÉATION LIVRAISON DISTRIBUTEUR (uniquement si pas de doublon)
    if (!existingDelivery) {
      const deliveryForDistributor = {
        orderId: order._id,
        clientName: order.clientName,
        driverId: driver._id,
        driverName: driverName || driver.user?.name || "Inconnu",
        driverPhone: driverPhone || driver.user?.phone || "Non fourni",
        status: "en_route",
        delivery: order.delivery || "non", 
        startTime: new Date(),
        total: order.total,
        estimatedTime: "30min"
      };
      distributor.deliveries.push(deliveryForDistributor);
    }

    // 6️⃣ MISE À JOUR STATUT COMMANDE DISTRIBUTEUR
    order.status = "en_livraison";
    order.livreurId = driver._id;

    // 7️⃣ AJOUT DANS L'HISTORIQUE LIVREUR (uniquement si pas de doublon)
    if (!existingDelivery) {
      const deliveryForDriver = {
        orderId: order._id,
        clientName: order.clientName,
        clientPhone: order.clientPhone,
        address: order.address,
        status: "en_cours",
        delivery: order.delivery || "non",
        total: order.total,
        deliveryFee: order.deliveryFee || 0,
        deliveredAt: null,
        scheduledAt: new Date(),
        distance: order.distance || "0",
        estimatedTime: "30min",
        priority: order.priority || "normal"
      };

      driver.deliveryHistory.push(deliveryForDriver);
      console.log("✅ [ASSIGN_DELIVERY] Nouvelle livraison ajoutée à l'historique livreur");
    }

    // 8️⃣ MISE À JOUR STATUT LIVREUR
    driver.status = "occupé";
    if (!driver.zone) driver.zone = distributor.zone || "Zone par défaut";

    // 9️⃣ MISE À JOUR COMMANDE CLIENT
    clientOrder.status = "en_livraison";
    clientOrder.livreurId = driver._id;

    // 💾 SAUVEGARDE TRANSACTION
    await distributor.save({ session });
    await driver.save({ session });
    await client.save({ session });

    await session.commitTransaction();
    console.log("✅ [ASSIGN_DELIVERY] Transaction sauvegardée avec succès");

    // 🔔 NOTIFICATIONS
    const notificationErrors = [];

    try {
      // NOTIFICATION LIVREUR
      await NotificationService.notifyLivreur(
        driverId,
        'new_delivery',
        {
          orderId: orderId.toString(),
          orderNumber: `CMD-${orderId.toString().slice(-6)}`,
          clientName: order.clientName,
          clientPhone: order.clientPhone,
          address: order.address,
          amount: order.deliveryFee || 0,
          distance: order.distance,
          estimatedTime: "30min",
          distributorName: distributor.user?.name || distributor.name || "Distributeur",
          validationCode: clientOrder.validationCode // Important pour la livraison
        }
      );
      console.log("📨 [ASSIGN_DELIVERY] Notification envoyée au livreur");
    } catch (error) {
      console.error("❌ [ASSIGN_DELIVERY] Erreur notification livreur:", error);
      notificationErrors.push("Livreur");
    }

    try {
      // NOTIFICATION DISTRIBUTEUR
      await NotificationService.notifyDistributor(
        distributorId,
        'driver_assigned',
        {
          orderId: orderId.toString(),
          orderNumber: `CMD-${orderId.toString().slice(-6)}`,
          driverName: driverName || driver.user?.name || "Livreur",
          driverPhone: driverPhone || driver.user?.phone || "Non fourni",
          clientName: order.clientName,
          amount: order.deliveryFee || 0
        }
      );
      console.log("📨 [ASSIGN_DELIVERY] Notification envoyée au distributeur");
    } catch (error) {
      console.error("❌ [ASSIGN_DELIVERY] Erreur notification distributeur:", error);
      notificationErrors.push("Distributeur");
    }

    try {
      // NOTIFICATION CLIENT
      await NotificationService.notifyClient(
        client._id,
        'driver_assigned',
        {
          orderId: orderId.toString(),
          orderNumber: `CMD-${orderId.toString().slice(-6)}`,
          driverName: driverName || driver.user?.name || "Livreur",
          driverPhone: driverPhone || driver.user?.phone || "Non fourni",
          estimatedTime: "30min",
          total: order.total,
          address: order.address,
          validationCode: clientOrder.validationCode
        }
      );
      console.log("📨 [ASSIGN_DELIVERY] Notification envoyée au client");
    } catch (error) {
      console.error("❌ [ASSIGN_DELIVERY] Erreur notification client:", error);
      notificationErrors.push("Client");
    }

    return {
      success: true,
      message: existingDelivery ? "✅ Livraison réactivée avec succès" : "✅ Livraison assignée avec succès",
      existingAssignment: !!existingDelivery,
      orderDetails: {
        orderId: order._id.toString(),
        orderNumber: `CMD-${orderId.toString().slice(-6)}`,
        clientName: order.clientName,
        clientPhone: order.clientPhone,
        address: order.address,
        total: order.total,
        deliveryFee: order.deliveryFee || 0,
        validationCode: clientOrder.validationCode
      },
      driverDetails: {
        driverId: driver._id.toString(),
        driverName: driverName || driver.user?.name,
        driverPhone: driverPhone || driver.user?.phone,
        status: driver.status
      },
      notificationErrors: notificationErrors.length > 0 ? notificationErrors : null
    };

  } catch (error) {
    await session.abortTransaction();
    console.error("❌ [ASSIGN_DELIVERY] Erreur critique:", error.message);
    throw new Error(`Erreur lors de l'assignation: ${error.message}`);
  } finally {
    session.endSession();
  }
};

/**
 * Nettoyer les doublons dans l'historique des livreurs
 */
exports.cleanDuplicateDeliveries = async (livreurId) => {
  try {
    const livreur = await Livreur.findById(livreurId);
    if (!livreur) throw new Error("Livreur non trouvé");

    const uniqueDeliveries = [];
    const seenOrderIds = new Set();

    // Parcourir en sens inverse pour garder les plus récentes
    for (let i = livreur.deliveryHistory.length - 1; i >= 0; i--) {
      const delivery = livreur.deliveryHistory[i];
      const orderIdStr = delivery.orderId ? delivery.orderId.toString() : null;
      
      if (orderIdStr && !seenOrderIds.has(orderIdStr)) {
        seenOrderIds.add(orderIdStr);
        uniqueDeliveries.unshift(delivery); // Remettre dans l'ordre
      } else {
        console.log(`🗑️ Suppression doublon: orderId ${orderIdStr}`);
      }
    }

    livreur.deliveryHistory = uniqueDeliveries;
    await livreur.save();

    return {
      success: true,
      message: `Nettoyage terminé: ${livreur.deliveryHistory.length} livraisons uniques`,
      removed: livreur.deliveryHistory.length - uniqueDeliveries.length
    };
  } catch (error) {
    console.error("❌ Erreur nettoyage doublons:", error);
    throw error;
  }
};