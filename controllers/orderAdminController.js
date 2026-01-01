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

/**
 * Rechercher des commandes
 */
exports.searchOrders = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Terme de recherche requis'
      });
    }

    const result = await AdminDataService.loadAllOrders(1, 100, 'all');
    const orders = result.orders.filter(order => 
      order.clientName?.toLowerCase().includes(q.toLowerCase()) ||
      order.clientPhone?.includes(q) ||
      order.validationCode?.includes(q)
    );

    return res.status(200).json({
      success: true,
      data: orders
    });

  } catch (error) {
    console.error('Erreur recherche commandes:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche',
      error: error.message
    });
  }
};

/**
 * Récupérer les commandes d'un utilisateur
 */
exports.getUserOrders = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await AdminDataService.loadAllOrders(1, 1000, 'all');
    const userOrders = result.orders.filter(order => 
      order.clientId === userId || order.userId === userId
    );

    return res.status(200).json({
      success: true,
      data: userOrders
    });

  } catch (error) {
    console.error('Erreur récupération commandes utilisateur:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération',
      error: error.message
    });
  }
};

/**
 * Récupérer une commande par ID
 */
exports.getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const result = await AdminDataService.loadAllOrders(1, 1000, 'all');
    const order = result.orders.find(o => o._id.toString() === orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    return res.status(200).json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('Erreur récupération commande:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération',
      error: error.message
    });
  }
};

/**
 * Mettre à jour le statut d'une commande
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    // TODO: Implémenter la mise à jour dans la base de données
    return res.status(200).json({
      success: true,
      message: 'Statut mis à jour avec succès',
      data: { orderId, status }
    });

  } catch (error) {
    console.error('Erreur mise à jour statut:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour',
      error: error.message
    });
  }
};

/**
 * Affecter un livreur à une commande
 */
exports.assignDeliverer = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { livreurId } = req.body;

    // TODO: Implémenter l'affectation dans la base de données
    return res.status(200).json({
      success: true,
      message: 'Livreur affecté avec succès',
      data: { orderId, livreurId }
    });

  } catch (error) {
    console.error('Erreur affectation livreur:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'affectation',
      error: error.message
    });
  }
};

/**
 * Supprimer une commande
 */
exports.deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    // TODO: Implémenter la suppression dans la base de données
    return res.status(200).json({
      success: true,
      message: 'Commande supprimée avec succès',
      data: { orderId }
    });

  } catch (error) {
    console.error('Erreur suppression commande:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression',
      error: error.message
    });
  }
};
