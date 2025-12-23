// controllers/userDataController.js
const asyncHandler = require('express-async-handler');
const DataLoaderService = require('../services/DataLoaderService');

/**
 * 📦 Récupère toutes les données complètes d’un utilisateur (profil, transactions, commandes, etc.)
 */
exports.getUserCompleteData = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  try {
    const userData = await DataLoaderService.loadUserCompleteData(userId);

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: `Aucune donnée trouvée pour l'utilisateur ID ${userId}`,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Données utilisateur récupérées avec succès',
      data: userData,
    });
  } catch (error) {
    console.error('Erreur lors du chargement des données utilisateur :', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur lors du chargement des données utilisateur',
      error: error.message,
    });
  }
});

/**
 * 💸 Récupère les transactions d’un utilisateur avec pagination et filtrage
 */
exports.getUserTransactions = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { type = 'all', limit = 50, page = 1 } = req.query;

  try {
    let transactions = await DataLoaderService.loadUserTransactions(userId);

    // Filtrage par type si précisé
    if (type !== 'all') {
      transactions = transactions.filter(trans => trans.source === type);
    }

    // Pagination
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = transactions.slice(startIndex, startIndex + limitNum);

    return res.status(200).json({
      success: true,
      message: 'Transactions utilisateur récupérées avec succès',
      data: paginated,
      pagination: {
        total: transactions.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(transactions.length / limitNum),
      },
    });
  } catch (error) {
    console.error('Erreur lors du chargement des transactions utilisateur :', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur lors du chargement des transactions utilisateur',
      error: error.message,
    });
  }
});

/**
 * 🛒 Récupère les commandes d’un utilisateur avec pagination, filtrage par type et statut
 */
exports.getUserOrders = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { status = 'all', type = 'all', limit = 50, page = 1 } = req.query;

  try {
    let orders = await DataLoaderService.loadUserOrders(userId);

    // Filtrage par statut
    if (status !== 'all') {
      orders = orders.filter(order => order.status === status);
    }

    // Filtrage par type
    if (type !== 'all') {
      orders = orders.filter(order => order.type === type);
    }

    // Pagination
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = orders.slice(startIndex, startIndex + limitNum);

    return res.status(200).json({
      success: true,
      message: 'Commandes utilisateur récupérées avec succès',
      data: paginated,
      pagination: {
        total: orders.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(orders.length / limitNum),
      },
    });
  } catch (error) {
    console.error('Erreur lors du chargement des commandes utilisateur :', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur lors du chargement des commandes utilisateur',
      error: error.message,
    });
  }
});
