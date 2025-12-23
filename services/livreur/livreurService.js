// services/livreurService.js
const Livreur = require('../../models/livreur');

/**
 * Récupérer le profil du livreur par ID utilisateur
 */
async function getProfileByUserId(userId) {
  try {
    const livreur = await Livreur.findOne({ user: userId })
      .populate('user', 'name phone photo userType')
      .exec();
    
    if (!livreur) {
      throw new Error('Profil livreur non trouvé');
    }
    
    return livreur.toObject();
  } catch (error) {
    throw new Error('Erreur lors de la récupération du profil : ' + error.message);
  }
}

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
 * @param {String} status - pending, in_progress, completed, cancelled
 * @returns {Promise<Array>}
 */
async function getDeliveriesByStatus(livreurId, status) {
  try {
    const livreur = await Livreur.findById(livreurId).exec();
    if (!livreur) {
      throw new Error('Livreur non trouvé');
    }

    // ✅ Utiliser le nouvel array UNIFIÉ
    const filteredDeliveries = livreur.deliveries
      .filter(delivery => delivery.status === status)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))  // Tri par date décroissante
      .map(delivery => ({
        orderId: delivery.orderId,
        clientName: delivery.clientName,
        clientPhone: delivery.clientPhone,
        address: delivery.address,
        status: delivery.status,
        distance: delivery.distance || 'N/A',
        estimatedTime: delivery.estimatedTime || 'N/A',
        total: delivery.total,
        deliveryFee: delivery.deliveryFee || 0,
        products: delivery.products || [],
        priority: delivery.priority || 'normal',
        createdAt: delivery.createdAt,
        assignedAt: delivery.assignedAt,
        completedAt: delivery.completedAt,
        distributorName: delivery.distributorName
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

    // ✅ Utiliser le nouvel array UNIFIÉ et trier par date
    return livreur.deliveries
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))  // Plus récent d'abord
      .map(delivery => ({
        orderId: delivery.orderId,
        id: delivery.orderId, // Alias pour compatibilité frontend
        clientName: delivery.clientName,
        clientPhone: delivery.clientPhone,
        address: delivery.address,
        status: delivery.status,
        distance: delivery.distance || 'N/A',
        estimatedTime: delivery.estimatedTime || 'N/A',
        total: delivery.total,
        deliveryFee: delivery.deliveryFee || 0,
        products: delivery.products || [],
        priority: delivery.priority || 'normal',
        distributorName: delivery.distributorName || 'Distributeur inconnu',
        createdAt: delivery.createdAt,
        assignedAt: delivery.assignedAt,
        completedAt: delivery.completedAt,
        validationCode: delivery.validationCode
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

    // ✅ Utiliser le nouvel array UNIFIÉ, trié par date
    const allDeliveries = livreur.deliveries
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(delivery => ({
        orderId: delivery.orderId,
        clientName: delivery.clientName,
        clientPhone: delivery.clientPhone,
        address: delivery.address,
        status: delivery.status,
        total: delivery.total,
        deliveryFee: delivery.deliveryFee || 0,
        completedAt: delivery.completedAt,
        products: delivery.products || [],
        priority: delivery.priority || 'normal',
        distributorName: delivery.distributorName,
        createdAt: delivery.createdAt,
        assignedAt: delivery.assignedAt
      }));

    // 📊 CALCUL DYNAMIQUE DES STATISTIQUES D'AUJOURD'HUI
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayDeliveries = livreur.deliveries.filter(delivery => {
      const deliveryDate = new Date(delivery.createdAt || delivery.assignedAt);
      deliveryDate.setHours(0, 0, 0, 0);
      return deliveryDate.getTime() === today.getTime();
    });

    // Compter les livraisons complétées du jour
    const completedTodayCount = todayDeliveries.filter(
      d => d.status === 'completed'
    ).length;

    // 💰 Calculer les revenus du jour (somme des deliveryFee des livraisons complétées)
    const revenueToday = todayDeliveries
      .filter(d => d.status === 'completed')
      .reduce((sum, d) => sum + (d.deliveryFee || 0), 0);

    // Calculer le temps moyen par livraison (si on a des données de temps)
    let avgTimePerDelivery = 0;
    const completedWithTime = todayDeliveries.filter(
      d => d.status === 'completed' && d.startedAt && d.completedAt
    );
    if (completedWithTime.length > 0) {
      const totalTime = completedWithTime.reduce((sum, d) => {
        const startTime = new Date(d.startedAt);
        const endTime = new Date(d.completedAt);
        return sum + (endTime - startTime) / 60000; // en minutes
      }, 0);
      avgTimePerDelivery = Math.round(totalTime / completedWithTime.length);
    }

    // ✅ STATISTIQUES DE LA SEMAINE - 7 JOURS COMPLETS
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Début de la semaine (dimanche)
    
    // Créer array pour chaque jour de la semaine
    const weekStats = [];
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const dayNamesShort = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + i);
      dayDate.setHours(0, 0, 0, 0);
      
      // Filtrer les livraisons du jour
      const dayDeliveries = livreur.deliveries.filter(delivery => {
        const deliveryDate = new Date(delivery.createdAt || delivery.assignedAt);
        deliveryDate.setHours(0, 0, 0, 0);
        return deliveryDate.getTime() === dayDate.getTime();
      });
      
      // Compter les livraisons complétées
      const completedCount = dayDeliveries.filter(d => d.status === 'completed').length;
      
      // Calculer les revenus (somme des deliveryFee)
      const dayRevenue = dayDeliveries
        .filter(d => d.status === 'completed')
        .reduce((sum, d) => sum + (d.deliveryFee || 0), 0);
      
      weekStats.push({
        jour: dayNamesShort[i],
        livraisons: completedCount,
        revenus: dayRevenue,
        date: dayDate.toISOString().split('T')[0],
        allDeliveries: dayDeliveries.length, // Toutes les livraisons du jour (pas seulement complétées)
      });
    }

    // Résumé total semaine
    const completedWeek = weekStats.reduce((sum, day) => sum + day.livraisons, 0);
    const revenueWeek = weekStats.reduce((sum, day) => sum + day.revenus, 0);

    // Dashboard global avec toutes les livraisons
    return {
      user: {
        name: livreur.user.name,
        phone: livreur.user.phone,
        photo: livreur.user.photo,
      },
      stats: {
        today: {
          livraisons: completedTodayCount,
          revenus: revenueToday,
          kmParcourus: 0, // À calculer si données de distance disponibles
          tempsMoyen: avgTimePerDelivery,
        },
        week: weekStats,
        week_summary: {
          completedWeek: completedWeek,
          revenueWeek: revenueWeek,
          avgPerDay: weekStats.length > 0 ? Math.round(completedWeek / 7) : 0,
        },
        totalLivraisons: livreur.totalLivraisons,
        totalRevenue: livreur.totalRevenue,
      },
      status: livreur.status,
      vehicleType: livreur.vehicleType,
      zone: livreur.zone,
      wallet: livreur.wallet,
      todaysDeliveries: todayDeliveries.map(d => ({
        orderId: d.orderId,
        clientName: d.clientName,
        clientPhone: d.clientPhone,
        address: d.address,
        status: d.status,
        total: d.total,
        deliveryFee: d.deliveryFee || 0,
        createdAt: d.createdAt,
        assignedAt: d.assignedAt,
        completedAt: d.completedAt,
      })),
      deliveryHistory: allDeliveries,
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