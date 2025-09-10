const Distributor = require('../../models/distributeur');

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