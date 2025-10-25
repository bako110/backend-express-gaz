// controllers/transactionController.js
const AdminDataService = require('../services/DataLoaderService');

/**
 * 📊 Récupérer toutes les transactions (avec pagination et filtrage)
 */
exports.getAllTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 50, status = 'all' } = req.query;
    const result = await AdminDataService.loadAllTransactions(page, limit, status);

    res.json({
      success: true,
      data: result.transactions,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
};

/**
 * 📈 Statistiques globales des transactions
 */
exports.getTransactionStats = async (req, res) => {
  try {
    const stats = await AdminDataService.getTransactionStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur calcul stats',
      error: error.message
    });
  }
};

/**
 * 🔍 Recherche de transactions
 */
exports.searchTransactions = async (req, res) => {
  try {
    const { query } = req.query;
    const results = await AdminDataService.searchTransactions(query);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche de transactions',
      error: error.message
    });
  }
};

/**
 * 👤 Transactions d’un utilisateur spécifique
 */
exports.getUserTransactions = async (req, res) => {
  try {
    const userId = req.params.userId;
    const userTransactions = await AdminDataService.getUserTransactions(userId);
    res.json({ success: true, data: userTransactions });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des transactions utilisateur',
      error: error.message
    });
  }
};

/**
 * 🧾 Détails d’une transaction spécifique
 */
exports.getTransactionById = async (req, res) => {
  try {
    const transactionId = req.params.transactionId;
    const transaction = await AdminDataService.getTransactionById(transactionId);
    res.json({ success: true, data: transaction });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: 'Transaction introuvable',
      error: error.message
    });
  }
};

/**
 * 🔄 Mettre à jour le statut d’une transaction
 */
exports.updateTransactionStatus = async (req, res) => {
  try {
    const transactionId = req.params.transactionId;
    const { status } = req.body;
    const updated = await AdminDataService.updateTransactionStatus(transactionId, status);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut',
      error: error.message
    });
  }
};

/**
 * 🗑️ Supprimer une transaction
 */
exports.deleteTransaction = async (req, res) => {
  try {
    const transactionId = req.params.transactionId;
    await AdminDataService.deleteTransaction(transactionId);
    res.json({ success: true, message: 'Transaction supprimée avec succès' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression',
      error: error.message
    });
  }
};

/**
 * 📤 Exporter les transactions (ex: CSV, PDF)
 */
exports.exportTransactions = async (req, res) => {
  try {
    const file = await AdminDataService.exportTransactions();
    res.json({ success: true, data: file });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l’exportation des transactions',
      error: error.message
    });
  }
};
