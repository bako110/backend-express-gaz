// controllers/livreurController.js
const livreurService = require('../../services/livreur/livreurService');

/**
 * Récupérer tous les livreurs avec info utilisateur
 */
async function getLivreurs(req, res) {
  try {
    const livreurs = await livreurService.getAllLivreurs();
    res.status(200).json({
      success: true,
      count: livreurs.length,
      data: livreurs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * Récupérer uniquement les livreurs disponibles ou par status
 */
async function getLivreur(req, res) {
  try {
    const { status } = req.query; // récupère ?status=disponible
    const livreurs = await livreurService.getLivreurs(status);
    res.status(200).json({
      success: true,
      count: livreurs.length,
      data: livreurs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * Récupérer les commandes d'un livreur selon leur étape
 */
async function getDeliveriesByStatus(req, res) {
  try {
    const { livreurId, status } = req.params;
    const deliveries = await livreurService.getDeliveriesByStatus(livreurId, status);
    res.status(200).json({
      success: true,
      count: deliveries.length,
      data: deliveries,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * Récupérer toutes les commandes d'un livreur groupées par étape
 */
async function getAllDeliveriesGrouped(req, res) {
  try {
    const { livreurId } = req.params;
    const groupedDeliveries = await livreurService.getAllDeliveries(livreurId);
    res.status(200).json({
      success: true,
      data: groupedDeliveries,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function dashboard(req, res) {
  try {
    const livreurId = req.params.livreurId;
    const data = await livreurService.getLivreurDashboard(livreurId); // ✅ ici
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}


module.exports = {
  getLivreurs,
  getLivreur,
  getDeliveriesByStatus,
  getAllDeliveriesGrouped,
  dashboard
};
