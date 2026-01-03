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

exports.assignDelivery = async (distributorId, orderId, driverId, driverName, driverPhone, frontendClientName = null, frontendTotal = null) => {
  try {
    console.log("🚚 [ASSIGN_DELIVERY] Début assignation:", {
      distributorId,
      orderId,
      driverId,
      driverName,
      frontendClientName,
      frontendTotal
    });

    // 1️⃣ VÉRIFICATION DISTRIBUTEUR - ✅ AVEC POPULATE ORDERS
    const distributor = await Distributor.findById(distributorId)
      .populate('user')
      .populate('orders');  // ✅ IMPORTANT! Sinon on ne peut pas accéder aux orders
    
    if (!distributor) throw new Error("Distributeur non trouvé");
    if (!distributor.orders || distributor.orders.length === 0) {
      throw new Error("Le distributeur n'a aucune commande");
    }

    // 2️⃣ VÉRIFICATION COMMANDE - ✅ AVEC MEILLEURE VALIDATION
    const order = distributor.orders.id(orderId);
    if (!order) {
      console.error("❌ Commande non trouvée. IDs disponibles:", 
        distributor.orders.map(o => o._id.toString())
      );
      throw new Error(`Commande ${orderId} non trouvée chez le distributeur`);
    }
    
    console.log("✅ Commande trouvée:", { 
      orderId: order._id.toString(), 
      status: order.status,
      clientName: order.clientName 
    });
    
    // ℹ️ Statut en_livraison est OK - le frontend l'a déjà mis à jour
    // On va juste assigner/réassigner le livreur

    // 3️⃣ VÉRIFICATION LIVREUR - ✅ AVEC VALIDATION ARRAY
    const driver = await Livreur.findById(driverId).populate("user");
    if (!driver) throw new Error(`Livreur non trouvé avec l'ID "${driverId}".`);
    
    console.log(" Livreur trouvé:", { 
      driverId: driver._id.toString(), 
      status: driver.status 
    });

    // 4️⃣ VÉRIFICATION CLIENT -  AVEC POPULATE ORDERS (AVANT de vérifier les doublons)
    const Client = require('../../models/client');
    const client = await Client.findOne({ 'orders._id': orderId })
      .populate('orders');  
    
    if (!client) throw new Error("Client non trouvé pour cette commande");

    const clientOrder = client.orders.id(orderId);
    if (!clientOrder) {
      console.error(" Commande client non trouvée. IDs disponibles:", 
        client.orders.map(o => o._id.toString())
      );
      throw new Error("Commande non trouvée chez le client");
    }

    console.log(" Client et commande client trouvés");

    //  DÉTECTER SI C'EST UNE RÉASSIGNATION (avant de vérifier les doublons)
    const isReassignment = clientOrder.driverCancelledAt ? true : false;
    const alertMessage = isReassignment 
      ? ` RÉASSIGNATION: Cette commande a déjà été annulée une fois par un livreur. Le livreur ${driverName || driver.user?.name} s'engage maintenant définitivement à la livrer.`
      : null;

    if (isReassignment) {
      console.log(" [ASSIGN_DELIVERY] RÉASSIGNATION DÉTECTÉE:", {
        orderId: orderId.toString(),
        driverCancelledAt: clientOrder.driverCancelledAt,
        newDriver: driverName || driver.user?.name
      });
    }

    //  VÉRIFICATION CRITIQUE : Vérifier les doublons et réassignations
    const existingDelivery = driver.deliveries.find(
      d => d.orderId && d.orderId.toString() === orderId.toString()
    );

    if (existingDelivery) {
      console.log(" Commande déjà assignée à ce livreur:", {
        orderId,
        existingStatus: existingDelivery.status,
        existingId: existingDelivery._id
      });
      
      // Si la livraison existe mais est cancelled, on peut la réactiver
      if (existingDelivery.status === 'cancelled') {
        console.log(" [ASSIGN_DELIVERY] Réactivation de la livraison existante");
        existingDelivery.status = 'pending';
        existingDelivery.assignedAt = new Date();
      } else {
        // Livraison déjà active pour ce livreur - c'est un succès (doublon idempotent)
        console.log(" [ASSIGN_DELIVERY] Livraison déjà assignée, retour succès (idempotent)");
        return {
          success: true,
          message: " Livraison déjà assignée à ce livreur",
          existingAssignment: true,
          alreadyAssigned: true,
          isReassignment: isReassignment,
          alertMessage: alertMessage,
          orderDetails: {
            orderId: order._id.toString(),
            orderNumber: `CMD-${orderId.toString().slice(-6)}`,
            clientName: frontendClientName || order.clientName,
            clientPhone: order.clientPhone,
            address: order.address,
            total: frontendTotal || order.total,
            deliveryFee: order.deliveryFee || 0,
            validationCode: existingDelivery.validationCode
          },
          driverDetails: {
            driverId: driver._id.toString(),
            driverName: driverName || driver.user?.name,
            driverPhone: driverPhone || driver.user?.phone,
            status: driver.status
          },
          notificationErrors: null
        };
      }
    }

    //  GESTION RÉASSIGNATION - Si la commande a un livreur différent
    if (order.livreurId && order.livreurId.toString() !== driverId.toString()) {
      console.log(" [ASSIGN_DELIVERY] Réassignation détectée - retrait de l'ancien livreur");
      try {
        const oldDriver = await Livreur.findById(order.livreurId);
        if (oldDriver && Array.isArray(oldDriver.deliveries)) {
          oldDriver.deliveries = oldDriver.deliveries.filter(
            d => !d.orderId || d.orderId.toString() !== orderId.toString()
          );
          await oldDriver.save();
          console.log("✅ Commande retirée de l'ancien livreur");
        }
      } catch (error) {
        console.warn("⚠️ Erreur lors du retrait de l'ancien livreur:", error.message);
        // On continue quand même
      }
    }

    // ✅ VÉRIFIER LE CODE DE VALIDATION
    if (!clientOrder.validationCode) {
      console.warn("⚠️ [ASSIGN_DELIVERY] Code de validation manquant, génération...");
      clientOrder.validationCode = Math.floor(100000 + Math.random() * 900000).toString();
    }

    // 5️⃣ CRÉATION LIVRAISON DISTRIBUTEUR (uniquement si pas de doublon)
    if (!existingDelivery) {
      const deliveryForDistributor = {
        orderId: order._id,
        clientName: frontendClientName || order.clientName,
        driverId: driver._id,
        driverName: driverName || driver.user?.name || "Inconnu",
        driverPhone: driverPhone || driver.user?.phone || "Non fourni",
        status: "en_route",
        delivery: order.delivery || "non", 
        startTime: new Date(),
        total: frontendTotal || order.total,
        estimatedTime: "30min"
      };
      distributor.deliveries.push(deliveryForDistributor);
      console.log("✅ Livraison ajoutée au distributeur");
    }

    // 6️⃣ MISE À JOUR STATUT COMMANDE DISTRIBUTEUR
    order.status = "en_livraison";
    order.livreurId = driver._id;
    console.log(" Statut commande distributeur mis à jour");

    // 7️⃣ AJOUT DANS LE NOUVEAU ARRAY DELIVERIES (uniquement si pas de doublon)
    if (!existingDelivery) {
      // Copier les produits depuis clientOrder - utiliser toPlainObject pour éviter les problèmes Mongoose
      const sourceProducts = clientOrder.products || order.products || [];
      
      console.log("🔍 [PRODUCTS_DEBUG] sourceProducts:", sourceProducts);
      console.log("🔍 [PRODUCTS_DEBUG] Type:", typeof sourceProducts);
      console.log("🔍 [PRODUCTS_DEBUG] Is Array:", Array.isArray(sourceProducts));
      
      // Copier chaque produit en tant qu'objet simple (pas de référence Mongoose)
      const productsArray = (Array.isArray(sourceProducts) ? sourceProducts : [sourceProducts]).map(p => {
        // Extraire les propriétés sans référence Mongoose
        const product = p.toObject ? p.toObject() : p;
        return {
          name: product.name || 'Produit inconnu',
          type: product.type || 'Standard',
          quantity: product.quantity || 1
        };
      });
      
      console.log("✅ [PRODUCTS_DEBUG] productsArray final:", productsArray);

      const deliveryForDriver = {
        orderId: order._id,
        clientName: frontendClientName || order.clientName,
        clientPhone: order.clientPhone,
        address: order.address,
        status: "pending",  //  Statut: pending (assignée)
        delivery: order.delivery || "non",
        total: frontendTotal || order.total,
        deliveryFee: order.deliveryFee || 0,
        products: productsArray,
        distance: order.distance || "0",
        estimatedTime: order.estimatedTime || "30min",
        priority: order.priority || "normal",
        distributorName: distributor.user?.name || distributor.name || "Distributeur",
        validationCode: clientOrder.validationCode,
        
        //  TIMESTAMPS ESSENTIELS
        createdAt: new Date(),
        assignedAt: new Date()
      };

      // Vider les anciennes livraisons pour éviter les problèmes de validation
      driver.deliveries = [];
      
      // Ajouter la nouvelle livraison
      driver.deliveries.push(deliveryForDriver);
      
      // Mettre à jour le statut
      driver.status = "occupé";
      if (!driver.zone) driver.zone = distributor.zone || "Zone par défaut";
      
      // Sauvegarder
      await driver.save();
      
      console.log("✅ [ASSIGN_DELIVERY] Livraison ajoutée au livreur (anciennes livraisons vidées)");
    } else {
      // Si existingDelivery existe, juste mettre à jour le statut
      driver.status = "occupé";
      if (!driver.zone) driver.zone = distributor.zone || "Zone par défaut";
      await driver.save();
    }

    // 💾 SAUVEGARDE DISTRIBUTEUR
    console.log("💾 Sauvegarde du distributeur...");
    try {
      await distributor.save();
      console.log("✅ Distributeur sauvegardé");
    } catch (error) {
      console.error("❌ Erreur sauvegarde distributeur:", error);
      throw error;
    }

    // 9️⃣ MISE À JOUR COMMANDE CLIENT - AVEC updateOne et arrayFilters
    try {
      console.log("🔄 Mise à jour commande client avec updateOne...");
      console.log("🔍 Données de mise à jour:", {
        orderId: orderId.toString(),
        driverId: driver._id.toString(),
        status: 'en_livraison'
      });
      
      const updateResult = await Client.updateOne(
        { 'orders._id': orderId },
        { 
          $set: { 
            'orders.$[order].status': 'en_livraison',
            'orders.$[order].livreurId': driver._id
          }
        },
        { 
          arrayFilters: [{ 'order._id': orderId }]
        }
      );
      
      console.log("📊 Résultat updateOne:", {
        matchedCount: updateResult.matchedCount,
        modifiedCount: updateResult.modifiedCount,
        acknowledged: updateResult.acknowledged
      });
      
      if (updateResult.matchedCount === 0) {
        throw new Error("Aucune commande trouvée pour la mise à jour");
      }
      
      if (updateResult.modifiedCount === 0) {
        console.warn("⚠️ Aucune modification effectuée (peut-être déjà à jour)");
      }
      
      console.log("✅ Commande client mise à jour avec updateOne");
      
      // Vérifier que la mise à jour a bien fonctionné
      const verifyClient = await Client.findOne({ 'orders._id': orderId });
      const verifyOrder = verifyClient.orders.id(orderId);
      console.log("🔍 Vérification après sauvegarde:", {
        orderId: verifyOrder._id.toString(),
        livreurId: verifyOrder.livreurId ? verifyOrder.livreurId.toString() : 'null',
        status: verifyOrder.status
      });
      
      if (!verifyOrder.livreurId) {
        console.error("❌ ERREUR CRITIQUE: livreurId toujours null après mise à jour!");
        console.error("🔍 Détails de la commande:", JSON.stringify(verifyOrder, null, 2));
        throw new Error("Impossible de mettre à jour le livreurId dans la commande client");
      }
    } catch (error) {
      console.error("❌ Erreur mise à jour commande client:", error);
      throw error;
    }

    console.log("✅ [ASSIGN_DELIVERY] Toutes les données sauvegardées avec succès");

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
          amount: order.deliveryFee || 0,
          isReassignment: clientOrder.driverCancelledAt ? true : false
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
          total: frontendTotal || order.total,
          address: order.address,
          validationCode: clientOrder.validationCode
        }
      );
      console.log("📨 [ASSIGN_DELIVERY] Notification envoyée au client");
    } catch (error) {
      console.error("❌ [ASSIGN_DELIVERY] Erreur notification client:", error);
      notificationErrors.push("Client");
    }

    console.log("🎉 [ASSIGN_DELIVERY] ASSIGNATION COMPLÈTE AVEC SUCCÈS");

    return {
      success: true,
      message: existingDelivery ? "✅ Livraison réactivée avec succès" : "✅ Livraison assignée avec succès",
      existingAssignment: !!existingDelivery,
      isReassignment: isReassignment,
      alertMessage: alertMessage,
      orderDetails: {
        orderId: order._id.toString(),
        orderNumber: `CMD-${orderId.toString().slice(-6)}`,
        clientName: frontendClientName || order.clientName,
        clientPhone: order.clientPhone,
        address: order.address,
        total: frontendTotal || order.total,
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
    console.error("❌ [ASSIGN_DELIVERY] ERREUR CRITIQUE:", error.message);
    console.error("Stack:", error.stack);
    throw new Error(`Erreur lors de l'assignation: ${error.message}`);
  }
};

/**
 * Nettoyer les doublons dans les livraisons des livreurs
 */
exports.cleanDuplicateDeliveries = async (livreurId) => {
  try {
    const livreur = await Livreur.findById(livreurId);
    if (!livreur) throw new Error("Livreur non trouvé");

    const uniqueDeliveries = [];
    const seenOrderIds = new Set();

    // Parcourir en sens inverse pour garder les plus récentes
    for (let i = livreur.deliveries.length - 1; i >= 0; i--) {
      const delivery = livreur.deliveries[i];
      const orderIdStr = delivery.orderId ? delivery.orderId.toString() : null;
      
      if (orderIdStr && !seenOrderIds.has(orderIdStr)) {
        seenOrderIds.add(orderIdStr);
        uniqueDeliveries.unshift(delivery); // Remettre dans l'ordre
      } else {
        console.log(`🗑️ Suppression doublon: orderId ${orderIdStr}`);
      }
    }

    livreur.deliveries = uniqueDeliveries;
    await livreur.save();

    return {
      success: true,
      message: `Nettoyage terminé: ${livreur.deliveries.length} livraisons uniques`,
      removed: livreur.deliveries.length - uniqueDeliveries.length
    };
  } catch (error) {
    console.error("❌ Erreur nettoyage doublons:", error);
    throw error;
  }
};