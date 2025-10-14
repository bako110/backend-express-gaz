// services/livreurService.js
const Livreur = require('../../models/livreur');

/**
 * Récupère tous les livreurs avec leurs informations utilisateur
 * @returns {Promise<Array>}
 */
async function getAllLivreurs() {
  try {
    const livreurs = await Livreur.find()
      .populate('user', 'name phone photo userType')
      .exec();
    return livreurs;
  } catch (error) {
    throw new Error('Erreur lors de la récupération des livreurs : ' + error.message);
  }
}

/**
 * Récupère tous les livreurs disponibles ou selon un status
 * @param {String} status
 * @returns {Promise<Array>}
 */
async function getLivreurs(status) {
  try {
    let filter = {};
    if (status) {
      filter.status = status;
    }
    const livreurs = await Livreur.find(filter);
    return livreurs;
  } catch (error) {
    throw new Error("Erreur lors de la récupération des livreurs: " + error.message);
  }
}

/**
 * Récupérer les commandes d'un livreur par status
 * @param {String} livreurId
 * @param {String} status - pending, confirmed, preparing, in_transit, delivered, canceled
 * @returns {Promise<Array>}
 */
async function getDeliveriesByStatus(livreurId, status) {
  try {
    const livreur = await Livreur.findById(livreurId).exec();
    if (!livreur) {
      throw new Error('Livreur non trouvé');
    }

    // Combiner todaysDeliveries et deliveryHistory pour une recherche complète
    const allDeliveries = [
      ...livreur.todaysDeliveries,
      ...livreur.deliveryHistory
    ];

    // Filtrer par status
    const filteredDeliveries = allDeliveries
      .filter(delivery => delivery.status === status)
      .map(delivery => ({
        orderId: delivery.orderId,
        clientName: delivery.clientName,
        clientPhone: delivery.clientPhone,
        address: delivery.address,
        status: delivery.status,
        distance: delivery.distance || 'N/A',
        estimatedTime: delivery.estimatedTime || 'N/A',
        total: delivery.total,
        scheduledAt: delivery.scheduledAt || delivery.deliveredAt,
        products: delivery.products || [],
        priority: delivery.priority || 'normal'
      }));

    return filteredDeliveries;
  } catch (error) {
    throw new Error('Erreur lors de la récupération des commandes : ' + error.message);
  }
}

/**
 * Récupérer toutes les commandes d'un livreur
 * @param {String} livreurId
 * @returns {Promise<Array>}
 */
async function getAllDeliveries(livreurId) {
  try {
    const livreur = await Livreur.findById(livreurId).exec();
    if (!livreur) {
      throw new Error('Livreur non trouvé');
    }

    // Combiner toutes les livraisons
    const allDeliveries = [
      ...livreur.todaysDeliveries,
      ...livreur.deliveryHistory
    ];

    return allDeliveries.map(delivery => ({
      orderId: delivery.orderId,
      clientName: delivery.clientName,
      clientPhone: delivery.clientPhone,
      address: delivery.address,
      status: delivery.status,
      distance: delivery.distance || 'N/A',
      estimatedTime: delivery.estimatedTime || 'N/A',
      total: delivery.total,
      scheduledAt: delivery.scheduledAt || delivery.deliveredAt,
      products: delivery.products || [],
      priority: delivery.priority || 'normal'
    }));
  } catch (error) {
    throw new Error('Erreur lors de la récupération des commandes : ' + error.message);
  }
}

/**
 * Récupérer l'historique complet d'un livreur
 * @param {String} livreurId
 * @returns {Promise<Object>}
 */
async function getLivreurDashboard(livreurId) {
  try {
    const livreur = await Livreur.findById(livreurId)
      .populate('user', 'name phone photo userType')
      .exec();

    if (!livreur) throw new Error('Livreur non trouvé');

    // Extraire uniquement l'historique des livraisons
    const deliveryHistory = livreur.deliveryHistory.map(delivery => ({
      orderId: delivery.orderId || delivery._id,
      clientName: delivery.clientName,
      clientPhone: delivery.clientPhone,
      address: delivery.address,
      status: delivery.status,
      total: delivery.total,
      deliveredAt: delivery.deliveredAt,
      products: delivery.products || [],
      priority: delivery.priority || 'normal',
    }));

    // Dashboard global (sans todaysDeliveries)
    return {
      user: {
        name: livreur.user.name,
        phone: livreur.user.phone,
        photo: livreur.user.photo,
      },
      stats: {
        today: livreur.stats.today,
        week: livreur.stats.week,
        totalLivraisons: livreur.totalLivraisons,
        totalRevenue: livreur.totalRevenue,
      },
      status: livreur.status,
      vehicleType: livreur.vehicleType,
      zone: livreur.zone,
      wallet: livreur.wallet,
      deliveryHistory, // uniquement l'historique
    };
  } catch (error) {
    throw new Error('Erreur lors de la récupération de l\'historique : ' + error.message);
  }
}


module.exports = {
  getAllLivreurs,
  getLivreurs,
  getDeliveriesByStatus,
  getAllDeliveries,
  getLivreurDashboard
};