// controllers/orderController.js
const AdminDataService = require('../services/DataLoaderService');

/**
 * Récupère toutes les commandes avec pagination et filtrage par statut
 */
exports.getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 50, status = 'all' } = req.query;

    const result = await AdminDataService.loadAllOrders(Number(page), Number(limit), status);

    return res.status(200).json({
      success: true,
      message: 'Liste des commandes récupérée avec succès',
      data: result.orders,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });

  } catch (error) {
    console.error('Erreur lors du chargement des commandes :', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur lors du chargement des commandes',
      error: error.message,
    });
  }
};

/**
 * Récupère les statistiques globales des commandes
 */
exports.getOrderStats = async (req, res) => {
  try {
    const stats = await AdminDataService.getOrderStats();

    return res.status(200).json({
      success: true,
      message: 'Statistiques des commandes récupérées avec succès',
      data: stats,
    });

  } catch (error) {
    console.error('Erreur lors du calcul des statistiques des commandes :', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur lors du calcul des statistiques',
      error: error.message,
    });
  }
};
