const Distributor = require('../../models/distributeur');
const Livreur = require('../../models/livreur');
const NotificationService = require('../notificationService'); // Important: ajouter l'import

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
  try {
    // 1️⃣ Trouver le distributeur
    const distributor = await Distributor.findById(distributorId).populate('user');
    if (!distributor) throw new Error("Distributeur non trouvé");

    // 2️⃣ Trouver la commande dans ses orders
    const order = distributor.orders.id(orderId);
    if (!order) throw new Error("Commande non trouvée");

    // 3️⃣ Trouver le livreur
    const driver = await Livreur.findById(driverId).populate("user");
    if (!driver) throw new Error(`Livreur non trouvé avec l'ID "${driverId}".`);

    // 4️⃣ Trouver le client pour les notifications
    const Client = require('../../models/client');
    const client = await Client.findOne({ 'orders._id': orderId });
    if (!client) throw new Error("Client non trouvé pour cette commande");

    // 5️⃣ Créer l'objet de livraison pour le distributeur
    const deliveryForDistributor = {
      orderId: order._id,
      clientName: order.clientName,
      driverId: driver._id,
      driverName: driverName || driver.user?.name || "Inconnu",
      driverPhone: driverPhone || driver.user?.phone || "Non fourni",
      status: "en_route",
      delivery: "non", 
      startTime: new Date(),
      total: order.total,
    };
    distributor.deliveries.push(deliveryForDistributor);

    // 6️⃣ Mettre à jour la commande côté distributeur
    order.status = "en_livraison";
    order.delivery = "non";

    // 7️⃣ Ajouter dans l'historique du livreur (deliveryHistory)
    const deliveryForDriver = {
      orderId: order._id,
      clientName: order.clientName,
      clientPhone: order.clientPhone,
      address: order.address,
      status: "en_cours",
      delivery: "non",
      total: order.total,
      deliveryFee: order.deliveryFee || 0,
      deliveredAt: null,
      scheduledAt: new Date(),
      distance: order.distance,
      estimatedTime: "30min",
    };

    driver.deliveryHistory.push(deliveryForDriver);

    // 8️⃣ Mettre le livreur comme "occupé"
    driver.status = "occupé";
    if (!driver.zone) driver.zone = distributor.zone || "Zone par défaut";

    // 9️⃣ Sauvegarder avant les notifications
    await distributor.save();
    await driver.save();

    // 🔔 🔔 🔔 NOTIFICATIONS - TOUS LES ACTEURS 🔔 🔔 🔔
    const notificationErrors = [];

    try {
      // 1️⃣ NOTIFICATION AU LIVREUR
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
          distributorName: distributor.user?.name || distributor.name || "Distributeur"
        }
      );
      console.log("📨 Notification de nouvelle livraison envoyée au livreur");
    } catch (error) {
      console.error("❌ Erreur notification livreur:", error);
      notificationErrors.push("Livreur");
    }

    try {
      // 2️⃣ NOTIFICATION AU DISTRIBUTEUR
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
      console.log("📨 Notification d'assignation envoyée au distributeur");
    } catch (error) {
      console.error("❌ Erreur notification distributeur:", error);
      notificationErrors.push("Distributeur");
    }

    try {
      // 3️⃣ NOTIFICATION AU CLIENT
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
          address: order.address
        }
      );
      console.log("📨 Notification d'assignation envoyée au client");
    } catch (error) {
      console.error("❌ Erreur notification client:", error);
      notificationErrors.push("Client");
    }

    // Résumé des notifications
    const notificationStatus = notificationErrors.length === 0 
      ? "✅ Toutes les notifications envoyées"
      : `⚠️ Notifications échouées: ${notificationErrors.join(", ")}`;

    return {
      success: true,
      message: "✅ Livraison assignée avec succès",
      notifications: notificationStatus,
      orderDetails: {
        orderId: order._id.toString(),
        orderNumber: `CMD-${orderId.toString().slice(-6)}`,
        clientName: order.clientName,
        clientPhone: order.clientPhone,
        address: order.address,
        total: order.total,
        deliveryFee: order.deliveryFee || 0
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
    console.error("❌ Erreur lors de l'assignation de la livraison:", error.message);
    throw new Error(`Erreur lors de l'assignation de la livraison: ${error.message}`);
  }
};