const Distributor = require('../../models/distributeur');
const Livreur = require('../../models/livreur');

exports.findDistributorById = async (id) => {
  // On peut ajouter un populate si commandes ou livraisons sont des références
  return await Distributor.findById(id)
    .populate('orders')      // si 'orders' est une référence vers une autre collection
    .populate('deliveries')  // idem pour 'deliveries'
    .populate('revenue');    // idem pour 'revenue'
};

// service/distributorService.js
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
    const distributor = await Distributor.findById(distributorId);
    if (!distributor) throw new Error("Distributeur non trouvé");

    // 2️⃣ Trouver la commande dans ses orders
    const order = distributor.orders.id(orderId);
    if (!order) throw new Error("Commande non trouvée");

    // 3️⃣ Trouver le livreur
    const driver = await Livreur.findById(driverId).populate("user");
    if (!driver) throw new Error(`Livreur non trouvé avec l'ID "${driverId}".`);

    // 4️⃣ Créer l'objet de livraison pour le distributeur
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

    // 5️⃣ Mettre à jour la commande côté distributeur
    order.status = "en_livraison";
    order.delivery = "non"; 

    // 6️⃣ 🔹 On supprime l'ajout dans todaysDeliveries
    // driver.todaysDeliveries.push(deliveryForDriver); ← supprimé

    // 7️⃣ Ajouter dans l’historique du livreur (deliveryHistory)
    driver.deliveryHistory.push({
      orderId: order._id,
      clientName: order.clientName,
      clientPhone: order.clientPhone,
      address: order.address,
      status: "en_cours",
      delivery: "non",
      total: order.total,
      deliveredAt: new Date(),
      scheduledAt: new Date(),
      distance: order.distance,
      estimatedTime: "30min", // valeur par défaut
    });

    // 8️⃣ Mettre le livreur comme "occupé"
    driver.status = "occupé";
    if (!driver.zone) driver.zone = distributor.zone || "Zone par défaut";

    // 9️⃣ Sauvegarder les deux
    await distributor.save();
    await driver.save();

    return {
      message: "✅ Livraison assignée avec succès (ajout uniquement dans deliveryHistory)",
      distributorDelivery: deliveryForDistributor,
    };
  } catch (error) {
    throw new Error(`Erreur lors de l'assignation de la livraison: ${error.message}`);
  }
};
