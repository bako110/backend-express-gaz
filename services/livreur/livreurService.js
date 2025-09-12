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
      filter.status = status; // ex: "disponible"
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
 * @param {String} status
 * @returns {Promise<Array>}
 */
async function getDeliveriesByStatus(livreurId, status) {
  try {
    const livreur = await Livreur.findById(livreurId).exec();
    if (!livreur) {
      throw new Error('Livreur non trouvé');
    }

    // Filtrer les commandes selon le status demandé
    const filteredDeliveries = livreur.todaysDeliveries.filter(
      delivery => delivery.status === status
    );

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

    // Retourner toutes les commandes du jour
    return livreur.todaysDeliveries;

  } catch (error) {
    throw new Error('Erreur lors de la récupération des commandes : ' + error.message);
  }
}

/**
 * Récupérer le dashboard complet d'un livreur
 * @param {String} livreurId
 * @returns {Promise<Object>}
 */
async function getLivreurDashboard(livreurId) {
  try {
    // Récupérer le livreur et peupler la référence user
    const livreur = await Livreur.findById(livreurId)
      .populate('user', 'name phone photo userType')
      .exec();

    if (!livreur) throw new Error('Livreur non trouvé');

    // Extraire les livraisons d'aujourd'hui
    const todaysDeliveries = livreur.todaysDeliveries.map(delivery => ({
      id: delivery._id,
      client: delivery.clientName,
      telephone: delivery.clientPhone,
      adresse: delivery.address,
      statut: delivery.status,
      distance: delivery.distance || 'N/A',
      estimatedTime: delivery.estimatedTime || 'N/A',
      total: delivery.total,
      scheduledAt: delivery.scheduledAt,
    }));

    // Extraire l'historique
    const deliveryHistory = livreur.deliveryHistory.map(delivery => ({
      id: delivery._id,
      client: delivery.clientName,
      telephone: delivery.clientPhone,
      adresse: delivery.address,
      statut: delivery.status,
      total: delivery.total,
      deliveredAt: delivery.deliveredAt,
    }));

    // Dashboard global
    const dashboard = {
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
      todaysDeliveries,
      deliveryHistory,
    };

    return dashboard;
  } catch (error) {
    throw new Error('Erreur lors de la récupération du dashboard : ' + error.message);
  }
}

module.exports = {
  getAllLivreurs,
  getLivreurs,
  getDeliveriesByStatus,
  getAllDeliveries,
  getLivreurDashboard
};
