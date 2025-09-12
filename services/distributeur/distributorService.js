const Distributor = require('../../models/distributeur');
const Livreur = require('../../models/livreur');

exports.findDistributorById = async (id) => {
  // On peut ajouter un populate si commandes ou livraisons sont des références
  return await Distributor.findById(id)
    .populate('orders')      // si 'orders' est une référence vers une autre collection
    .populate('deliveries') // idem pour 'deliveries'
    .populate('revenue');  // idem pour 'revenue'
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
    // 1. Trouver le distributeur
    const distributor = await Distributor.findById(distributorId);
    if (!distributor) throw new Error("Distributeur non trouvé");

    // 2. Trouver la commande dans ses orders
    const order = distributor.orders.id(orderId);
    if (!order) throw new Error("Commande non trouvée");

    // 3. Trouver le livreur
    const driver = await Livreur.findById(driverId).populate("user");
    if (!driver) throw new Error(`Livreur non trouvé avec l'ID "${driverId}".`);

    // 4. Créer l'objet de livraison pour le distributeur
    const deliveryForDistributor = {
      orderId: order._id,
      clientName: order.clientName,
      driverId: driver._id,
      driverName: driverName || driver.user?.name || "Inconnu",
      driverPhone: driverPhone || driver.user?.phone || "Non fourni",
      status: "en_route",
      startTime: new Date(),
      total: order.total,
    };
    distributor.deliveries.push(deliveryForDistributor);

    // 5. Mettre à jour le statut de la commande
    order.status = "en_livraison";

    // 6. Créer l'objet de livraison pour le livreur
    const deliveryForDriver = {
      orderId: order._id,
      clientName: order.clientName,
      clientPhone: order.clientPhone,
      address: order.address,
      status: "en_cours",
      distance: order.distance,
      estimatedTime: "30min", // valeur par défaut, tu peux calculer
      total: order.total,
      scheduledAt: new Date(),
    };
    driver.todaysDeliveries.push(deliveryForDriver);

    // 7. Mettre le livreur occupé
    driver.status = "occupé";
    if (!driver.zone) driver.zone = distributor.zone || "Zone par défaut";

    // 8. Sauvegarder les deux
    await distributor.save();
    await driver.save();

    return {
      distributorDelivery: deliveryForDistributor,
      driverDelivery: deliveryForDriver,
    };
  } catch (error) {
    throw new Error(`Erreur lors de l'assignation de la livraison: ${error.message}`);
  }
};
